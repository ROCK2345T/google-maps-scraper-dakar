import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.string().trim().max(160).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  plan: z.string().trim().min(1).max(40).optional(),
  monthlyLeadQuota: z.number().int().min(0).max(1_000_000).optional(),
  maxUsers: z.number().int().min(1).max(500).optional(),
  subscriptionEndsAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "suspended"]).optional(),
  suspendedReason: z.string().max(300).nullable().optional(),
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const b = await parseBody(req, schema);
  const sql = db();
  const [org] = await sql<{ id: string; status: string; name: string }[]>`select id, status, name from app.organizations where id = ${id}`;
  if (!org) throw new HttpError(404, "Client introuvable");

  const has = (k: keyof typeof b) => Object.prototype.hasOwnProperty.call(b, k);
  await sql`
    update app.organizations set
      name = ${has("name") ? b.name! : org.name},
      contact_name = case when ${has("contactName")} then ${b.contactName ?? null} else contact_name end,
      contact_email = case when ${has("contactEmail")} then ${b.contactEmail ?? null} else contact_email end,
      contact_phone = case when ${has("contactPhone")} then ${b.contactPhone ?? null} else contact_phone end,
      plan = coalesce(${b.plan ?? null}, plan),
      monthly_lead_quota = coalesce(${b.monthlyLeadQuota ?? null}, monthly_lead_quota),
      max_users = coalesce(${b.maxUsers ?? null}, max_users),
      subscription_ends_at = case when ${has("subscriptionEndsAt")} then ${b.subscriptionEndsAt ? new Date(b.subscriptionEndsAt) : null}::timestamptz else subscription_ends_at end,
      notes = case when ${has("notes")} then ${b.notes ?? null} else notes end,
      status = coalesce(${b.status ?? null}, status),
      suspended_reason = case when ${b.status === "suspended"} then ${b.suspendedReason ?? null} when ${b.status === "active"} then null else suspended_reason end,
      suspended_at = case when ${b.status === "suspended"} then now() when ${b.status === "active"} then null else suspended_at end,
      updated_at = now()
    where id = ${id}`;

  if (b.status === "suspended" && org.status !== "suspended") {
    // Coupure immédiate : toutes les sessions du client sont fermées et ses recherches arrêtées.
    await sql`delete from app.sessions where user_id in (select id from app.users where organization_id = ${id})`;
    await sql`update app.jobs set status = 'cancelled', stage = 'done', finished_at = now(), message = 'Accès suspendu'
              where organization_id = ${id} and status in ('queued','running')`;
    await audit(admin, "organization_suspended", { reason: b.suspendedReason ?? null }, id);
  } else if (b.status === "active" && org.status !== "active") {
    await audit(admin, "organization_reactivated", {}, id);
  } else {
    await audit(admin, "organization_updated", { fields: Object.keys(b) }, id);
  }
  return ok({ ok: true });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const [org] = await db()<{ name: string }[]>`delete from app.organizations where id = ${id} returning name`;
  if (!org) throw new HttpError(404, "Client introuvable");
  await audit(admin, "organization_deleted", { name: org.name }, null);
  return ok({ ok: true });
});
