import { normalizePhone } from "./phone";
import type { RawPlace } from "./types";

/**
 * Empreintes d'un contact. Deux fiches partageant au moins une empreinte sont le même contact :
 * même identifiant Google/OSM, même numéro de téléphone, ou même nom au même endroit (~100 m).
 * Plusieurs empreintes par fiche : une entreprise trouvée sans téléphone puis avec téléphone,
 * ou via deux sources différentes, est quand même reconnue.
 */
export function contactKeys(p: Pick<RawPlace, "name" | "placeId" | "phone" | "latitude" | "longitude">): string[] {
  const keys: string[] = [];
  if (p.placeId) keys.push(`pid:${p.placeId}`);
  const tel = phoneKey(p.phone);
  if (tel) keys.push(tel);
  const name = normName(p.name);
  if (name) {
    keys.push(
      p.latitude != null && p.longitude != null
        ? `geo:${name}|${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`
        : `name:${name}`,
    );
  }
  return keys;
}

export function phoneKey(phone: string | null | undefined): string | null {
  const intl = normalizePhone(phone)?.intl;
  const digits = intl?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? `tel:${digits.slice(-9)}` : null;
}

export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ensemble d'empreintes déjà attribuées à une entreprise, avec compteur des fiches écartées. */
export class SeenContacts {
  private keys: Set<string>;
  private skipped = new Set<string>();

  constructor(initial: Iterable<string> = []) {
    this.keys = new Set(initial);
  }

  /** La fiche a-t-elle déjà été fournie (ou déjà retenue dans cette recherche) ? */
  has(p: RawPlace): boolean {
    const keys = contactKeys(p);
    const seen = keys.some((k) => this.keys.has(k));
    if (seen) this.skipped.add(keys[0] ?? p.name);
    return seen;
  }

  add(p: RawPlace) {
    for (const k of contactKeys(p)) this.keys.add(k);
  }

  get skippedCount() {
    return this.skipped.size;
  }
}
