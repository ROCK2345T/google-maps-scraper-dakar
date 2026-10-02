/** Appel JSON vers nos routes API avec message d'erreur lisible. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* pas de JSON */
  }
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/auth/login")) {
    window.location.href = "/login?expired=1";
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
