/** Zones géographiques couvertes. Coordonnées approximatives du centre + rayon de recherche (km). */
export type Zone = {
  id: string;
  name: string;
  group: string;
  lat: number;
  lng: number;
  radiusKm: number;
  /** Texte ajouté à la requête pour aider les moteurs de recherche. */
  queryHint: string;
};

const z = (id: string, name: string, group: string, lat: number, lng: number, radiusKm: number, queryHint?: string): Zone => ({
  id,
  name,
  group,
  lat,
  lng,
  radiusKm,
  queryHint: queryHint ?? `${name}, Sénégal`,
});

export const ZONES: Zone[] = [
  z("dakar", "Tout Dakar", "Dakar — vue d'ensemble", 14.7167, -17.4677, 12, "Dakar, Sénégal"),

  z("plateau", "Dakar Plateau", "Dakar — centre", 14.6697, -17.438, 1.6, "Plateau, Dakar"),
  z("medina", "Médina", "Dakar — centre", 14.684, -17.451, 1.3, "Médina, Dakar"),
  z("gueule-tapee", "Gueule Tapée / Fass", "Dakar — centre", 14.687, -17.455, 1.2, "Fass, Dakar"),
  z("fann", "Fann / Point E / Amitié", "Dakar — centre", 14.695, -17.463, 1.4, "Point E, Dakar"),
  z("colobane", "Colobane / HLM", "Dakar — centre", 14.7, -17.447, 1.4, "HLM, Dakar"),
  z("grand-dakar", "Grand Dakar / Sicap", "Dakar — centre", 14.71, -17.456, 1.5, "Sicap, Dakar"),
  z("mermoz", "Mermoz / Sacré-Cœur", "Dakar — ouest", 14.714, -17.472, 1.6, "Mermoz Sacré-Cœur, Dakar"),
  z("liberte", "Liberté / Dieuppeul", "Dakar — ouest", 14.72, -17.459, 1.5, "Liberté 6, Dakar"),
  z("ouakam", "Ouakam / Mamelles", "Dakar — ouest", 14.726, -17.494, 1.8, "Ouakam, Dakar"),
  z("almadies", "Almadies / Ngor", "Dakar — ouest", 14.745, -17.515, 2, "Almadies, Dakar"),
  z("yoff", "Yoff", "Dakar — ouest", 14.756, -17.477, 1.8, "Yoff, Dakar"),
  z("grand-yoff", "Grand Yoff / Patte d'Oie", "Dakar — nord", 14.74, -17.452, 1.8, "Grand Yoff, Dakar"),
  z("parcelles", "Parcelles Assainies", "Dakar — nord", 14.762, -17.44, 2, "Parcelles Assainies, Dakar"),
  z("hann", "Hann / Maristes / Bel-Air", "Dakar — est", 14.723, -17.43, 2, "Hann Maristes, Dakar"),
  z("cambérène", "Cambérène", "Dakar — nord", 14.77, -17.43, 1.4, "Cambérène, Dakar"),

  z("pikine", "Pikine", "Banlieue", 14.755, -17.39, 2.5, "Pikine, Sénégal"),
  z("guediawaye", "Guédiawaye", "Banlieue", 14.776, -17.394, 2.5, "Guédiawaye, Sénégal"),
  z("thiaroye", "Thiaroye / Mbao", "Banlieue", 14.745, -17.34, 3, "Thiaroye, Sénégal"),
  z("keur-massar", "Keur Massar", "Banlieue", 14.78, -17.31, 3, "Keur Massar, Sénégal"),
  z("rufisque", "Rufisque", "Banlieue", 14.716, -17.273, 3, "Rufisque, Sénégal"),
  z("diamniadio", "Diamniadio / Sébikotane", "Banlieue", 14.72, -17.18, 4, "Diamniadio, Sénégal"),

  z("thies", "Thiès", "Régions", 14.791, -16.936, 5),
  z("mbour", "Mbour", "Régions", 14.422, -16.964, 4),
  z("saly", "Saly / Somone", "Régions", 14.45, -17.01, 4, "Saly, Sénégal"),
  z("saint-louis", "Saint-Louis", "Régions", 16.018, -16.49, 5),
  z("touba", "Touba", "Régions", 14.85, -15.883, 5),
  z("kaolack", "Kaolack", "Régions", 14.146, -16.073, 5),
  z("ziguinchor", "Ziguinchor", "Régions", 12.583, -16.272, 5),
  z("louga", "Louga", "Régions", 15.614, -16.229, 4),
  z("diourbel", "Diourbel", "Régions", 14.655, -16.231, 4),
  z("tambacounda", "Tambacounda", "Régions", 13.771, -13.667, 5),
  z("kolda", "Kolda", "Régions", 12.894, -14.941, 4),
  z("fatick", "Fatick", "Régions", 14.339, -16.411, 4),
  z("kaffrine", "Kaffrine", "Régions", 14.106, -15.551, 4),
  z("matam", "Matam", "Régions", 15.656, -13.255, 4),
  z("kedougou", "Kédougou", "Régions", 12.56, -12.175, 4),
  z("sedhiou", "Sédhiou", "Régions", 12.708, -15.557, 4),
];

export const ZONE_BY_ID = new Map(ZONES.map((zone) => [zone.id, zone]));

export function zoneBbox(zone: Zone): [number, number, number, number] {
  const dLat = zone.radiusKm / 111;
  const dLng = zone.radiusKm / (111 * Math.cos((zone.lat * Math.PI) / 180));
  return [zone.lat - dLat, zone.lng - dLng, zone.lat + dLat, zone.lng + dLng];
}
