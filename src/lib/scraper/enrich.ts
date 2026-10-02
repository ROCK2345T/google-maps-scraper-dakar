import { robustFetch } from "./fetcher";
import { findSenegalPhones } from "./phone";

export type Enrichment = {
  emails: string[];
  email: string | null;
  phones: string[];
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
  whatsapp: string | null;
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const BAD_EMAIL = /(\.(png|jpe?g|gif|svg|webp|css|js|ico)$)|example\.|exemple\.|sentry|wixpress|domain\.com|yourdomain|@2x|godaddy|cloudflare|schema\.org|wordpress\.(org|com)$|@email\.com$|@mail\.com$|@test\./i;
/** Adresses factices laissées par les modèles de sites (email@gmail.com, votre@…, nom@…). */
const PLACEHOLDER_USER = /^(email|e-mail|votre|your|nom|name|prenom|username|test|exemple|example|jean|john|jane)(\.[a-z]+)?$/i;
const SKIP_HOSTS = /(facebook|instagram|google|linkedin|twitter|x|tiktok|youtube|wa|whatsapp|linktr|bit)\.(com|ee|ly|me)$/i;
const CONTACT_HINT = /contact|nous-contacter|contactez|about|a-propos|qui-sommes|mentions|coordonn/i;
const PREFERRED = ["contact@", "info@", "commercial@", "direction@", "hello@", "bonjour@", "accueil@", "sales@", "admin@"];

function decodeEntities(s: string) {
  return s.replace(/&#64;|&#x40;|\[at\]|\(at\)| at /gi, "@").replace(/&amp;/g, "&").replace(/&#46;|\[dot\]|\(dot\)/gi, ".");
}

function findSocial(html: string, re: RegExp, exclude?: RegExp): string | null {
  for (const m of html.matchAll(re)) {
    const url = m[0].replace(/["'<>\s\\].*$/, "");
    if (!exclude || !exclude.test(url)) return url;
  }
  return null;
}

/** Explore le site officiel (accueil + pages contact) pour trouver emails, téléphones et réseaux sociaux. */
export async function enrichWebsite(website: string, timeoutMs = 9_000): Promise<Enrichment | null> {
  let base: URL;
  try {
    base = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  } catch {
    return null;
  }
  if (SKIP_HOSTS.test(base.hostname.replace(/^www\./, ""))) return null;

  const emails = new Set<string>();
  const phones = new Set<string>();
  const result: Enrichment = {
    emails: [], email: null, phones: [], facebook: null, instagram: null,
    linkedin: null, twitter: null, tiktok: null, youtube: null, whatsapp: null,
  };

  const queue = [base.toString()];
  const seen = new Set<string>();
  for (let i = 0; i < queue.length && i < 4; i++) {
    const url = queue[i];
    if (seen.has(url)) continue;
    seen.add(url);
    let html: string;
    try {
      const res = await robustFetch(url, { timeoutMs, retries: 0, maxBytes: 1_500_000 });
      if (res.status >= 400) continue;
      html = res.text;
    } catch {
      continue;
    }
    const text = decodeEntities(html);
    for (const m of text.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(decodeURIComponent(m[1]).toLowerCase());
    for (const m of text.match(EMAIL_RE) ?? []) emails.add(m.toLowerCase());
    for (const m of text.matchAll(/tel:([+\d\s().-]{8,20})/gi)) findSenegalPhones(m[1]).forEach((p) => phones.add(p));
    findSenegalPhones(html.replace(/<[^>]+>/g, " ")).slice(0, 5).forEach((p) => phones.add(p));

    result.facebook ??= findSocial(html, /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[^"'<>\s]+/gi, /sharer|share\.php|dialog|plugins|tr\?/i);
    result.instagram ??= findSocial(html, /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/gi, /\/(p|reel|explore)\//i);
    result.linkedin ??= findSocial(html, /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[^"'<>\s]+/gi);
    result.twitter ??= findSocial(html, /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/gi, /intent|share|home$/i);
    result.tiktok ??= findSocial(html, /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/gi);
    result.youtube ??= findSocial(html, /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[^"'<>\s]+/gi);
    result.whatsapp ??= findSocial(html, /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)[^"'<>\s]*/gi);

    if (i === 0) {
      for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
        if (!CONTACT_HINT.test(m[1])) continue;
        try {
          const link = new URL(m[1], url);
          if (link.hostname === base.hostname && !seen.has(link.toString()) && queue.length < 4) queue.push(link.toString());
        } catch {
          /* lien invalide */
        }
      }
    }
    if (emails.size > 0 && i >= 1) break;
  }

  const clean = [...emails]
    .map((e) => e.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,24}$/i.test(e) && !BAD_EMAIL.test(e) && !PLACEHOLDER_USER.test(e.split("@")[0]) && e.length < 80);
  const unique = [...new Set(clean)].sort((a, b) => {
    const sameDomain = (e: string) => (e.endsWith(base.hostname.replace(/^www\./, "")) ? 0 : 1);
    return sameDomain(a) - sameDomain(b);
  });
  result.emails = unique.slice(0, 6);
  result.email = unique.find((e) => PREFERRED.some((p) => e.startsWith(p))) ?? unique[0] ?? null;
  result.phones = [...phones].slice(0, 4);
  return result;
}
