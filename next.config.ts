import type { NextConfig } from "next";

/**
 * Politique de sécurité du contenu : seules nos propres ressources (et Google Fonts) sont chargées,
 * la page ne peut pas être intégrée dans un autre site, les formulaires ne postent que chez nous.
 * ('unsafe-inline' reste nécessaire pour les scripts d'hydratation de Next.js.)
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  async headers() {
    // Les réponses de l'API ne doivent jamais être mises en cache par un intermédiaire.
    const noStore = { key: "Cache-Control", value: "no-store, max-age=0" };
    return [
      { source: "/api/(.*)", headers: [noStore] },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
