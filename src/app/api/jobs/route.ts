import { after } from "next/server";
import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireClient } from "@/lib/api";
import { db } from "@/lib/db";
import { ZONE_BY_ID } from "@/lib/data/zones";
import { createJob, runTick, kickWorker } from "@/lib/scraper/worker";

export const maxDuration = 300;

const schema = z.object({
  keywords: z.array(z.string().trim().min(2).max(80)).min(1, "Choisissez au moins une activité").max(15),
  zoneIds: z.array(z.string()).min(1, "Choisissez au moins une zone").max(20),
  limitPerQuery: z.number().int().min(5).max(120),
  enrich: z.boolean(),
});

export const GET = handler(async () => {
  const user = await requireClient();
  const jobs = await db()`
    select id, title, status, stage, tasks_total, tasks_done, leads_count, message, created_at, finished_at
    from app.jobs where organization_id = ${user.organizationId}
    order by created_at desc limit 100`;
  return ok({ jobs });
});

export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  const user = await requireClient();
  const body = await parseBody(req, schema);
  const zoneIds = body.zoneIds.filter((id) => ZONE_BY_ID.has(id));
  if (!zoneIds.length) throw new HttpError(400, "Zone inconnue");
  const keywords = [...new Set(body.keywords.map((k) => k.trim()))];
  if (keywords.length * zoneIds.length > 60) throw new HttpError(400, "Trop de combinaisons (max 60 activités × zones par recherche).");

  const [{ active }] = await db()<{ active: number }[]>`
    select count(*)::int as active from app.jobs where organization_id = ${user.organizationId} and status in ('queued','running')`;
  if (active >= 3) throw new HttpError(429, "3 recherches sont déjà en cours. Attendez qu'une se termine.");

  const zonesLabel = zoneIds.map((id) => ZONE_BY_ID.get(id)!.name);
  const title = `${keywords.slice(0, 2).join(", ")}${keywords.length > 2 ? ` +${keywords.length - 2}` : ""} — ${zonesLabel.slice(0, 2).join(", ")}${zonesLabel.length > 2 ? ` +${zonesLabel.length - 2}` : ""}`;
  const jobId = await createJob({
    organizationId: user.organizationId,
    userId: user.id,
    title,
    params: { keywords, zoneIds, limitPerQuery: body.limitPerQuery, enrich: body.enrich },
  });
  await audit(user, "job_created", { jobId, title }, user.organizationId);

  const origin = new URL(req.url).origin;
  after(async () => {
    const r = await runTick(jobId);
    if (r.more) await kickWorker(origin, jobId);
  });
  return ok({ id: jobId });
});
