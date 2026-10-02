import postgres from "postgres";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const probe = new URL(req.url).searchParams.get("probe");
  // Diagnostic de connexion (réservé à l'opérateur) : teste les hôtes du pooler Supabase.
  if (probe && env.workerSecret && probe === env.workerSecret && env.databaseUrl) {
    const base = new URL(env.databaseUrl);
    const region = base.hostname.match(/aws-\d-([a-z0-9-]+)\.pooler/)?.[1] ?? "us-east-1";
    const results: Record<string, string> = {};
    for (const host of [`aws-0-${region}.pooler.supabase.com`, `aws-1-${region}.pooler.supabase.com`]) {
      const u = new URL(base.toString());
      u.hostname = host;
      const sql = postgres(u.toString(), { prepare: false, max: 1, connect_timeout: 8, ssl: "require" });
      try {
        await sql`select 1`;
        results[host] = "ok";
      } catch (e) {
        results[host] = e instanceof Error ? e.message : String(e);
      } finally {
        await sql.end({ timeout: 1 }).catch(() => {});
      }
    }
    return Response.json({ probe: results });
  }
  try {
    const [r] = await db()<{ now: Date }[]>`select now()`;
    return Response.json({ ok: true, db: "ok", time: r.now });
  } catch (e) {
    return Response.json({ ok: false, db: "error", error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
