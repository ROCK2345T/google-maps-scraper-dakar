import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export { safeHttpUrl } from "./safe-url";

/** Adresse IP privée, locale, réservée ou de métadonnées cloud (protection SSRF). */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

/**
 * Vérifie qu'une URL externe peut être visitée sans risque :
 * protocole http(s), port standard, nom d'hôte public qui ne résout vers aucune IP interne.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Protocole refusé");
  if (u.username || u.password) throw new Error("Identifiants dans l'URL refusés");
  if (u.port && !["80", "443", "8080"].includes(u.port)) throw new Error("Port refusé");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new Error("Hôte interne refusé");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Adresse IP interne refusée");
    return u;
  }
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Hôte résolu vers une adresse interne");
  return u;
}
