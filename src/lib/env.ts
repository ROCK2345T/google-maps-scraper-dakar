/**
 * Configuration centralisée. Toutes les variables d'environnement sont lues ici,
 * jamais ailleurs, pour qu'un seul fichier documente ce dont l'application a besoin.
 */

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function list(name: string): string[] {
  return (read(name) ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  get databaseUrl() {
    return read("DATABASE_URL");
  },
  get adminEmail() {
    return read("ADMIN_EMAIL")?.toLowerCase();
  },
  get adminPassword() {
    return read("ADMIN_PASSWORD");
  },
  get workerSecret() {
    return read("WORKER_SECRET");
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
  /** URL publique de l'application (sinon déduite de Vercel ou de la requête). */
  get appUrl() {
    const explicit = read("APP_URL");
    if (explicit) return explicit.replace(/\/$/, "");
    const prod = read("VERCEL_PROJECT_PRODUCTION_URL");
    if (prod) return `https://${prod}`;
    const url = read("VERCEL_URL");
    return url ? `https://${url}` : undefined;
  },

  // --- Sources de données (toutes optionnelles : OpenStreetMap fonctionne sans clé) ---
  get googlePlacesApiKey() {
    return read("GOOGLE_PLACES_API_KEY");
  },
  get serpApiKey() {
    return read("SERPAPI_API_KEY");
  },
  /** Liste de proxys HTTP(S) en rotation : http://user:pass@host:port */
  get proxyUrls() {
    return list("SCRAPER_PROXY_URLS");
  },
  /**
   * Passerelle anti-blocage (ScraperAPI, ScrapingBee, ZenRows...).
   * Exemple : https://api.scraperapi.com/?api_key=XXX&url={url}
   */
  get gatewayTemplate() {
    const t = read("SCRAPER_GATEWAY_URL");
    return t && t.includes("{url}") ? t : undefined;
  },
  get disableGoogleWeb() {
    return read("DISABLE_GOOGLE_WEB") === "true";
  },
  get providerOrder() {
    return list("SCRAPER_PROVIDER_ORDER");
  },
  get overpassEndpoints() {
    const custom = list("OVERPASS_ENDPOINTS");
    return custom.length
      ? custom
      : [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.kumi.systems/api/interpreter",
          "https://overpass.private.coffee/api/interpreter",
          "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
        ];
  },

  // --- Marque / support (visibles côté client) ---
  get appName() {
    return read("NEXT_PUBLIC_APP_NAME") ?? "LeadScraper Dakar";
  },
  get supportWhatsapp() {
    return read("NEXT_PUBLIC_SUPPORT_WHATSAPP");
  },
  get supportEmail() {
    return read("NEXT_PUBLIC_SUPPORT_EMAIL");
  },
};

/** Description des variables pour la page « Système » de l'administration. */
export function envReport() {
  const items = [
    { key: "DATABASE_URL", ok: !!env.databaseUrl, required: true, help: "Connexion PostgreSQL (Supabase, pooler port 6543)." },
    { key: "ADMIN_EMAIL / ADMIN_PASSWORD", ok: !!env.adminEmail && !!env.adminPassword, required: true, help: "Compte super-administrateur créé automatiquement." },
    { key: "WORKER_SECRET", ok: !!env.workerSecret, required: true, help: "Protège le moteur de traitement en arrière-plan." },
    { key: "CRON_SECRET", ok: !!env.cronSecret, required: false, help: "Protège la tâche planifiée quotidienne de maintenance." },
    { key: "GOOGLE_PLACES_API_KEY", ok: !!env.googlePlacesApiKey, required: false, help: "Source officielle Google (la plus fiable, 1 000 requêtes gratuites/mois)." },
    { key: "SERPAPI_API_KEY", ok: !!env.serpApiKey, required: false, help: "Source Google Maps via SerpAPI (250 recherches gratuites/mois)." },
    { key: "SCRAPER_PROXY_URLS", ok: env.proxyUrls.length > 0, required: false, help: "Proxys résidentiels en rotation pour le scraping Google direct." },
    { key: "SCRAPER_GATEWAY_URL", ok: !!env.gatewayTemplate, required: false, help: "Passerelle anti-blocage (ScraperAPI, ScrapingBee…) avec {url}." },
    { key: "NEXT_PUBLIC_SUPPORT_WHATSAPP", ok: !!env.supportWhatsapp, required: false, help: "Numéro WhatsApp affiché aux clients (ex : 221771234567)." },
  ];
  return items;
}
