import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireAdmin } from "@/lib/api";
import { generatePassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  action: z.enum(["reset_password", "activate", "deactivate", "logout_everywhere"]),
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { action } = await parseBody(req, schema);
  const sql = db();
  const [user] = await sql<{ id: string; email: string; role: string; organization_id: string | null }[]>`
    select id, email, role, organization_id from app.users where id = ${id}`;
  if (!user) throw new HttpError(404, "Utilisateur introuvable");
  if (user.role === "superadmin" && action !== "reset_password") throw new HttpError(400, "Action impossible sur l'administrateur.");

  let result: Record<string, unknown> = { ok: true };
  if (action === "reset_password") {
    const password = generatePassword();
    await sql`update app.users set password_hash = ${await hashPassword(password)}, updated_at = now() where id = ${id}`;
    await sql`delete from app.sessions where user_id = ${id}`;
    result = { credentials: { email: user.email, password } };
  } else if (action === "activate" || action === "deactivate") {
    await sql`update app.users set is_active = ${action === "activate"}, updated_at = now() where id = ${id}`;
    if (action === "deactivate") await sql`delete from app.sessions where user_id = ${id}`;
  } else {
    await sql`delete from app.sessions where user_id = ${id}`;
  }
  await audit(admin, `user_${action}`, { email: user.email }, user.organization_id);
  return ok(result);
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const [u] = await db()<{ email: string; organization_id: string | null }[]>`
    delete from app.users where id = ${id} and role <> 'superadmin' returning email, organization_id`;
  if (!u) throw new HttpError(404, "Utilisateur introuvable");
  await audit(admin, "user_deleted", { email: u.email }, u.organization_id);
  return ok({ ok: true });
});
