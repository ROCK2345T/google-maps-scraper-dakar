import { db } from "@/lib/db";
import { PageHeader, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal d'audit" };

export default async function AuditPage() {
  const rows = await db()<{ id: number; action: string; actor_email: string | null; details: Record<string, unknown>; ip: string | null; created_at: Date; org: string | null }[]>`
    select a.id, a.action, a.actor_email, a.details, a.ip, a.created_at, o.name as org
    from app.audit_logs a left join app.organizations o on o.id = a.organization_id
    order by a.created_at desc limit 300`;
  return (
    <div className="fade-in">
      <PageHeader title="Journal d'audit" subtitle="Traçabilité complète : connexions, créations de comptes, coupures d'accès, exports." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Par</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Détails</th><th className="px-5 py-3">IP</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Aucun événement.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{fmtDate(r.created_at)}</td>
                <td className="px-5 py-2.5 font-medium text-slate-800">{r.action}</td>
                <td className="px-5 py-2.5 text-slate-600">{r.actor_email ?? "—"}</td>
                <td className="px-5 py-2.5 text-slate-600">{r.org ?? "—"}</td>
                <td className="max-w-sm truncate px-5 py-2.5 font-mono text-xs text-slate-500">{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : ""}</td>
                <td className="px-5 py-2.5 text-xs text-slate-400">{r.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
