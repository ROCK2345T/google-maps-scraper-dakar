import { env } from "../../env";
import { robustFetch } from "../fetcher";
import { ProviderError, type Provider, type RawPlace } from "../types";

type SerpResponse = {
  error?: string;
  local_results?: Array<{
    title?: string;
    place_id?: string;
    data_cid?: string;
    gps_coordinates?: { latitude?: number; longitude?: number };
    rating?: number;
    reviews?: number;
    type?: string;
    address?: string;
    phone?: string;
    website?: string;
    hours?: string;
    open_state?: string;
  }>;
};

/** Google Maps via SerpAPI (service payant avec offre gratuite, gère lui-même les blocages). */
export const serpApi: Provider = {
  id: "serpapi",
  label: "SerpAPI (Google Maps)",
  available: () => !!env.serpApiKey,
  async search(input, deadline) {
    const out: RawPlace[] = [];
    for (let start = 0; start < input.limit && start <= 100 && Date.now() < deadline; start += 20) {
      const params = new URLSearchParams({
        engine: "google_maps",
        type: "search",
        q: `${input.keyword} ${input.queryHint}`,
        ll: `@${input.lat},${input.lng},${input.radiusKm > 6 ? 12 : 14}z`,
        hl: "fr",
        gl: "sn",
        start: String(start),
        api_key: env.serpApiKey!,
      });
      const res = await robustFetch(`https://serpapi.com/search.json?${params}`, { timeoutMs: 45_000, retries: 1 });
      let data: SerpResponse;
      try {
        data = JSON.parse(res.text);
      } catch {
        throw new ProviderError(`SerpAPI : réponse illisible (HTTP ${res.status})`);
      }
      if (data.error) {
        if (/hasn't returned any results/i.test(data.error)) break;
        throw new ProviderError(`SerpAPI : ${data.error}`);
      }
      const batch = data.local_results ?? [];
      for (const r of batch) {
        if (!r.title) continue;
        out.push({
          name: r.title,
          category: r.type ?? null,
          phone: r.phone ?? null,
          website: r.website ?? null,
          address: r.address ?? null,
          latitude: r.gps_coordinates?.latitude ?? null,
          longitude: r.gps_coordinates?.longitude ?? null,
          rating: r.rating ?? null,
          reviewsCount: r.reviews ?? null,
          placeId: r.place_id ?? null,
          mapsUrl: r.place_id ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}` : null,
          openingHours: r.hours ?? r.open_state ?? null,
        });
      }
      if (batch.length < 20) break;
    }
    return out.slice(0, input.limit);
  },
};
