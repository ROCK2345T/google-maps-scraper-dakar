import { headers } from "next/headers";
import { z } from "zod";
import { assertSameOrigin, handler, HttpError, ok, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  company: z.string().trim().min(2, "Nom d'entreprise requis").max(150),
  contactName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(1500).optional().default(""),
  website: z.string().max(0).optional(), // piège à robots
});

export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  const body = await parseBody(req, schema);
  if (!body.email && !body.phone) throw new HttpError(400, "Indiquez un email ou un téléphone.");
  const ip = clientIp(await headers());
  const [{ c }] = await db()<{ c: number }[]>`select count(*)::int as c from app.access_requests where ip = ${ip} and created_at > now() - interval '1 hour'`;
  if (c >= 5) throw new HttpError(429, "Demande déjà reçue. Nous vous recontactons rapidement.");
  await db()`
    insert into app.access_requests (company, contact_name, email, phone, message, ip)
    values (${body.company}, ${body.contactName || null}, ${body.email || null}, ${body.phone || null}, ${body.message || null}, ${ip})`;
  return ok({ ok: true });
});
