import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [r] = await db()<{ now: Date }[]>`select now()`;
    return Response.json({ ok: true, db: "ok", time: r.now });
  } catch (e) {
    console.error("[health]", e);
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}
