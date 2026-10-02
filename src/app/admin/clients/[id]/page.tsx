import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ClientDetail } from "./detail";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sql = db();
  const [org] = await sql`select * from app.organizations where id = ${id}`;
  if (!org) notFound();
  const users = await sql`select id, email, full_name, role, is_active, last_login_at, created_at from app.users where organization_id = ${id} order by created_at`;
  const jobs = await sql`select id, title, status, leads_count, created_at from app.jobs where organization_id = ${id} order by created_at desc limit 15`;
  const [usage] = await sql<{ month: number; total: number }[]>`
    select count(*) filter (where created_at >= date_trunc('month', now()))::int as month, count(*)::int as total
    from app.leads where organization_id = ${id}`;
  const audit = await sql`select action, actor_email, details, created_at from app.audit_logs where organization_id = ${id} order by created_at desc limit 20`;
  return <ClientDetail org={JSON.parse(JSON.stringify(org))} users={JSON.parse(JSON.stringify(users))} jobs={JSON.parse(JSON.stringify(jobs))} usage={usage} audit={JSON.parse(JSON.stringify(audit))} />;
}
