import { timingSafeEqual } from "node:crypto";

/** Comparaison en temps constant d'un en-tête « Authorization: Bearer <secret> ». */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
