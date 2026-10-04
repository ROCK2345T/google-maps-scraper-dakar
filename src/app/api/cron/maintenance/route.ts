import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/api";
import { kickWorker, resumeStalledJobs } from "@/lib/scraper/worker";

export const maxDuration = 60;

/** Tâche quotidienne : nettoyage, relance des travaux bloqués, garde la base active. */
export async function GET(req: Request) {
  // Refusé si CRON_SECRET n'est pas configuré : la route ne doit jamais être publique.
  if (!bearerMatches(req.headers.get("authorization"), env.cronSecret)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sql = db();
  await sql`delete from app.sessions where expires_at < now()`;
  await sql`delete from app.login_attempts where created_at < now() - interval '30 days'`;
  const stalled = await resumeStalledJobs();
  const origin = new URL(req.url).origin;
  for (const id of stalled) await kickWorker(origin, id);
  return Response.json({ ok: true, resumed: stalled.length });
}
