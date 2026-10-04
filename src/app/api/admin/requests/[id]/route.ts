import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ status: z.enum(["new", "contacted", "converted", "rejected"]) });

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { status } = await parseBody(req, schema);
  const r = await db()`update app.access_requests set status = ${status} where id = ${id} returning id`;
  if (!r.length) throw new HttpError(404, "Demande introuvable");
  await audit(admin, "request_status", { id, status });
  return ok({ ok: true });
});
