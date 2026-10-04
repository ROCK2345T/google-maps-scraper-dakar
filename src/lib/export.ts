import ExcelJS from "exceljs";
import { safeHttpUrl } from "./security/safe-url";

export type LeadRow = {
  name: string;
  category: string | null;
  activity: string | null;
  zone: string | null;
  phone: string | null;
  operator: string | null;
  whatsapp: string | null;
  email: string | null;
  emails: string[] | null;
  website: string | null;
  address: string | null;
  rating: string | number | null;
  reviews_count: number | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
  tiktok: string | null;
  opening_hours: string | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  source: string | null;
};

const COLUMNS: { key: keyof LeadRow | "otherEmails"; header: string; width: number; link?: boolean }[] = [
  { key: "name", header: "Entreprise", width: 34 },
  { key: "category", header: "Catégorie", width: 22 },
  { key: "activity", header: "Activité recherchée", width: 22 },
  { key: "zone", header: "Zone", width: 20 },
  { key: "phone", header: "Téléphone", width: 19 },
  { key: "operator", header: "Opérateur", width: 11 },
  { key: "whatsapp", header: "WhatsApp", width: 26, link: true },
  { key: "email", header: "Email", width: 30, link: true },
  { key: "otherEmails", header: "Autres emails", width: 30 },
  { key: "website", header: "Site web", width: 32, link: true },
  { key: "address", header: "Adresse", width: 42 },
  { key: "rating", header: "Note", width: 7 },
  { key: "reviews_count", header: "Avis", width: 7 },
  { key: "facebook", header: "Facebook", width: 28, link: true },
  { key: "instagram", header: "Instagram", width: 28, link: true },
  { key: "linkedin", header: "LinkedIn", width: 28, link: true },
  { key: "twitter", header: "Twitter / X", width: 24, link: true },
  { key: "tiktok", header: "TikTok", width: 24, link: true },
  { key: "opening_hours", header: "Horaires", width: 30 },
  { key: "latitude", header: "Latitude", width: 11 },
  { key: "longitude", header: "Longitude", width: 11 },
  { key: "maps_url", header: "Google Maps", width: 26, link: true },
  { key: "source", header: "Source", width: 13 },
];

function cellValue(lead: LeadRow, key: (typeof COLUMNS)[number]["key"]) {
  if (key === "otherEmails") return (lead.emails ?? []).filter((e) => e !== lead.email).join(", ");
  if (key === "rating") return lead.rating != null ? Number(lead.rating) : null;
  return lead[key] ?? null;
}

const GREEN = "FF00853F";

export async function buildWorkbook(leads: LeadRow[], meta: { title: string; company: string; generatedAt: Date; params?: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LeadScraper Dakar";
  wb.created = meta.generatedAt;

  const ws = wb.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1, xSplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const header = ws.getRow(1);
  header.height = 26;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  leads.forEach((lead, idx) => {
    const row = ws.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, cellValue(lead, c.key)])));
    row.height = 20;
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.alignment = { vertical: "middle" };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F8F5" } };
      const v = cell.value;
      const target = typeof v === "string" && v ? (c.key === "email" ? (/^[^\s@]+@[^\s@]+$/.test(v) ? `mailto:${v}` : null) : safeHttpUrl(v)) : null;
      if (c.link && typeof v === "string" && target) {
        cell.value = { text: v, hyperlink: target };
        cell.font = { color: { argb: "FF0B63CE" }, underline: true };
      }
    });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  // Feuille de synthèse
  const s = wb.addWorksheet("Résumé");
  s.columns = [{ width: 32 }, { width: 60 }];
  const withPhone = leads.filter((l) => l.phone).length;
  const withEmail = leads.filter((l) => l.email).length;
  const withSite = leads.filter((l) => l.website).length;
  const withWa = leads.filter((l) => l.whatsapp).length;
  const lines: [string, string | number][] = [
    ["Rapport", meta.title],
    ["Entreprise cliente", meta.company],
    ["Généré le", meta.generatedAt.toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })],
    ...(meta.params ? ([["Paramètres", meta.params]] as [string, string][]) : []),
    ["", ""],
    ["Entreprises", leads.length],
    ["Avec téléphone", withPhone],
    ["Avec WhatsApp (mobile)", withWa],
    ["Avec email", withEmail],
    ["Avec site web", withSite],
  ];
  lines.forEach(([k, v], i) => {
    const r = s.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: GREEN } };
      r.getCell(2).font = { bold: true, size: 14 };
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Protection contre l'injection de formules (CSV injection) : une cellule commençant par
 * = + - @ serait exécutée par Excel. Les numéros de téléphone (+221 …) restent intacts.
 */
export function neutralizeFormula(s: string): string {
  if (!/^[=+\-@\t\r]/.test(s)) return s;
  if (/^[+-]?[\d\s().]+$/.test(s)) return s;
  return `'${s}`;
}

/** CSV compatible Excel français : séparateur « ; » et BOM UTF-8 pour les accents. */
export function buildCsv(leads: LeadRow[]): string {
  const esc = (v: unknown) => {
    const s = neutralizeFormula(v == null ? "" : String(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.map((c) => c.header).join(";")];
  for (const l of leads) lines.push(COLUMNS.map((c) => esc(cellValue(l, c.key))).join(";"));
  return "﻿" + lines.join("\r\n");
}

export function safeFilename(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "leads";
}
