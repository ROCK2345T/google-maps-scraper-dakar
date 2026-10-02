import Link from "next/link";
import { Activity, Ban, Building2, Inbox, Users, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, JOB_STATUS, PageHeader, StatCard, fmtDate, fmtNum } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const sql = db();
  const [k] = await sql<{ orgs: number; active: number; suspended: number; expiring: number; users: number; leads_month: number; leads_total: number; running: number; requests: number }[]>`
    select
      (select count(*)::int from app.organizations) as orgs,
      (select count(*)::int from app.organizations where status = 'active' and (subscription_ends_at is null or subscription_ends_at > now())) as active,
      (select count(*)::int from app.organizations where status = 'suspended') as suspended,
      (select count(*)::int from app.organizations where status = 'active' and subscription_ends_at between now() and now() + interval '7 days') as expiring,
      (select count(*)::int from app.users where role <> 'superadmin') as users,
      (select count(*)::int from app.leads where created_at >= date_trunc('month', now())) as leads_month,
      (select count(*)::int from app.leads) as leads_total,
      (select count(*)::int from app.jobs where status in ('queued','running')) as running,
      (select count(*)::int from app.access_requests where status = 'new') as requests`;
  const top = await sql<{ id: string; name: string; status: string; leads: number; quota: number }[]>`
    select o.id, o.name, o.status, o.monthly_lead_quota as quota,
      (select count(*)::int from app.leads l where l.organization_id = o.id and l.created_at >= date_trunc('month', now())) as leads
    from app.organizations o order by leads desc, o.created_at desc limit 6`;
  const jobs = await sql<{ id: string; title: string; status: string; leads_count: number; created_at: Date; org: string }[]>`
    select j.id, j.title, j.status, j.leads_count, j.created_at, o.name as org
    from app.jobs j join app.organizations o on o.id = j.organization_id order by j.created_at desc limit 8`;
  const health = await sql<{ provider: string; consecutive_failures: number; last_success_at: Date | null; cooldown_until: Date | null }[]>`
    select provider, consecutive_failures, last_success_at, cooldown_until from app.provider_health order by provider`;

  return (
    <div className="fade-in">
      <PageHeader title="Vue d'ensemble" subtitle="Pilotage de votre activité SaaS en temps réel."
        actions={<Link href="/admin/clients?new=1" className="btn-primary"><Building2 className="size-4" /> Nouveau client</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients actifs" value={fmtNum(k.active)} hint={`${fmtNum(k.orgs)} au total · ${fmtNum(k.expiring)} expirent sous 7 j`} icon={<Building2 className="size-5" />} />
        <StatCard label="Accès suspendus" value={fmtNum(k.suspended)} hint="Coupés depuis la console" icon={<Ban className="size-5" />} accent="amber" />
        <StatCard label="Leads ce mois" value={fmtNum(k.leads_month)} hint={`${fmtNum(k.leads_total)} depuis le début`} icon={<Zap className="size-5" />} accent="violet" />
        <StatCard label="Utilisateurs" value={fmtNum(k.users)} hint={`${fmtNum(k.running)} recherche(s) en cours`} icon={<Users className="size-5" />} accent="sky" />
      </div>

      {k.requests > 0 && (
        <Link href="/admin/requests" className="mt-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 hover:bg-amber-100">
          <span className="flex items-center gap-2"><Inbox className="size-5" /> {k.requests} nouvelle(s) demande(s) d&apos;accès à traiter</span>
          <span>Voir →</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">Consommation par client (ce mois)</div>
          <ul className="divide-y divide-slate-100">
            {top.length === 0 && <li className="px-6 py-8 text-center text-sm text-slate-500">Aucun client. Créez le premier depuis « Clients & accès ».</li>}
            {top.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/clients/${o.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{o.name}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, o.quota ? (o.leads / o.quota) * 100 : 0)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-slate-600">{fmtNum(o.leads)} / {fmtNum(o.quota)}</span>
                  {o.status === "suspended" && <Badge color="red">Suspendu</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <span className="font-semibold text-slate-900">Dernières recherches</span>
            <Link href="/admin/jobs" className="text-sm font-semibold text-brand-700">Tout voir</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {jobs.length === 0 && <li className="px-6 py-8 text-center text-sm text-slate-500">Aucune recherche.</li>}
            {jobs.map((j) => {
              const s = JOB_STATUS[j.status] ?? JOB_STATUS.queued;
              return (
                <li key={j.id}>
                  <Link href={`/admin/jobs/${j.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{j.title}</p>
                      <p className="text-xs text-slate-500">{j.org} · {fmtDate(j.created_at)} · {fmtNum(j.leads_count)} leads</p>
                    </div>
                    <Badge color={s.color} dot>{s.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Activity className="size-5 text-brand-600" /> Santé des sources de données</h2>
          <Link href="/admin/system" className="text-sm font-semibold text-brand-700">Diagnostic complet</Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {health.length === 0 && <p className="text-sm text-slate-500">Aucune donnée encore : les statistiques apparaissent après la première recherche.</p>}
          {health.map((h) => {
            const paused = h.cooldown_until && new Date(h.cooldown_until) > new Date();
            return (
              <Badge key={h.provider} color={paused ? "red" : h.consecutive_failures ? "amber" : "green"} dot>
                {h.provider} · {paused ? "en pause" : h.consecutive_failures ? `${h.consecutive_failures} échec(s)` : "OK"}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
}
