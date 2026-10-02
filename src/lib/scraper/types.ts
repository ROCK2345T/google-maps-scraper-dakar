export type RawPlace = {
  name: string;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewsCount?: number | null;
  mapsUrl?: string | null;
  placeId?: string | null;
  openingHours?: string | null;
  businessStatus?: string | null;
  facebook?: string | null;
  instagram?: string | null;
};

export type SearchInput = {
  keyword: string;
  zoneName: string;
  queryHint: string;
  lat: number;
  lng: number;
  radiusKm: number;
  limit: number;
  osmFilters: string[];
};

export type ProviderId = "google_places" | "serpapi" | "google_web" | "osm";

export interface Provider {
  id: ProviderId;
  label: string;
  /** Disponible avec la configuration actuelle ? */
  available(): boolean;
  search(input: SearchInput, deadline: number): Promise<RawPlace[]>;
}

/** Erreur signalant un blocage / une indisponibilité : on bascule vers la source suivante. */
export class ProviderError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message);
  }
}
