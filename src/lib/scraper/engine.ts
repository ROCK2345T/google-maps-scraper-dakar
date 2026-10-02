import { db } from "../db";
import { env } from "../env";
import { googlePlaces } from "./providers/google-places";
import { googleWeb } from "./providers/google-web";
import { openStreetMap } from "./providers/osm";
import { serpApi } from "./providers/serpapi";
import type { Provider, ProviderId, RawPlace, SearchInput } from "./types";

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

/**
 * Exécute une recherche en essayant chaque source dans l'ordre.
 * Une source en erreur ou sans résultat passe la main à la suivante.
 * Si toutes les sources en pause échouent aussi, on les réessaie quand même :
 * l'objectif prioritaire est d'obtenir des données, pas la vitesse.
 */
export async function runSearch(input: SearchInput, deadline: number): Promise<SearchOutcome> {
  const chain = providerChain();
  const paused = await coolingDown().catch(() => new Set<string>());
  const ordered = [...chain.filter((p) => !paused.has(p.id)), ...chain.filter((p) => paused.has(p.id))];
  const attempts: SearchOutcome["attempts"] = [];
  let best: { places: RawPlace[]; provider: ProviderId } | null = null;

  for (const provider of ordered) {
    if (Date.now() > deadline - 5_000) break;
    try {
      const places = await provider.search(input, deadline);
      await recordSuccess(provider.id).catch(() => {});
      attempts.push({ provider: provider.id, ok: true, count: places.length });
      if (!best || places.length > best.places.length) best = { places, provider: provider.id };
      // Résultat satisfaisant : on s'arrête. Sinon, on tente une autre source pour compléter.
      if (places.length >= Math.min(5, input.limit)) break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordFailure(provider.id, message).catch(() => {});
      attempts.push({ provider: provider.id, ok: false, count: 0, error: message });
    }
  }
  return { places: best?.places ?? [], provider: best?.provider ?? null, attempts };
}
