import { env } from "../../env";
import { robustFetch } from "../fetcher";
import { ProviderError, type Provider, type RawPlace, type SearchInput } from "../types";

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function bbox(input: SearchInput) {
  const dLat = input.radiusKm / 111;
  const dLng = input.radiusKm / (111 * Math.cos((input.lat * Math.PI) / 180));
  return `${(input.lat - dLat).toFixed(5)},${(input.lng - dLng).toFixed(5)},${(input.lat + dLat).toFixed(5)},${(input.lng + dLng).toFixed(5)}`;
}

const escapeRe = (s: string) => s.replace(/[\\.*+?^${}()|[\]"]/g, "\\$&");

export function buildOverpassQuery(input: SearchInput): string {
  const box = bbox(input);
  const parts: string[] = [];
  for (const f of input.osmFilters) {
    const [k, v] = f.split("=");
    if (k && v) parts.push(`nwr["${k}"="${v}"]["name"](${box});`);
  }
  // Recherche par nom : utile pour les activités libres ou mal étiquetées.
  const words = input.keyword
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(pour|avec|dans|des|les|une)$/i.test(w))
    .slice(0, 2);
  const nameRe = escapeRe(words.length ? words.join(".*") : input.keyword);
  for (const key of ["shop", "office", "amenity", "craft", "tourism", "healthcare", "leisure"]) {
    parts.push(`nwr["${key}"]["name"~"${nameRe}",i](${box});`);
  }
  return `[out:json][timeout:50];(${parts.join("")});out center tags ${Math.min(input.limit * 6 + 100, 1500)};`;
}

/** OpenStreetMap (Overpass) : gratuit, légal, sans clé, jamais bloquant. Source de secours ultime. */
export const openStreetMap: Provider = {
  id: "osm",
  label: "OpenStreetMap (gratuit)",
  available: () => true,
  async search(input, deadline) {
    const query = buildOverpassQuery(input);
    const endpoints = [...env.overpassEndpoints].sort(() => Math.random() - 0.5);
    let lastError = "aucun serveur disponible";

    for (const endpoint of endpoints) {
      if (Date.now() > deadline) break;
      try {
        const res = await robustFetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "LeadScraperDakar/2.0 (lead generation; contact via site)",
          },
          timeoutMs: 60_000,
          retries: 0,
        });
        if (res.status !== 200) {
          lastError = `${new URL(endpoint).host} HTTP ${res.status}`;
          continue;
        }
        const data = JSON.parse(res.text) as { elements?: OsmElement[] };
        return (data.elements ?? [])
          .map(toPlace)
          .filter((p): p is RawPlace => !!p && !input.exclude?.(p))
          .slice(0, input.limit);
      } catch (e) {
        lastError = `${new URL(endpoint).host}: ${e instanceof Error ? e.message : e}`;
      }
    }
    throw new ProviderError(`OpenStreetMap indisponible (${lastError})`);
  },
};

function toPlace(el: OsmElement): RawPlace | null {
  const t = el.tags ?? {};
  const name = t.name ?? t["name:fr"];
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;
  const address = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:suburb"] ?? t["addr:quarter"],
    t["addr:city"],
  ]
    .filter(Boolean)
    .join(", ");
  const category = t.shop ?? t.office ?? t.amenity ?? t.craft ?? t.tourism ?? t.healthcare ?? t.leisure ?? null;
  return {
    name,
    category: category ? category.replace(/_/g, " ") : null,
    phone: (t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? t.mobile ?? "").split(";")[0] || null,
    email: (t.email ?? t["contact:email"] ?? "").split(";")[0] || null,
    website: t.website ?? t["contact:website"] ?? t.url ?? null,
    facebook: t["contact:facebook"] ?? t.facebook ?? null,
    instagram: t["contact:instagram"] ?? null,
    address: address || null,
    latitude: lat,
    longitude: lng,
    openingHours: t.opening_hours ?? null,
    placeId: `osm:${el.type}/${el.id}`,
    mapsUrl: lat && lng ? `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lng},18z` : null,
  };
}
