import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: { default: "LeadScraper Dakar — Prospects B2B au Sénégal", template: "%s · LeadScraper Dakar" },
  description: "Trouvez en quelques clics les entreprises de Dakar et du Sénégal avec téléphones, WhatsApp, emails et réseaux sociaux. Export Excel prêt à l'emploi.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#00853f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
