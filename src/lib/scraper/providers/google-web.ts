import { env } from "../../env";
import { robustFetch, sleep } from "../fetcher";
import { findSenegalPhones } from "../phone";
import { ProviderError, type Provider, type RawPlace } from "../types";

/**
 * Lecture directe de Google Maps sans navigateur (endpoint JSON interne `tbm=map`).
 * Gratuit et rapide, mais Google peut bloquer les IP de datacenter : dans ce cas,
 * l'erreur déclenche le basculement automatique vers la source suivante.
 * Avec SCRAPER_PROXY_URLS ou SCRAPER_GATEWAY_URL, les requêtes passent par des IP résidentielles.
 */
export const googleWeb: Provider = {
  id: "google_web",
  label: "Google Maps (lecture directe)",
  available: () => !env.disableGoogleWeb,
  async search(input, deadline) {
    const byKey = new Map<string, RawPlace>();
    const dist = Math.round(input.radiusKm * 1000 * 4);
    // Pas de virgule : « X, Dakar » est interprété comme une adresse et réduit les résultats.
    const hint = input.queryHint.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const city = /dakar/i.test(hint) ? "Dakar" : hint.split(" ").slice(-1)[0];
    const queries = [`${input.keyword} ${hint}`, `${input.keyword} ${city} Sénégal`];

    const rawSeen = new Set<string>();
    for (const q of queries) {
      // On pagine jusqu'à obtenir assez de contacts NOUVEAUX (les fiches déjà fournies sont sautées).
      for (let offset = 0; byKey.size < input.limit && offset <= 180 && Date.now() < deadline; offset += 20) {
        const places = await fetchPage(q, input.lat, input.lng, dist, offset);
        let fresh = 0;
        for (const p of places) {
          const key = p.placeId ?? `${p.name}|${p.latitude?.toFixed(4)}|${p.longitude?.toFixed(4)}`;
          if (rawSeen.has(key)) continue;
          rawSeen.add(key);
          fresh++;
          if (!input.exclude?.(p)) byKey.set(key, p);
        }
        if (fresh === 0 || places.length < 15) break; // fin des résultats pour cette requête
        await sleep(700 + Math.random() * 1000);
      }
    }
    return [...byKey.values()].slice(0, input.limit);
  },
};

async function fetchPage(q: string, lat: number, lng: number, dist: number, offset: number): Promise<RawPlace[]> {
  const pb = `!4m8!1m3!1d${dist}!2d${lng}!3d${lat}!3m2!1i1366!2i768!4f13.1!7i20!8i${offset}!10b1`;
  const url =
    `https://www.google.com/search?tbm=map&authuser=0&hl=fr&gl=sn` +
    `&q=${encodeURIComponent(q)}&pb=${encodeURIComponent(pb)}`;
  const res = await robustFetch(url, {
    stealth: true,
    retries: 1,
    timeoutMs: 20_000,
    headers: {
      Accept: "*/*",
      Referer: "https://www.google.com/maps",
      // Consentement cookies pré-accepté (évite la page de consentement européenne).
      Cookie: "CONSENT=YES+cb; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmZyIAEaBgiAo_CmBg",
    },
  });
  if (res.status === 429 || /unusual traffic|\/sorry\/index|captcha/i.test(res.text.slice(0, 5000))) {
    throw new ProviderError("Google a détecté un trafic automatisé (blocage temporaire)");
  }
  if (res.url.includes("consent.google")) throw new ProviderError("Page de consentement Google");
  if (res.status >= 400) throw new ProviderError(`Google Maps HTTP ${res.status}`);
  const data = parseGoogleJson(res.text);
  if (data === undefined) throw new ProviderError("Format de réponse Google inattendu");
  return extractPlaces(data);
}

export function parseGoogleJson(text: string): unknown {
  let body = text.trim();
  if (body.startsWith('{"c"')) {
    try {
      const wrapper = JSON.parse(body.replace(/\/\*""\*\/\s*$/, ""));
      body = String(wrapper.d ?? "");
    } catch {
      /* on tente la suite */
    }
  }
  body = body.replace(/^\)\]\}'\s*/, "");
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

type Arr = unknown[];
const isArr = (v: unknown): v is Arr => Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const at = (v: unknown, ...path: number[]): unknown => {
  let cur = v;
  for (const i of path) {
    if (!isArr(cur)) return undefined;
    cur = cur[i];
  }
  return cur;
};

/** Une fiche Google Maps : tableau avec le nom en [11] et les coordonnées en [9][2]/[9][3]. */
function looksLikePlace(p: Arr): boolean {
  return p.length > 20 && !!str(p[11]) && isArr(p[9]) && num(p[9][2]) !== null && num(p[9][3]) !== null;
}

/** Parcourt tout l'arbre JSON : robuste aux changements d'enveloppe de Google. */
export function extractPlaces(root: unknown): RawPlace[] {
  const found: RawPlace[] = [];
  const stack: Array<{ v: unknown; depth: number }> = [{ v: root, depth: 0 }];
  let visited = 0;
  while (stack.length && visited < 200_000) {
    const { v, depth } = stack.pop()!;
    visited++;
    if (!isArr(v)) continue;
    if (looksLikePlace(v)) {
      const place = toPlace(v);
      if (place) found.push(place);
      continue;
    }
    if (depth < 12) for (let i = v.length - 1; i >= 0; i--) if (isArr(v[i])) stack.push({ v: v[i], depth: depth + 1 });
  }
  return found;
}

/** « 1 910 avis » → 1910 */
function reviewsFromText(t: string | null): number | null {
  const digits = t?.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function toPlace(p: Arr): RawPlace | null {
  const name = str(p[11]);
  if (!name) return null;

  const categories = isArr(p[13]) ? (p[13] as unknown[]).map(str).filter(Boolean) : [];
  const addressLines = isArr(p[2]) ? (p[2] as unknown[]).map(str).filter(Boolean) : [];
  const address = str(p[39]) ?? (addressLines.length ? addressLines.join(", ") : null) ?? str(p[18]);

  let phone = str(at(p, 178, 0, 0)) ?? str(at(p, 178, 0, 1, 0, 0)) ?? str(at(p, 3, 0));
  if (!phone) phone = findSenegalPhones(JSON.stringify(p).slice(0, 200_000))[0] ?? null;

  let website = str(at(p, 7, 0));
  if (website?.startsWith("/url?q=")) website = decodeURIComponent(website.slice(7).split("&")[0]);
  if (website && !/^https?:\/\//.test(website)) website = null;

  const placeId = str(p[78]);
  const cid = str(p[10]);
  const lat = num(at(p, 9, 2));
  const lng = num(at(p, 9, 3));

  return {
    name,
    category: categories[0] ?? null,
    phone,
    website,
    address,
    latitude: lat,
    longitude: lng,
    rating: num(at(p, 4, 7)),
    reviewsCount: num(at(p, 4, 8)) ?? reviewsFromText(str(at(p, 4, 3, 1))),
    placeId: placeId ?? cid,
    mapsUrl: placeId
      ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
      : lat !== null && lng !== null
        ? `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lng},17z`
        : null,
  };
}
