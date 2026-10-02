"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { api } from "@/components/api-client";
import { Badge, Spinner } from "@/components/ui";
import { ZONES } from "@/lib/data/zones";

type Result = { id: string; label: string; configured: boolean; ok: boolean; count: number; ms: number; sample: string[]; error: string | null };

export function ProviderTester() {
  const [keyword, setKeyword] = useState("Pharmacie");
  const [zoneId, setZoneId] = useState("plateau");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card mt-6 p-6">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900"><FlaskConical className="size-5 text-brand-600" /> Tester les sources maintenant</h2>
      <p className="mt-1 text-sm text-slate-500">Lance la même recherche sur chaque source séparément pour vérifier clés API, proxys et blocages éventuels.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className="input max-w-56" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select className="input max-w-56" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <button className="btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { setResults((await api<{ results: Result[] }>("/api/admin/providers/test", { body: { keyword, zoneId } })).results); }
          catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
          finally { setBusy(false); }
        }}>{busy && <Spinner />} Lancer le test</button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {results && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {results.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{r.label}</p>
                {!r.configured ? <Badge>Non configurée</Badge> : r.ok ? <Badge color="green" dot>{r.count} résultat(s) · {(r.ms / 1000).toFixed(1)} s</Badge> : <Badge color="red" dot>Échec</Badge>}
              </div>
              {r.error && r.configured && <p className="mt-2 text-xs text-red-600">{r.error}</p>}
              {r.sample.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-slate-600">{r.sample.map((s) => <li key={s}>• {s}</li>)}</ul>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
