import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { accessBlockReason, clientIp, ensureSuperAdmin, getSessionUser, type SessionUser } from "./auth";
import { db } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Enveloppe toutes les routes API : erreurs propres en français, jamais de stack trace exposée. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json({ error: first ? `${first.path.join(".")}: ${first.message}` : "Données invalides" }, { status: 400 });
      }
      console.error("[api] erreur inattendue", err);
      return NextResponse.json({ error: "Erreur interne. Réessayez dans un instant." }, { status: 500 });
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Corps de requête JSON invalide");
  }
  return schema.parse(raw);
}

/**
 * Protection CSRF : les requêtes qui modifient des données doivent venir de notre propre domaine.
 * (En complément du cookie SameSite=Lax.) Une requête sans en-tête Origin n'est acceptée
 * que si le navigateur confirme qu'elle n'est pas inter-sites.
 */
export async function assertSameOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = h.get("origin");
  const fetchSite = h.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new HttpError(403, "Origine refusée");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new HttpError(403, "Origine refusée");
    }
    if (!host || originHost !== host) throw new HttpError(403, "Origine refusée");
  } else if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpError(403, "Origine refusée");
  }
}

export { bearerMatches } from "./security/secrets";

export async function requireUser(opts: { allowBlocked?: boolean } = {}): Promise<SessionUser> {
  await ensureSuperAdmin();
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Session expirée. Veuillez vous reconnecter.");
  if (!opts.allowBlocked) {
    const reason = accessBlockReason(user);
    if (reason === "suspended") throw new HttpError(403, "L'accès de votre entreprise est suspendu. Contactez votre fournisseur.");
    if (reason === "expired") throw new HttpError(403, "Votre abonnement a expiré. Contactez votre fournisseur pour le renouveler.");
  }
  return user;
}

export async function requireClient(): Promise<SessionUser & { organizationId: string }> {
  const user = await requireUser();
  if (!user.organizationId) throw new HttpError(403, "Cet espace est réservé aux comptes entreprise.");
  return user as SessionUser & { organizationId: string };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "superadmin") throw new HttpError(403, "Accès réservé à l'administrateur.");
  return user;
}

export async function audit(
  actor: { id: string; email: string } | null,
  action: string,
  details: Record<string, unknown> = {},
  organizationId: string | null = null,
) {
  try {
    const h = await headers();
    await db()`
      insert into app.audit_logs (actor_user_id, actor_email, organization_id, action, details, ip)
      values (${actor?.id ?? null}, ${actor?.email ?? null}, ${organizationId}, ${action}, ${db().json(details as never)}, ${clientIp(h)})
    `;
  } catch (e) {
    console.error("[audit] échec", e);
  }
}
