/**
 * Liens externes (sites web, réseaux sociaux) issus de données tierces :
 * seuls http(s) sont acceptés, ce qui écarte javascript:, data:, file:…
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^https?:\/\//i.test(v) || v.length > 2048) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
