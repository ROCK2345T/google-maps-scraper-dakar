import { audit, assertSameOrigin, handler, HttpError, ok, requireUser } from "@/lib/api";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const user = await requireUser();
  const { id } = await ctx.params;
  const rows = await db()`
    update app.jobs set status = 'cancelled', stage = 'done', finished_at = now(), message = 'Arrêtée par l''utilisateur'
    where id = ${id} and status in ('queued','running')
      and (${user.role === "superadmin"} or organization_id = ${user.organizationId})
    returning id`;
  if (!rows.length) throw new HttpError(404, "Recherche introuvable ou déjà terminée");
  await audit(user, "job_cancelled", { jobId: id }, user.organizationId);
  return ok({ ok: true });
});
