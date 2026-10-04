import { after } from "next/server";
import { audit, assertSameOrigin, handler, HttpError, ok, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { kickWorker, runTick } from "@/lib/scraper/worker";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Relance une recherche échouée ou bloquée : les étapes en échec sont remises en file. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const sql = db();
  const r = await sql`
    update app.jobs set status = 'running', finished_at = null, error = null, locked_until = null,
      stage = case when stage = 'done' then 'search' else stage end, message = 'Relancée par l''administrateur'
    where id = ${id} returning id`;
  if (!r.length) throw new HttpError(404, "Recherche introuvable");
  await sql`update app.job_tasks set status = 'pending', attempts = 0 where job_id = ${id} and status = 'failed'`;
  await audit(admin, "job_retried", { jobId: id });
  const origin = new URL(req.url).origin;
  after(async () => {
    const t = await runTick(id);
    if (t.more) await kickWorker(origin, id);
  });
  return ok({ ok: true });
});
