/** Outils numéros sénégalais (+221) : normalisation, opérateur, lien WhatsApp. */

export type PhoneInfo = { display: string; intl: string; operator: string; whatsapp: string };

const OPERATORS: Record<string, string> = {
  "77": "Orange",
  "78": "Orange",
  "76": "Free",
  "70": "Expresso",
  "75": "Promobile",
  "71": "Orange",
  "33": "Fixe",
  "30": "Fixe",
};

export function normalizePhone(raw: string | null | undefined): PhoneInfo | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  const plain = digits.replace(/\D/g, "");
  if (plain.length < 7) return null;

  let national: string | null = null;
  if (plain.startsWith("221") && plain.length === 12) national = plain.slice(3);
  else if (plain.length === 9 && /^[37]/.test(plain)) national = plain;

  if (national) {
    const display = `+221 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`;
    const operator = OPERATORS[national.slice(0, 2)] ?? "";
    const mobile = national.startsWith("7");
    return {
      display,
      intl: `+221${national}`,
      operator,
      whatsapp: mobile ? `https://wa.me/221${national}` : "",
    };
  }
  // Numéro étranger : on le garde tel quel.
  const intl = digits.startsWith("+") ? digits : plain;
  return { display: raw.trim(), intl, operator: "", whatsapp: digits.startsWith("+") ? `https://wa.me/${plain}` : "" };
}

/** Trouve les numéros sénégalais dans un texte libre. */
export function findSenegalPhones(text: string): string[] {
  const re = /(?:\+|00)?221[\s.\-]?(?:7[05678]|3[03])[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}|\b(?:7[05678]|3[03])[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/g;
  const out = new Set<string>();
  for (const m of text.match(re) ?? []) {
    const info = normalizePhone(m);
    if (info) out.add(info.display);
  }
  return [...out];
}
