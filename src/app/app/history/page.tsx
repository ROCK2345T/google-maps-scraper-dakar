import Link from "next/link";
import { FileSpreadsheet, History, Search } from "lucide-react";
import { db } from "@/lib/db";
import { pageUser } from "@/lib/session-page";
import { Badge, EmptyState, JOB_STATUS, PageHeader, fmtDate, fmtNum } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes recherches" };

export default async function HistoryPage() {
  const { user } = await pageUser();
  const jobs = await db()<{ id: string; title: string; status: string; leads_count: number; created_at: Date; finished_at: Date | null; emails: number; phones: number }[]>`
    select j.id, j.title, j.status, j.leads_count, j.created_at, j.finished_at,
      (select count(email)::int from app.leads l where l.job_id = j.id) as emails,
      (select count(phone)::int from app.leads l where l.job_id = j.id) as phones
    from app.jobs j where j.organization_id = ${user.organizationId} order by j.created_at desc limit 200`;

  return (
    <div className="fade-in">
      <PageHeader title="Mes recherches" subtitle="Historique complet : rouvrez une recherche ou retéléchargez son fichier Excel à tout moment."
        actions={<Link href="/app/new" className="btn-primary"><Search className="size-4" /> Nouvelle recherche</Link>} />
      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState icon={<History className="size-6" />} title="Aucune recherche pour l'instant" action={<Link href="/app/new" className="btn-primary">Lancer une recherche</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Recherche</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Entreprises</th><th className="px-5 py-3 text-right">Tél.</th><th className="px-5 py-3 text-right">Emails</th><th className="px-5 py-3">Date</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => {
                  const s = JOB_STATUS[j.status] ?? JOB_STATUS.queued;
                  return (
                    <tr key={j.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5"><Link href={`/app/jobs/${j.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{j.title}</Link></td>
                      <td className="px-5 py-3.5"><Badge color={s.color} dot>{s.label}</Badge></td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{fmtNum(j.leads_count)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{fmtNum(j.phones)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{fmtNum(j.emails)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{fmtDate(j.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {j.leads_count > 0 && (
                          <a href={`/api/jobs/${j.id}/export?format=xlsx`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                            <FileSpreadsheet className="size-4" /> Excel
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
