import { ProxyAgent, type Dispatcher } from "undici";
import { env } from "../env";
import { assertPublicUrl } from "../security/url";
import { ProviderError } from "./types";

/** Empreintes de navigateurs réels, en rotation pour limiter la détection. */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
];

export function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const proxyAgents = new Map<string, Dispatcher>();
function proxyDispatcher(): Dispatcher | undefined {
  const urls = env.proxyUrls;
  if (!urls.length) return undefined;
  const url = urls[Math.floor(Math.random() * urls.length)];
  let agent = proxyAgents.get(url);
  if (!agent) {
    agent = new ProxyAgent(url);
    proxyAgents.set(url, agent);
  }
  return agent;
}

export type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
  /** Passe par les proxys / la passerelle anti-blocage si configurés. */
  stealth?: boolean;
  maxBytes?: number;
  /**
   * URL d'origine tierce (site d'une entreprise) : chaque saut de redirection est vérifié
   * pour ne jamais atteindre une adresse interne (protection SSRF).
   */
  publicOnly?: boolean;
};

/**
 * fetch robuste : délai maximum, nouvelles tentatives avec attente exponentielle,
 * rotation d'empreinte navigateur, proxys et passerelle anti-blocage optionnels.
 */
export async function robustFetch(url: string, opts: FetchOptions = {}): Promise<{ status: number; text: string; url: string }> {
  const { method = "GET", body, timeoutMs = 20_000, retries = 2, stealth = false, maxBytes = 6_000_000, publicOnly = false } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const useGateway = stealth && env.gatewayTemplate && method === "GET";
    const target = useGateway ? env.gatewayTemplate!.replace("{url}", encodeURIComponent(url)) : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), useGateway ? Math.max(timeoutMs, 60_000) : timeoutMs);
    try {
      const init: RequestInit & { dispatcher?: Dispatcher } = {
        method,
        body,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": randomUserAgent(),
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          ...opts.headers,
        },
      };
      if (stealth && !useGateway) {
        const d = proxyDispatcher();
        if (d) init.dispatcher = d;
      }
      let res: Response;
      if (publicOnly) {
        init.redirect = "manual";
        let current = target;
        for (let hop = 0; ; hop++) {
          await assertPublicUrl(current);
          res = await fetch(current, init as RequestInit);
          const location = res.headers.get("location");
          if (res.status < 300 || res.status >= 400 || !location) break;
          if (hop >= 4) throw new Error("Trop de redirections");
          await res.body?.cancel();
          current = new URL(location, current).toString();
        }
      } else {
        res = await fetch(target, init as RequestInit);
      }
      const buf = await readLimited(res, maxBytes);
      const text = new TextDecoder("utf-8").decode(buf);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new ProviderError(`HTTP ${res.status}`);
        await sleep(1500 * 2 ** attempt + Math.random() * 1000);
        continue;
      }
      return { status: res.status, text, url: res.url || url };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1000 * 2 ** attempt + Math.random() * 500);
    } finally {
      clearTimeout(timer);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new ProviderError(`Échec réseau (${msg})`);
}

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c.subarray(0, Math.min(c.length, total - off)), off);
    off += c.length;
    if (off >= total) break;
  }
  return out;
}
