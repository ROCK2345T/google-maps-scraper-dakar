import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { env } from "./env";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "ls_session";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------------------
// Mots de passe (scrypt natif Node, aucune dépendance)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Mot de passe lisible à communiquer à un client (ex : Kx7m-Pq4r-Zt9w). */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

/** Hachage factice (mot de passe inconnu) utilisé quand l'email n'existe pas. */
export const DUMMY_PASSWORD_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Utilisateur courant
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: "superadmin" | "owner" | "member";
  organizationId: string | null;
  organizationName: string | null;
  orgStatus: "active" | "suspended" | null;
  subscriptionEndsAt: Date | null;
  monthlyLeadQuota: number | null;
  sessionId: string;
};

/** Raison pour laquelle un compte client ne peut pas accéder au logiciel (null = accès OK). */
export function accessBlockReason(u: Pick<SessionUser, "role" | "orgStatus" | "subscriptionEndsAt">): string | null {
  if (u.role === "superadmin") return null;
  if (u.orgStatus === "suspended") return "suspended";
  if (u.subscriptionEndsAt && u.subscriptionEndsAt.getTime() < Date.now()) return "expired";
  return null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = db();
  const rows = await sql<
    {
      id: string;
      email: string;
      full_name: string | null;
      role: SessionUser["role"];
      organization_id: string | null;
      org_name: string | null;
      org_status: SessionUser["orgStatus"];
      subscription_ends_at: Date | null;
      monthly_lead_quota: number | null;
      session_id: string;
      last_seen_at: Date;
    }[]
  >`
    select u.id, u.email, u.full_name, u.role, u.organization_id,
           o.name as org_name, o.status as org_status, o.subscription_ends_at, o.monthly_lead_quota,
           s.id as session_id, s.last_seen_at
    from app.sessions s
    join app.users u on u.id = s.user_id
    left join app.organizations o on o.id = u.organization_id
    where s.id = ${hashToken(token)} and s.expires_at > now() and u.is_active
  `;
  const r = rows[0];
  if (!r) return null;
  // Rafraîchit l'activité au plus une fois toutes les 10 minutes.
  if (Date.now() - new Date(r.last_seen_at).getTime() > 10 * 60_000) {
    await sql`update app.sessions set last_seen_at = now(), expires_at = now() + ${SESSION_DAYS + " days"}::interval where id = ${r.session_id}`;
  }
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    organizationId: r.organization_id,
    organizationName: r.org_name,
    orgStatus: r.org_status,
    subscriptionEndsAt: r.subscription_ends_at ? new Date(r.subscription_ends_at) : null,
    monthlyLeadQuota: r.monthly_lead_quota,
    sessionId: r.session_id,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const ip = clientIp(h);
  await db()`
    insert into app.sessions (id, user_id, expires_at, ip, user_agent)
    values (${hashToken(token)}, ${userId}, now() + ${SESSION_DAYS + " days"}::interval, ${ip}, ${h.get("user-agent")?.slice(0, 300) ?? null})
  `;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`delete from app.sessions where id = ${hashToken(token)}`;
  jar.delete(SESSION_COOKIE);
}

export function clientIp(h: Headers): string | null {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Création automatique du super-administrateur à partir des variables d'environnement
// ---------------------------------------------------------------------------

let adminEnsured = false;

export async function ensureSuperAdmin() {
  if (adminEnsured) return;
  const email = env.adminEmail;
  const password = env.adminPassword;
  if (!email || !password) return;
  const sql = db();
  const existing = await sql`select id from app.users where email = ${email}`;
  if (existing.length === 0) {
    const hash = await hashPassword(password);
    await sql`
      insert into app.users (email, password_hash, full_name, role)
      values (${email}, ${hash}, 'Administrateur', 'superadmin')
      on conflict (email) do nothing
    `;
  }
  adminEnsured = true;
}
