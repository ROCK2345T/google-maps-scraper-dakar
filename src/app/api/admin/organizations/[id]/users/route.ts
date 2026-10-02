import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireAdmin } from "@/lib/api";
import { generatePassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  fullName: z.string().trim().max(120).optional().default(""),
  role: z.enum(["owner", "member"]).default("member"),
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const b = await parseBody(req, schema);
  const sql = db();
  const [org] = await sql<{ max_users: number; n: number }[]>`
    select max_users, (select count(*)::int from app.users where organization_id = o.id) as n from app.organizations o where id = ${id}`;
  if (!org) throw new HttpError(404, "Client introuvable");
  if (org.n >= org.max_users) throw new HttpError(400, `Limite atteinte : ${org.max_users} utilisateur(s) pour ce client. Augmentez la limite d'abord.`);
  if ((await sql`select 1 from app.users where email = ${b.email}`).length) throw new HttpError(409, "Cet email est déjà utilisé.");
  const password = generatePassword();
  await sql`
    insert into app.users (organization_id, email, password_hash, full_name, role)
    values (${id}, ${b.email}, ${await hashPassword(password)}, ${b.fullName || null}, ${b.role})`;
  await audit(admin, "user_created", { email: b.email, role: b.role }, id);
  return ok({ credentials: { email: b.email, password } });
});
