import { z } from "zod";
import { audit, assertSameOrigin, handler, HttpError, ok, parseBody, requireUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, "8 caractères minimum").max(200),
});

export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  const user = await requireUser({ allowBlocked: true });
  const { current, next } = await parseBody(req, schema);
  const [row] = await db()<{ password_hash: string }[]>`select password_hash from app.users where id = ${user.id}`;
  if (!row || !(await verifyPassword(current, row.password_hash))) throw new HttpError(400, "Mot de passe actuel incorrect.");
  const hash = await hashPassword(next);
  await db()`update app.users set password_hash = ${hash}, updated_at = now() where id = ${user.id}`;
  // Déconnecte les autres appareils.
  await db()`delete from app.sessions where user_id = ${user.id} and id <> ${user.sessionId}`;
  await audit(user, "password_changed", {}, user.organizationId);
  return ok({ ok: true });
});
