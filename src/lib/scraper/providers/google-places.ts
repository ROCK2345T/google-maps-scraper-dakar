import { env } from "../../env";
import { robustFetch, sleep } from "../fetcher";
import { ProviderError, type Provider, type RawPlace } from "../types";

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.regularOpeningHours.weekdayDescriptions",
  "nextPageToken",
].join(",");

type PlacesResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    location?: { latitude?: number; longitude?: number };
    primaryTypeDisplayName?: { text?: string };
    businessStatus?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
  }>;
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

/** API officielle Google Places (New) — la source la plus fiable, jamais bloquée. */
export const googlePlaces: Provider = {
  id: "google_places",
  label: "Google Places API (officielle)",
  available: () => !!env.googlePlacesApiKey,
  async search(input, deadline) {
    const out: RawPlace[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3 && out.length < input.limit && Date.now() < deadline; page++) {
      const body = {
        textQuery: `${input.keyword} ${input.queryHint}`,
        languageCode: "fr",
        regionCode: "SN",
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
        locationBias: {
          circle: { center: { latitude: input.lat, longitude: input.lng }, radius: Math.min(input.radiusKm * 1000, 50_000) },
        },
      };
      const res = await robustFetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": env.googlePlacesApiKey!,
          "X-Goog-FieldMask": FIELDS,
        },
        retries: 2,
      });
      let data: PlacesResponse;
      try {
        data = JSON.parse(res.text);
      } catch {
        throw new ProviderError(`Réponse illisible (HTTP ${res.status})`);
      }
      if (res.status >= 400 || data.error) {
        throw new ProviderError(`Google Places : ${data.error?.message ?? "HTTP " + res.status}`, res.status !== 400);
      }
      for (const p of data.places ?? []) {
        if (!p.displayName?.text) continue;
        out.push({
          name: p.displayName.text,
          category: p.primaryTypeDisplayName?.text ?? null,
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
          website: p.websiteUri ?? null,
          address: p.formattedAddress ?? null,
          latitude: p.location?.latitude ?? null,
          longitude: p.location?.longitude ?? null,
          rating: p.rating ?? null,
          reviewsCount: p.userRatingCount ?? null,
          mapsUrl: p.googleMapsUri ?? null,
          placeId: p.id ?? null,
          businessStatus: p.businessStatus ?? null,
          openingHours: p.regularOpeningHours?.weekdayDescriptions?.join(" | ") ?? null,
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
      await sleep(400);
    }
    return out.slice(0, input.limit);
  },
};
