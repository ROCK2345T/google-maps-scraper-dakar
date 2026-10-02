import { after } from "next/server";
import { handler, HttpError, ok, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { kickWorker, runTick } from "@/lib/scraper/worker";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Recherche introuvable");
  const url = new URL(req.url);
  const afterId = Number(url.searchParams.get("after") ?? 0) || 0;
  const sql = db();

  const [job] = await sql<{
    id: string; organization_id: string; title: string; status: string; stage: string; params: unknown;
    tasks_total: number; tasks_done: number; leads_count: number; message: string | null; error: string | null;
    provider_stats: Record<string, number>; log: unknown[]; created_at: Date; finished_at: Date | null;
    locked_until: Date | null; heartbeat_at: Date | null;
  }[]>`select * from app.jobs where id = ${id}`;
  if (!job || (user.role !== "superadmin" && job.organization_id !== user.organizationId)) throw new HttpError(404, "Recherche introuvable");

  const leads = await sql`
    select id, name, category, activity, zone, phone, operator, whatsapp, email, website, address,
           rating, reviews_count, facebook, instagram, linkedin, maps_url, source
    from app.leads where job_id = ${id} and id > ${afterId} order by id limit 500`;

  const [stats] = await sql<{ phones: number; emails: number; sites: number; whatsapp: number }[]>`
    select count(phone)::int as phones, count(email)::int as emails, count(website)::int as sites, count(whatsapp)::int as whatsapp
    from app.leads where job_id = ${id}`;

  // Filet de sécurité : si le moteur s'est arrêté (coupure, déploiement…), la consultation le relance.
  const active = job.status === "queued" || job.status === "running";
  const lockFree = !job.locked_until || new Date(job.locked_until).getTime() < Date.now();
  const stale = !job.heartbeat_at || Date.now() - new Date(job.heartbeat_at).getTime() > 20_000;
  if (active && lockFree && stale) {
    const origin = url.origin;
    after(async () => {
      const r = await runTick(id);
      if (r.more) await kickWorker(origin, id);
    });
  }

  const { locked_until, heartbeat_at, organization_id, ...publicJob } = job;
  void locked_until; void heartbeat_at; void organization_id;
  return ok({ job: publicJob, leads, stats });
});
