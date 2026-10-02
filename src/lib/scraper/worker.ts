import { randomUUID } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { osmFiltersFor } from "../data/sectors";
import { ZONE_BY_ID } from "../data/zones";
import { enrichWebsite } from "./enrich";
import { runSearch } from "./engine";
import { normalizePhone } from "./phone";
import type { RawPlace } from "./types";

/** Paramètres d'une recherche lancée par un client. */
export type JobParams = {
  keywords: string[];
  zoneIds: string[];
  limitPerQuery: number;
  enrich: boolean;
};

type JobRow = {
  id: string;
  organization_id: string;
  status: string;
  stage: string;
  params: JobParams;
  tasks_total: number;
};

type TaskRow = {
  id: number;
  kind: "search" | "enrich";
  payload: { keyword?: string; zoneId?: string; leadIds?: number[] };
  attempts: number;
};

const TICK_BUDGET_MS = 230_000; // la fonction dispose de 300 s ; on garde une marge.
const LOCK_SECONDS = 290;
const MAX_TASK_ATTEMPTS = 3;
const ENRICH_BATCH = 6;

// ---------------------------------------------------------------------------
// Création des tâches
// ---------------------------------------------------------------------------

export async function createJob(opts: { organizationId: string; userId: string; title: string; params: JobParams }) {
  const sql = db();
  return sql.begin(async (tx) => {
    const [job] = await tx<{ id: string }[]>`
      insert into app.jobs (organization_id, user_id, title, params, status, message)
      values (${opts.organizationId}, ${opts.userId}, ${opts.title}, ${tx.json(opts.params as never)}, 'queued', 'En file d''attente…')
      returning id
    `;
    const tasks: { job_id: string; kind: string; position: number; payload: unknown }[] = [];
    let pos = 0;
    for (const zoneId of opts.params.zoneIds)
      for (const keyword of opts.params.keywords) tasks.push({ job_id: job.id, kind: "search", position: pos++, payload: { keyword, zoneId } });
    for (const t of tasks) {
      await tx`insert into app.job_tasks (job_id, kind, position, payload) values (${t.job_id}, ${t.kind}, ${t.position}, ${tx.json(t.payload as never)})`;
    }
    await tx`update app.jobs set tasks_total = ${tasks.length} where id = ${job.id}`;
    return job.id;
  });
}

// ---------------------------------------------------------------------------
// Journal visible par le client
// ---------------------------------------------------------------------------

async function log(jobId: string, msg: string, level: "info" | "success" | "warning" | "error" = "info") {
  const entry = { t: new Date().toISOString(), level, msg };
  await db()`
    update app.jobs set log = (
      select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
        select e, ord from jsonb_array_elements(log || ${db().json([entry] as never)}::jsonb) with ordinality as x(e, ord)
        order by ord desc limit 80
      ) s
    ), heartbeat_at = now()
    where id = ${jobId}
  `;
}

// ---------------------------------------------------------------------------
// Boucle de traitement
// ---------------------------------------------------------------------------

/** Traite une portion d'un travail. Retourne true s'il reste du travail. */
export async function runTick(preferredJobId?: string): Promise<{ jobId: string | null; more: boolean }> {
  const sql = db();
  const lockId = randomUUID();
  const started = Date.now();

  const candidates = preferredJobId
    ? [{ id: preferredJobId }]
    : await sql<{ id: string }[]>`
        select id from app.jobs
        where status in ('queued','running') and (locked_until is null or locked_until < now())
        order by created_at limit 1`;
  if (!candidates.length) return { jobId: null, more: false };

  const [job] = await sql<JobRow[]>`
    update app.jobs set
      lock_id = ${lockId},
      locked_until = now() + ${LOCK_SECONDS + " seconds"}::interval,
      status = 'running',
      started_at = coalesce(started_at, now()),
      heartbeat_at = now()
    where id = ${candidates[0].id} and status in ('queued','running')
      and (locked_until is null or locked_until < now())
    returning id, organization_id, status, stage, params, tasks_total
  `;
  if (!job) return { jobId: candidates[0].id, more: false };

  try {
    // Tâches interrompues par une coupure précédente : on les remet en file.
    await sql`update app.job_tasks set status = 'pending' where job_id = ${job.id} and status = 'running'`;
    if (job.tasks_total > 0 && job.stage === "search") {
      const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from app.job_tasks where job_id = ${job.id} and status = 'done'`;
      if (c === 0) await log(job.id, "Démarrage de la recherche…");
    }

    while (Date.now() - started < TICK_BUDGET_MS) {
      const [state] = await sql<{ status: string }[]>`select status from app.jobs where id = ${job.id}`;
      if (state?.status !== "running") return { jobId: job.id, more: false };

      const [task] = await sql<TaskRow[]>`
        update app.job_tasks set status = 'running', attempts = attempts + 1, updated_at = now()
        where id = (
          select id from app.job_tasks where job_id = ${job.id} and status = 'pending'
          order by position limit 1 for update skip locked
        )
        returning id, kind, payload, attempts
      `;

      if (!task) {
        const finished = await advanceStage(job);
        if (finished) return { jobId: job.id, more: false };
        continue;
      }

      const deadline = Math.min(started + TICK_BUDGET_MS, Date.now() + 120_000);
      try {
        if (task.kind === "search") await runSearchTask(job, task, deadline);
        else await runEnrichTask(job, task);
        await sql`update app.job_tasks set status = 'done', updated_at = now() where id = ${task.id}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const final = task.attempts >= MAX_TASK_ATTEMPTS;
        await sql`update app.job_tasks set status = ${final ? "failed" : "pending"}, error = ${message.slice(0, 500)}, updated_at = now() where id = ${task.id}`;
        if (final) await log(job.id, `Étape abandonnée après ${MAX_TASK_ATTEMPTS} essais : ${message}`, "warning");
        if (message === "QUOTA") return { jobId: job.id, more: false };
      }
      await refreshCounters(job.id);
    }
    return { jobId: job.id, more: true };
  } catch (err) {
    console.error("[worker] erreur", err);
    const message = err instanceof Error ? err.message : String(err);
    await log(job.id, `Incident technique, reprise automatique : ${message}`, "warning").catch(() => {});
    return { jobId: job.id, more: true };
  } finally {
    await sql`update app.jobs set locked_until = null, lock_id = null where id = ${job.id} and lock_id = ${lockId}`.catch(() => {});
  }
}

async function refreshCounters(jobId: string) {
  await db()`
    update app.jobs set
      tasks_done = (select count(*) from app.job_tasks where job_id = ${jobId} and status in ('done','failed')),
      tasks_total = (select count(*) from app.job_tasks where job_id = ${jobId}),
      leads_count = (select count(*) from app.leads where job_id = ${jobId}),
      heartbeat_at = now()
    where id = ${jobId}
  `;
}

/** Plus de tâches en attente : passe à l'enrichissement ou termine. Retourne true si le travail est fini. */
async function advanceStage(job: JobRow): Promise<boolean> {
  const sql = db();
  if (job.stage === "search" && job.params.enrich) {
    const leads = await sql<{ id: number }[]>`
      select id from app.leads where job_id = ${job.id} and website is not null and email is null order by id`;
    job.stage = "enrich";
    await sql`update app.jobs set stage = 'enrich', message = 'Recherche des emails et réseaux sociaux…' where id = ${job.id}`;
    if (leads.length) {
      let pos = 100_000;
      for (let i = 0; i < leads.length; i += ENRICH_BATCH) {
        const ids = leads.slice(i, i + ENRICH_BATCH).map((l) => l.id);
        await sql`insert into app.job_tasks (job_id, kind, position, payload) values (${job.id}, 'enrich', ${pos++}, ${sql.json({ leadIds: ids } as never)})`;
      }
      await log(job.id, `Enrichissement : ${leads.length} sites web à analyser pour trouver emails et réseaux sociaux.`);
      await refreshCounters(job.id);
      return false;
    }
  }
  await refreshCounters(job.id);
  const [{ leads_count }] = await sql<{ leads_count: number }[]>`select leads_count from app.jobs where id = ${job.id}`;
  const failedAll = await sql<{ c: number }[]>`
    select count(*)::int as c from app.job_tasks where job_id = ${job.id} and kind = 'search' and status = 'done'`;
  const status = leads_count === 0 && failedAll[0].c === 0 ? "failed" : "completed";
  await sql`
    update app.jobs set status = ${status}, stage = 'done', finished_at = now(),
      message = ${status === "completed" ? `Terminé : ${leads_count} entreprises trouvées.` : "Aucune source n'a pu répondre. Réessayez plus tard."},
      error = ${status === "failed" ? "Toutes les sources ont échoué" : null}
    where id = ${job.id}`;
  await log(job.id, status === "completed" ? `Terminé ✔ ${leads_count} entreprises prêtes à l'export.` : "Échec : aucune source disponible.", status === "completed" ? "success" : "error");
  return true;
}

// ---------------------------------------------------------------------------
// Tâche de recherche
// ---------------------------------------------------------------------------

async function remainingQuota(orgId: string): Promise<number> {
  const [r] = await db()<{ quota: number; used: number }[]>`
    select o.monthly_lead_quota as quota,
      (select count(*)::int from app.leads l where l.organization_id = o.id and l.created_at >= date_trunc('month', now())) as used
    from app.organizations o where o.id = ${orgId}`;
  return r ? r.quota - r.used : 0;
}

function normName(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function dedupeKey(p: RawPlace, phoneIntl: string | null): string {
  if (phoneIntl) return `p:${phoneIntl.replace(/\D/g, "").slice(-9)}`;
  const n = normName(p.name);
  if (p.latitude != null && p.longitude != null) return `n:${n}|${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;
  return `n:${n}`;
}

async function runSearchTask(job: JobRow, task: TaskRow, deadline: number) {
  const sql = db();
  const zone = ZONE_BY_ID.get(task.payload.zoneId ?? "") ?? ZONE_BY_ID.get("dakar")!;
  const keyword = task.payload.keyword ?? "";

  const quota = await remainingQuota(job.organization_id);
  if (quota <= 0) {
    await sql`update app.jobs set status = 'completed', stage = 'done', finished_at = now(),
      message = 'Quota mensuel atteint : contactez votre fournisseur pour l''augmenter.' where id = ${job.id}`;
    await log(job.id, "Quota mensuel de leads atteint. Recherche arrêtée.", "warning");
    throw new Error("QUOTA");
  }

  await log(job.id, `Recherche « ${keyword} » — ${zone.name}`);
  const outcome = await runSearch(
    {
      keyword,
      zoneName: zone.name,
      queryHint: zone.queryHint,
      lat: zone.lat,
      lng: zone.lng,
      radiusKm: zone.radiusKm,
      limit: job.params.limitPerQuery,
      osmFilters: osmFiltersFor(keyword),
    },
    deadline,
  );

  for (const a of outcome.attempts.filter((x) => !x.ok)) await log(job.id, `Source ${a.provider} indisponible (${a.error}) → bascule automatique`, "warning");

  if (!outcome.provider && outcome.attempts.every((a) => !a.ok)) throw new Error("Toutes les sources ont échoué pour cette requête");

  const rows = outcome.places
    .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY")
    .slice(0, Math.max(0, quota))
    .map((p) => {
      const ph = normalizePhone(p.phone);
      return {
        job_id: job.id,
        organization_id: job.organization_id,
        dedupe_key: dedupeKey(p, ph?.intl ?? null),
        name: p.name.slice(0, 300),
        category: p.category ?? null,
        activity: keyword,
        zone: zone.name,
        phone: ph?.display ?? null,
        phone_intl: ph?.intl ?? null,
        operator: ph?.operator || null,
        whatsapp: ph?.whatsapp || null,
        email: p.email?.toLowerCase() ?? null,
        emails: p.email ? [p.email.toLowerCase()] : [],
        website: p.website ?? null,
        address: p.address ?? null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        rating: p.rating ?? null,
        reviews_count: p.reviewsCount ?? null,
        maps_url: p.mapsUrl ?? null,
        place_id: p.placeId ?? null,
        facebook: p.facebook ?? null,
        instagram: p.instagram ?? null,
        opening_hours: p.openingHours ?? null,
        business_status: p.businessStatus ?? null,
        source: outcome.provider,
      };
    });

  let inserted = 0;
  if (rows.length) {
    const res = await sql`insert into app.leads ${sql(rows)} on conflict (job_id, dedupe_key) do nothing returning id`;
    inserted = res.length;
  }

  await sql`
    update app.job_tasks set provider = ${outcome.provider}, result_count = ${inserted} where id = ${task.id}`;
  if (outcome.provider) {
    await sql`
      update app.jobs set provider_stats = jsonb_set(provider_stats, ${[outcome.provider]}::text[],
        to_jsonb(coalesce((provider_stats ->> ${outcome.provider})::int, 0) + ${inserted}))
      where id = ${job.id}`;
  }
  await log(
    job.id,
    `${inserted} nouvelle(s) entreprise(s) « ${keyword} » à ${zone.name}${outcome.provider ? ` (source : ${outcome.provider})` : ""}`,
    inserted > 0 ? "success" : "info",
  );
}

// ---------------------------------------------------------------------------
// Tâche d'enrichissement
// ---------------------------------------------------------------------------

async function runEnrichTask(job: JobRow, task: TaskRow) {
  const sql = db();
  const ids = task.payload.leadIds ?? [];
  if (!ids.length) return;
  const leads = await sql<{ id: number; website: string; phone: string | null }[]>`
    select id, website, phone from app.leads where id in ${sql(ids)} and job_id = ${job.id}`;
  const results = await Promise.allSettled(leads.map((l) => enrichWebsite(l.website)));
  let found = 0;
  for (let i = 0; i < leads.length; i++) {
    const r = results[i];
    const lead = leads[i];
    if (r.status !== "fulfilled" || !r.value) {
      await sql`update app.leads set enriched = true where id = ${lead.id}`;
      continue;
    }
    const e = r.value;
    if (e.email) found++;
    const ph = !lead.phone && e.phones[0] ? normalizePhone(e.phones[0]) : null;
    await sql`
      update app.leads set
        email = coalesce(email, ${e.email}),
        emails = case when cardinality(emails) = 0 then ${e.emails}::text[] else emails end,
        facebook = coalesce(facebook, ${e.facebook}),
        instagram = coalesce(instagram, ${e.instagram}),
        linkedin = coalesce(linkedin, ${e.linkedin}),
        twitter = coalesce(twitter, ${e.twitter}),
        tiktok = coalesce(tiktok, ${e.tiktok}),
        youtube = coalesce(youtube, ${e.youtube}),
        phone = coalesce(phone, ${ph?.display ?? null}),
        phone_intl = coalesce(phone_intl, ${ph?.intl ?? null}),
        operator = coalesce(operator, ${ph?.operator || null}),
        whatsapp = coalesce(whatsapp, ${ph?.whatsapp || null}),
        enriched = true
      where id = ${lead.id}`;
  }
  if (found) await log(job.id, `${found} email(s) trouvé(s) sur les sites web`, "success");
}

// ---------------------------------------------------------------------------
// Relance en chaîne (chaque appel = une nouvelle fonction Vercel avec 300 s)
// ---------------------------------------------------------------------------

export async function kickWorker(origin: string | undefined, jobId?: string) {
  const base = origin ?? env.appUrl;
  if (!base || !env.workerSecret) return false;
  const headers: Record<string, string> = { Authorization: `Bearer ${env.workerSecret}`, "Content-Type": "application/json" };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  try {
    const res = await fetch(`${base}/api/worker/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch (e) {
    console.error("[worker] relance impossible", e);
    return false;
  }
}

/** Libère les verrous orphelins et relance les travaux bloqués (appelé par la maintenance). */
export async function resumeStalledJobs(): Promise<string[]> {
  const rows = await db()<{ id: string }[]>`
    select id from app.jobs where status in ('queued','running')
      and (locked_until is null or locked_until < now())
      and (heartbeat_at is null or heartbeat_at < now() - interval '2 minutes')
    order by created_at limit 10`;
  return rows.map((r) => r.id);
}
