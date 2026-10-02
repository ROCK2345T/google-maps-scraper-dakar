import Link from "next/link";
import { Building2, Phone, Mail, MessageCircle, Search, ArrowRight, Sparkles, FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/db";
import { pageUser } from "@/lib/session-page";
import { Badge, EmptyState, JOB_STATUS, PageHeader, ProgressBar, StatCard, fmtDate, fmtNum } from "@/components/ui";

export const dynamic = "force-dynamic";

const QUICK = [
  { label: "Agences immobilières à Almadies", keywords: ["Agence immobilière"], zones: ["almadies"] },
  { label: "Cliniques & cabinets médicaux au Plateau", keywords: ["Clinique", "Cabinet médical"], zones: ["plateau"] },
  { label: "Restaurants & hôtels à Ngor / Almadies", keywords: ["Restaurant", "Hôtel"], zones: ["almadies"] },
  { label: "Transitaires à Dakar", keywords: ["Transitaire"], zones: ["dakar"] },
];

export default async function Dashboard() {
  const { user } = await pageUser();
  const orgId = user.organizationId!;
  const sql = db();
  const [stats] = await sql<{ month: number; total: number; phones: number; emails: number; whatsapp: number; jobs: number }[]>`
    select
      count(*) filter (where created_at >= date_trunc('month', now()))::int as month,
      count(*)::int as total,
      count(phone)::int as phones,
      count(email)::int as emails,
      count(whatsapp)::int as whatsapp,
      (select count(*)::int from app.jobs where organization_id = ${orgId}) as jobs
    from app.leads where organization_id = ${orgId}`;
  const jobs = await sql<{ id: string; title: string; status: string; leads_count: number; tasks_done: number; tasks_total: number; created_at: Date }[]>`
    select id, title, status, leads_count, tasks_done, tasks_total, created_at
    from app.jobs where organization_id = ${orgId} order by created_at desc limit 6`;

  const quota = user.monthlyLeadQuota ?? 0;
  const pct = quota ? Math.round((stats.month / quota) * 100) : 0;
  const first = (user.fullName ?? "").split(" ")[0];

  return (
    <div className="fade-in">
      <PageHeader
        title={`Bonjour${first ? " " + first : ""} 👋`}
        subtitle={`Espace ${user.organizationName ?? ""} — trouvez vos prochains clients au Sénégal.`}
        actions={<Link href="/app/new" className="btn-primary"><Search className="size-4" /> Nouvelle recherche</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entreprises trouvées" value={fmtNum(stats.total)} hint={`${fmtNum(stats.jobs)} recherche(s) au total`} icon={<Building2 className="size-5" />} />
        <StatCard label="Avec téléphone" value={fmtNum(stats.phones)} hint={stats.total ? `${Math.round((stats.phones / stats.total) * 100)} % des fiches` : "—"} icon={<Phone className="size-5" />} accent="sky" />
        <StatCard label="Joignables sur WhatsApp" value={fmtNum(stats.whatsapp)} hint="Numéros mobiles +221" icon={<MessageCircle className="size-5" />} accent="violet" />
        <StatCard label="Emails trouvés" value={fmtNum(stats.emails)} hint="Via les sites officiels" icon={<Mail className="size-5" />} accent="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Recherches récentes</h2>
            <Link href="/app/history" className="text-sm font-semibold text-brand-700 hover:underline">Tout voir</Link>
          </div>
          {jobs.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title="Lancez votre première recherche"
              text="Choisissez une activité et un quartier : la plateforme collecte les coordonnées et prépare votre fichier Excel."
              action={<Link href="/app/new" className="btn-primary">Commencer <ArrowRight className="size-4" /></Link>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((j) => {
                const s = JOB_STATUS[j.status] ?? JOB_STATUS.queued;
                const p = j.tasks_total ? Math.round((j.tasks_done / j.tasks_total) * 100) : 0;
                return (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FileSpreadsheet className="size-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{j.title}</p>
                        <p className="text-xs text-slate-500">{fmtDate(j.created_at)} · {fmtNum(j.leads_count)} entreprises</p>
                        {(j.status === "running" || j.status === "queued") && <div className="mt-2 max-w-xs"><ProgressBar value={p} active /></div>}
                      </div>
                      <Badge color={s.color} dot>{s.label}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900">Quota du mois</h2>
            <p className="mt-1 text-sm text-slate-500">Leads collectés ce mois-ci</p>
            <p className="mt-4 text-3xl font-bold tabular-nums text-slate-900">
              {fmtNum(stats.month)} <span className="text-base font-medium text-slate-400">/ {fmtNum(quota)}</span>
            </p>
            <div className="mt-3"><ProgressBar value={pct} /></div>
            <p className="mt-2 text-xs text-slate-500">
              {user.subscriptionEndsAt ? `Abonnement valable jusqu'au ${fmtDate(user.subscriptionEndsAt, false)}` : "Abonnement actif"}
            </p>
          </div>
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900">Recherches rapides</h2>
            <div className="mt-3 space-y-2">
              {QUICK.map((q) => (
                <Link
                  key={q.label}
                  href={`/app/new?k=${encodeURIComponent(q.keywords.join("|"))}&z=${q.zones.join("|")}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  {q.label} <ArrowRight className="size-4 text-brand-600" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
