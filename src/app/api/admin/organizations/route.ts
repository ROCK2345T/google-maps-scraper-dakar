import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireAdmin } from "@/lib/api";
import { generatePassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(150),
  contactName: z.string().trim().max(120).optional().default(""),
  contactEmail: z.string().trim().max(160).optional().default(""),
  contactPhone: z.string().trim().max(40).optional().default(""),
  plan: z.string().trim().min(1).max(40).default("pro"),
  monthlyLeadQuota: z.number().int().min(0).max(1_000_000),
  maxUsers: z.number().int().min(1).max(500),
  subscriptionEndsAt: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().default(""),
  ownerEmail: z.string().trim().toLowerCase().email("Email de connexion invalide"),
  ownerName: z.string().trim().max(120).optional().default(""),
  requestId: z.string().uuid().optional(),
});

export const GET = handler(async () => {
  await requireAdmin();
  const orgs = await db()`
    select o.*,
      (select count(*)::int from app.users u where u.organization_id = o.id) as users_count,
      (select count(*)::int from app.leads l where l.organization_id = o.id and l.created_at >= date_trunc('month', now())) as leads_this_month,
      (select max(u.last_login_at) from app.users u where u.organization_id = o.id) as last_login_at
    from app.organizations o order by o.created_at desc`;
  return ok({ organizations: orgs });
});

export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const b = await parseBody(req, schema);
  const sql = db();
  const exists = await sql`select 1 from app.users where email = ${b.ownerEmail}`;
  if (exists.length) throw new HttpError(409, "Un compte existe déjà avec cet email de connexion.");
  const password = generatePassword();
  const hash = await hashPassword(password);
  const ends = b.subscriptionEndsAt ? new Date(b.subscriptionEndsAt) : null;

  const orgId = await sql.begin(async (tx) => {
    const [org] = await tx<{ id: string }[]>`
      insert into app.organizations (name, contact_name, contact_email, contact_phone, plan, monthly_lead_quota, max_users, subscription_ends_at, notes)
      values (${b.name}, ${b.contactName || null}, ${b.contactEmail || null}, ${b.contactPhone || null}, ${b.plan},
              ${b.monthlyLeadQuota}, ${b.maxUsers}, ${ends}, ${b.notes || null})
      returning id`;
    await tx`
      insert into app.users (organization_id, email, password_hash, full_name, role)
      values (${org.id}, ${b.ownerEmail}, ${hash}, ${b.ownerName || b.contactName || null}, 'owner')`;
    if (b.requestId) await tx`update app.access_requests set status = 'converted' where id = ${b.requestId}`;
    return org.id;
  });
  await audit(admin, "organization_created", { name: b.name, ownerEmail: b.ownerEmail, plan: b.plan }, orgId);
  return ok({ id: orgId, credentials: { email: b.ownerEmail, password } });
});
