import { db } from "../db";
import { env } from "../env";
import { googlePlaces } from "./providers/google-places";
import { googleWeb } from "./providers/google-web";
import { openStreetMap } from "./providers/osm";
import { serpApi } from "./providers/serpapi";
import type { Provider, ProviderId, RawPlace, SearchInput } from "./types";
import { contactKeys } from "./dedupe";

export const PROVIDERS: Record<ProviderId, Provider> = {
  google_places: googlePlaces,
  serpapi: serpApi,
  google_web: googleWeb,
  osm: openStreetMap,
};

/** Ordre par défaut : sources officielles d'abord, Google direct ensuite, OpenStreetMap en dernier recours. */
const DEFAULT_ORDER: ProviderId[] = ["google_places", "serpapi", "google_web", "osm"];

/** Après N échecs consécutifs, une source est mise en pause (disjoncteur). */
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MIN = 20;

export function providerChain(): Provider[] {
  const custom = env.providerOrder.filter((id): id is ProviderId => id in PROVIDERS);
  const order = custom.length ? [...custom, ...DEFAULT_ORDER.filter((id) => !custom.includes(id))] : DEFAULT_ORDER;
  return order.map((id) => PROVIDERS[id]).filter((p) => p.available());
}

type Health = { provider: string; cooldown_until: Date | null };

async function coolingDown(): Promise<Set<string>> {
  const rows = await db()<Health[]>`select provider, cooldown_until from app.provider_health where cooldown_until > now()`;
  return new Set(rows.map((r) => r.provider));
}

async function recordSuccess(id: ProviderId) {
  await db()`
    insert into app.provider_health (provider, total_success, last_success_at, consecutive_failures)
    values (${id}, 1, now(), 0)
    on conflict (provider) do update set
      total_success = app.provider_health.total_success + 1,
      last_success_at = now(), consecutive_failures = 0, cooldown_until = null
  `;
}

async function recordFailure(id: ProviderId, error: string) {
  await db()`
    insert into app.provider_health (provider, total_failures, last_failure_at, consecutive_failures, last_error)
    values (${id}, 1, now(), 1, ${error.slice(0, 500)})
    on conflict (provider) do update set
      total_failures = app.provider_health.total_failures + 1,
      last_failure_at = now(),
      consecutive_failures = app.provider_health.consecutive_failures + 1,
      last_error = excluded.last_error,
      cooldown_until = case when app.provider_health.consecutive_failures + 1 >= ${BREAKER_THRESHOLD}
        then now() + ${BREAKER_COOLDOWN_MIN + " minutes"}::interval else null end
  `;
}

export type SearchOutcome = {
  places: RawPlace[];
  provider: ProviderId | null;
  attempts: Array<{ provider: ProviderId; ok: boolean; count: number; error?: string }>;
};

/** 4 sous-zones (quadrants) : d'autres points de recherche donnent d'autres fiches. */
export function subZones(input: Pick<SearchInput, "lat" | "lng" | "radiusKm">) {
  const r = input.radiusKm * 0.55;
  const dLat = r / 111;
  const dLng = r / (111 * Math.cos((input.lat * Math.PI) / 180));
  return [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].map(([a, b]) => ({ lat: input.lat + a * dLat, lng: input.lng + b * dLng, radiusKm: r }));
}

const hasContact = (p: RawPlace) => !!(p.phone || p.website || p.email);

/**
 * Exécute une recherche en combinant les sources dans l'ordre jusqu'à obtenir `limit` contacts NOUVEAUX.
 * - une source en erreur passe la main à la suivante (bascule automatique) ;
 * - si la zone principale est épuisée (contacts déjà fournis), la source explore 4 sous-zones ;
 * - les sources de complément ne gardent que des fiches avec un moyen de contact.
 * Les sources en pause sont réessayées en dernier : l'objectif est d'obtenir des données, pas la vitesse.
 */
export async function runSearch(input: SearchInput, deadline: number): Promise<SearchOutcome> {
  const chain = providerChain();
  const paused = await coolingDown().catch(() => new Set<string>());
  const ordered = [...chain.filter((p) => !paused.has(p.id)), ...chain.filter((p) => paused.has(p.id))];
  const attempts: SearchOutcome["attempts"] = [];
  const collected: RawPlace[] = [];
  const taken = new Set<string>();
  const exclude = (p: RawPlace) => contactKeys(p).some((k) => taken.has(k)) || (input.exclude?.(p) ?? false);
  let primary: ProviderId | null = null;

  for (const provider of ordered) {
    if (collected.length >= input.limit || Date.now() > deadline - 5_000) break;
    const before = collected.length;
    const points = [{ lat: input.lat, lng: input.lng, radiusKm: input.radiusKm }, ...subZones(input)];
    let failed: string | null = null;

    for (const [i, point] of points.entries()) {
      if (collected.length >= input.limit || Date.now() > deadline - 8_000) break;
      try {
        const places = await provider.search({ ...input, ...point, limit: input.limit - collected.length, exclude }, deadline);
        for (const p of places) {
          if (exclude(p)) continue;
          if (primary && primary !== provider.id && !hasContact(p)) continue;
          for (const k of contactKeys(p)) taken.add(k);
          collected.push({ ...p, source: provider.id });
        }
        if (collected.length > before) primary ??= provider.id;
      } catch (err) {
        if (i === 0) failed = err instanceof Error ? err.message : String(err);
        break; // une sous-zone en erreur : on garde ce qui a été trouvé
      }
    }

    if (failed) {
      await recordFailure(provider.id, failed).catch(() => {});
      attempts.push({ provider: provider.id, ok: false, count: 0, error: failed });
    } else {
      await recordSuccess(provider.id).catch(() => {});
      attempts.push({ provider: provider.id, ok: true, count: collected.length - before });
    }
  }
  return { places: collected, provider: primary, attempts };
}
