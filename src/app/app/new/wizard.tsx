"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, MapPin, Plus, Rocket, X, Briefcase, SlidersHorizontal, Mail } from "lucide-react";
import { SECTORS } from "@/lib/data/sectors";
import { ZONES } from "@/lib/data/zones";
import { api } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { Spinner, cx } from "@/components/ui";

const LIMITS = [
  { value: 20, label: "20", hint: "Rapide" },
  { value: 40, label: "40", hint: "Recommandé" },
  { value: 60, label: "60", hint: "Large" },
  { value: 100, label: "100", hint: "Maximum" },
];

export function SearchWizard() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [keywords, setKeywords] = useState<string[]>(() => params.get("k")?.split("|").filter(Boolean) ?? []);
  const [zoneIds, setZoneIds] = useState<string[]>(() => params.get("z")?.split("|").filter(Boolean) ?? []);
  const [sector, setSector] = useState(() => SECTORS.find((s) => s.activities.some((a) => keywords.includes(a.label)))?.id ?? SECTORS[0].id);
  const [custom, setCustom] = useState("");
  const [limit, setLimit] = useState(40);
  const [enrich, setEnrich] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, typeof ZONES>();
    for (const z of ZONES) m.set(z.group, [...(m.get(z.group) ?? []), z]);
    return [...m.entries()];
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addCustom = () => {
    const v = custom.trim();
    if (v.length >= 2 && !keywords.includes(v)) setKeywords([...keywords, v]);
    setCustom("");
  };

  const combos = keywords.length * zoneIds.length;
  const estimate = combos * limit;

  const submit = async () => {
    if (!keywords.length) return toast("error", "Choisissez au moins une activité.");
    if (!zoneIds.length) return toast("error", "Choisissez au moins une zone.");
    setSubmitting(true);
    try {
      const { id } = await api<{ id: string }>("/api/jobs", { body: { keywords, zoneIds, limitPerQuery: limit, enrich } });
      toast("success", "Recherche lancée ! Les résultats arrivent en direct.");
      router.push(`/app/jobs/${id}`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
      setSubmitting(false);
    }
  };

  const currentSector = SECTORS.find((s) => s.id === sector)!;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Étape 1 */}
        <section className="card p-6">
          <StepTitle n={1} icon={<Briefcase className="size-4" />} title="Quelles activités ?" done={keywords.length > 0} />
          <div className="mt-4 flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSector(s.id)}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                  sector === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300",
                )}
              >
                <span>{s.icon}</span> {s.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {currentSector.activities.map((a) => {
              const on = keywords.includes(a.label);
              return (
                <button
                  key={a.label}
                  onClick={() => toggle(keywords, setKeywords, a.label)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition",
                    on ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {a.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="input"
              placeholder="Ou saisissez une activité libre (ex : Société de transit, Agence d'intérim…)"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              maxLength={80}
            />
            <button className="btn-secondary shrink-0" onClick={addCustom}><Plus className="size-4" /> Ajouter</button>
          </div>
        </section>

        {/* Étape 2 */}
        <section className="card p-6">
          <StepTitle n={2} icon={<MapPin className="size-4" />} title="Où chercher ?" done={zoneIds.length > 0} />
          <div className="mt-4 space-y-4">
            {groups.map(([group, zones]) => (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((z) => {
                    const on = zoneIds.includes(z.id);
                    return (
                      <button
                        key={z.id}
                        onClick={() => toggle(zoneIds, setZoneIds, z.id)}
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                          on ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        {on && <Check className="size-3.5" />} {z.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Astuce : plusieurs quartiers précis donnent plus de résultats que « Tout Dakar ».</p>
        </section>

        {/* Étape 3 */}
        <section className="card p-6">
          <StepTitle n={3} icon={<SlidersHorizontal className="size-4" />} title="Options" done />
          <p className="label mt-4">Résultats maximum par activité et par zone</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LIMITS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLimit(l.value)}
                className={cx("rounded-xl border px-3 py-3 text-center transition", limit === l.value ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:bg-slate-50")}
              >
                <span className="block text-lg font-bold text-slate-900">{l.label}</span>
                <span className="text-xs text-slate-500">{l.hint}</span>
              </button>
            ))}
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
            <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Mail className="size-4 text-brand-600" /> Rechercher emails et réseaux sociaux</span>
              <span className="mt-0.5 block text-sm text-slate-500">Visite le site officiel de chaque entreprise pour trouver email, Facebook, Instagram, LinkedIn… (un peu plus long, beaucoup plus complet).</span>
            </span>
          </label>
        </section>
      </div>

      {/* Récapitulatif */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="flag-bar h-1" />
          <div className="p-6">
            <h3 className="font-semibold text-slate-900">Récapitulatif</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-slate-500">Activités ({keywords.length})</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {keywords.length ? keywords.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {k}
                      <button onClick={() => setKeywords(keywords.filter((x) => x !== k))} aria-label={`Retirer ${k}`}><X className="size-3" /></button>
                    </span>
                  )) : <span className="text-slate-400">Aucune</span>}
                </div>
              </div>
              <div>
                <p className="text-slate-500">Zones ({zoneIds.length})</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {zoneIds.length ? zoneIds.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {ZONES.find((z) => z.id === id)?.name ?? id}
                      <button onClick={() => setZoneIds(zoneIds.filter((x) => x !== id))} aria-label="Retirer"><X className="size-3" /></button>
                    </span>
                  )) : <span className="text-slate-400">Aucune</span>}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex justify-between"><span className="text-slate-500">Combinaisons</span><span className="font-semibold">{combos}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Leads potentiels</span><span className="font-semibold">jusqu&apos;à {estimate.toLocaleString("fr-FR")}</span></div>
              </div>
              {combos > 60 && <p className="text-xs font-medium text-red-600">Maximum 60 combinaisons par recherche : retirez des activités ou des zones.</p>}
            </div>
            <button className="btn-primary mt-6 w-full py-3" disabled={submitting || !combos || combos > 60} onClick={submit}>
              {submitting ? <Spinner /> : <Rocket className="size-4" />} Lancer la recherche
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">Vous pouvez fermer la page : la collecte continue en arrière-plan.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StepTitle({ n, title, icon, done }: { n: number; title: string; icon: React.ReactNode; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cx("flex size-8 items-center justify-center rounded-full text-sm font-bold", done ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")}>
        {done ? <Check className="size-4" /> : n}
      </span>
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">{icon}{title}</h2>
    </div>
  );
}
