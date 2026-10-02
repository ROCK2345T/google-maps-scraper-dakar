import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, JOB_STATUS, PageHeader, fmtDate, fmtNum } from "@/components/ui";
import { RetryButton } from "./retry-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recherches" };

export default async function AdminJobs() {
  const jobs = await db()<{ id: string; title: string; status: string; stage: string; leads_count: number; tasks_done: number; tasks_total: number; created_at: Date; org: string; provider_stats: Record<string, number>; error: string | null }[]>`
    select j.id, j.title, j.status, j.stage, j.leads_count, j.tasks_done, j.tasks_total, j.created_at, j.provider_stats, j.error, o.name as org
    from app.jobs j join app.organizations o on o.id = j.organization_id order by j.created_at desc limit 200`;
  return (
    <div className="fade-in">
      <PageHeader title="Recherches" subtitle="Toutes les recherches de tous les clients. Relancez une recherche en échec ou bloquée." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Recherche</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Étapes</th><th className="px-5 py-3 text-right">Leads</th><th className="px-5 py-3">Sources</th><th className="px-5 py-3">Date</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">Aucune recherche.</td></tr>}
            {jobs.map((j) => {
              const s = JOB_STATUS[j.status] ?? JOB_STATUS.queued;
              return (
                <tr key={j.id} className="hover:bg-slate-50/70">
                  <td className="max-w-xs px-5 py-3"><Link href={`/admin/jobs/${j.id}`} className="font-medium text-slate-900 hover:text-brand-700">{j.title}</Link>{j.error && <p className="truncate text-xs text-red-600">{j.error}</p>}</td>
                  <td className="px-5 py-3 text-slate-600">{j.org}</td>
                  <td className="px-5 py-3"><Badge color={s.color} dot>{s.label}</Badge></td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{j.tasks_done}/{j.tasks_total}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmtNum(j.leads_count)}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{Object.entries(j.provider_stats ?? {}).map(([k, v]) => `${k}:${v}`).join(" ") || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{fmtDate(j.created_at)}</td>
                  <td className="px-5 py-3 text-right">{j.status !== "completed" || j.leads_count === 0 ? <RetryButton id={j.id} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
