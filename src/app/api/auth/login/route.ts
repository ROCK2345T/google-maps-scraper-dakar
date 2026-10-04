import { headers } from "next/headers";
import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody } from "@/lib/api";
import { accessBlockReason, clientIp, createSession, DUMMY_PASSWORD_HASH, ensureSuperAdmin, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Email invalide"), password: z.string().min(1).max(200) });

export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  await ensureSuperAdmin();
  const { email, password } = await parseBody(req, schema);
  const ip = clientIp(await headers());
  const sql = db();

  // Anti force brute : 8 échecs en 15 minutes par email ou 30 par IP.
  const [{ by_email, by_ip }] = await sql<{ by_email: number; by_ip: number }[]>`
    select
      count(*) filter (where email = ${email})::int as by_email,
      count(*) filter (where ip = ${ip})::int as by_ip
    from app.login_attempts where success = false and created_at > now() - interval '15 minutes'`;
  if (by_email >= 8 || by_ip >= 30) throw new HttpError(429, "Trop de tentatives. Patientez 15 minutes avant de réessayer.");

  const [user] = await sql<{
    id: string; email: string; password_hash: string; role: "superadmin" | "owner" | "member"; is_active: boolean;
    org_status: "active" | "suspended" | null; subscription_ends_at: Date | null; organization_id: string | null;
  }[]>`
    select u.id, u.email, u.password_hash, u.role, u.is_active, u.organization_id,
           o.status as org_status, o.subscription_ends_at
    from app.users u left join app.organizations o on o.id = u.organization_id
    where u.email = ${email}`;

  // Toujours calculer un hachage : le temps de réponse ne révèle pas si l'email existe.
  const valid = (await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH)) && !!user;
  await sql`insert into app.login_attempts (email, ip, success) values (${email}, ${ip}, ${!!valid})`;
  if (!user || !valid) throw new HttpError(401, "Email ou mot de passe incorrect.");
  if (!user.is_active) throw new HttpError(403, "Ce compte a été désactivé. Contactez votre fournisseur.");

  const reason = accessBlockReason({
    role: user.role,
    orgStatus: user.org_status,
    subscriptionEndsAt: user.subscription_ends_at ? new Date(user.subscription_ends_at) : null,
  });
  if (reason === "suspended") throw new HttpError(403, "L'accès de votre entreprise est suspendu. Contactez votre fournisseur.");
  if (reason === "expired") throw new HttpError(403, "Votre abonnement a expiré. Contactez votre fournisseur pour le renouveler.");

  await createSession(user.id);
  await sql`update app.users set last_login_at = now() where id = ${user.id}`;
  await audit({ id: user.id, email: user.email }, "login", {}, user.organization_id);
  return ok({ redirect: user.role === "superadmin" ? "/admin" : "/app" });
});
