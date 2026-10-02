import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { db } from "@/lib/db";
import { envReport } from "@/lib/env";
import { providerChain, PROVIDERS } from "@/lib/scraper/engine";
import { PageHeader, fmtDate, fmtNum, Badge } from "@/components/ui";
import { ProviderTester } from "./tester";

export const dynamic = "force-dynamic";
export const metadata = { title: "Système & sources" };

export default async function SystemPage() {
  const health = await db()<{ provider: string; consecutive_failures: number; total_success: number; total_failures: number; last_success_at: Date | null; last_failure_at: Date | null; last_error: string | null; cooldown_until: Date | null }[]>`
    select * from app.provider_health`;
  const byId = new Map(health.map((h) => [h.provider, h]));
  const chain = providerChain().map((p) => p.id);
  const env = envReport();

  return (
    <div className="fade-in">
      <PageHeader title="Système & sources" subtitle="Configuration, ordre de bascule des sources de données et diagnostic en direct." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Variables d&apos;environnement</h2>
          <p className="mt-1 text-sm text-slate-500">À modifier dans Vercel → Project → Settings → Environment Variables, puis redéployer.</p>
          <ul className="mt-4 space-y-3">
            {env.map((e) => (
              <li key={e.key} className="flex gap-3">
                {e.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" /> : e.required ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-slate-300" />}
                <div><p className="font-mono text-sm font-semibold text-slate-800">{e.key}</p><p className="text-xs text-slate-500">{e.help}</p></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Chaîne de bascule des sources</h2>
          <p className="mt-1 text-sm text-slate-500">Chaque recherche essaie les sources dans cet ordre. Une source qui échoue 3 fois de suite est mise en pause 20 minutes (disjoncteur), puis réessayée.</p>
          <ol className="mt-4 space-y-3">
            {(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).sort((a, b) => (chain.indexOf(a) + 1 || 99) - (chain.indexOf(b) + 1 || 99)).map((id) => {
              const p = PROVIDERS[id];
              const h = byId.get(id);
              const active = chain.includes(id);
              const paused = h?.cooldown_until && new Date(h.cooldown_until) > new Date();
              return (
                <li key={id} className={`rounded-xl border p-4 ${active ? "border-slate-200" : "border-dashed border-slate-200 opacity-60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{active ? `${chain.indexOf(id) + 1}. ` : ""}{p.label}</p>
                    {!active ? <Badge>Non configurée</Badge> : paused ? <Badge color="red" dot>En pause</Badge> : h?.consecutive_failures ? <Badge color="amber" dot>{h.consecutive_failures} échec(s)</Badge> : <Badge color="green" dot>Opérationnelle</Badge>}
                  </div>
                  {h && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      {fmtNum(h.total_success)} succès · {fmtNum(h.total_failures)} échecs · dernier succès {fmtDate(h.last_success_at)}
                      {h.last_error && <span className="mt-1 block truncate text-red-600">Dernière erreur : {h.last_error}</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <ProviderTester />
    </div>
  );
}
