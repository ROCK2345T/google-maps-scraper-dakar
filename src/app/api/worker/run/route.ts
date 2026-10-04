import { after } from "next/server";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/api";
import { kickWorker, runTick } from "@/lib/scraper/worker";

export const maxDuration = 300;

/** Point d'entrée du moteur : répond immédiatement, travaille en arrière-plan puis se relance si besoin. */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.workerSecret)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  let jobId: string | undefined;
  try {
    jobId = (await req.json())?.jobId || undefined;
  } catch {
    /* corps vide */
  }
  const origin = new URL(req.url).origin;
  after(async () => {
    const r = await runTick(jobId);
    if (r.more) await kickWorker(origin, r.jobId ?? undefined);
    else if (r.jobId) await kickWorker(origin); // passe au travail suivant en file
  });
  return Response.json({ accepted: true }, { status: 202 });
}
