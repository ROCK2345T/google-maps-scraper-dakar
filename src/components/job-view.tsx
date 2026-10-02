"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Building2, Download, FileSpreadsheet, Globe, Mail, MapPin, MessageCircle, Phone, Search, Square, Star, Terminal,
} from "lucide-react";
import { Facebook, Instagram, Linkedin } from "./brand-icons";
import { api } from "./api-client";
import { useToast } from "./toast";
import { Badge, EmptyState, JOB_STATUS, ProgressBar, Spinner, StatCard, cx, fmtDate, fmtNum } from "./ui";

type Lead = {
  id: number; name: string; category: string | null; activity: string | null; zone: string | null; phone: string | null;
  operator: string | null; whatsapp: string | null; email: string | null; website: string | null; address: string | null;
  rating: string | null; reviews_count: number | null; facebook: string | null; instagram: string | null; linkedin: string | null;
  maps_url: string | null; source: string | null;
};
type Job = {
  id: string; title: string; status: string; stage: string; tasks_total: number; tasks_done: number; leads_count: number;
  message: string | null; error: string | null; provider_stats: Record<string, number>; log: { t: string; level: string; msg: string }[];
  created_at: string; finished_at: string | null;
};
type Resp = { job: Job; leads: Lead[]; stats: { phones: number; emails: number; sites: number; whatsapp: number } };

const SOURCE_LABEL: Record<string, string> = { google_places: "Google (API)", serpapi: "Google (SerpAPI)", google_web: "Google Maps", osm: "OpenStreetMap" };
const OP_COLOR: Record<string, "red" | "blue" | "violet" | "slate" | "amber"> = { Orange: "amber", Free: "red", Expresso: "violet", Promobile: "violet", Fixe: "slate" };

export function JobView({ id, backHref }: { id: string; backHref: string }) {
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [stats, setStats] = useState<Resp["stats"] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "phone" | "whatsapp" | "email">("all");
  const [showLog, setShowLog] = useState(false);
  const lastId = useRef(0);
  const [stopping, setStopping] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Resp>(`/api/jobs/${id}?after=${lastId.current}`);
      setJob(r.job);
      setStats(r.stats);
      if (r.leads.length) {
        lastId.current = r.leads[r.leads.length - 1].id;
        setLeads((prev) => [...prev, ...r.leads]);
        // Plus de 500 nouvelles lignes : on continue à paginer immédiatement.
        if (r.leads.length === 500) return "more" as const;
      }
      return r.job.status;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      return "error";
    }
  }, [id]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = async () => {
      const status = await load();
      if (!alive) return;
      const active = status === "queued" || status === "running" || status === "more";
      if (active || status === "error") timer = setTimeout(loop, status === "more" ? 50 : status === "error" ? 8000 : 3000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === "phone" && !l.phone) return false;
      if (filter === "whatsapp" && !l.whatsapp) return false;
      if (filter === "email" && !l.email) return false;
      if (!term) return true;
      return [l.name, l.category, l.address, l.zone, l.activity, l.email, l.phone].some((v) => v?.toLowerCase().includes(term));
    });
  }, [leads, q, filter]);

  if (error && !job) {
    return <div className="card"><EmptyState icon={<Search className="size-6" />} title="Recherche introuvable" text={error} action={<Link href={backHref} className="btn-secondary">Retour</Link>} /></div>;
  }
  if (!job) return <div className="flex justify-center py-24"><Spinner className="size-8 text-brand-600" /></div>;

  const active = job.status === "queued" || job.status === "running";
  const pct = job.tasks_total ? Math.round((job.tasks_done / job.tasks_total) * 100) : 0;
  const st = JOB_STATUS[job.status] ?? JOB_STATUS.queued;

  const stop = async () => {
    setStopping(true);
    try {
      await api(`/api/jobs/${id}/cancel`, { method: "POST" });
      toast("success", "Recherche arrêtée. Les résultats déjà collectés restent disponibles.");
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
    } finally {
      setStopping(false);
    }
  };

  const exportUrl = (format: "xlsx" | "csv") => `/api/jobs/${id}/export?format=${format}&filter=${filter}`;

  return (
    <div className="fade-in">
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Retour
      </Link>

      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={st.color} dot>{st.label}</Badge>
              {job.stage === "enrich" && active && <Badge color="violet">Recherche des emails</Badge>}
              <span className="text-xs text-slate-500">Lancée le {fmtDate(job.created_at)}</span>
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{job.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{job.message}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {active && (
              <button className="btn-secondary" onClick={stop} disabled={stopping}>
                {stopping ? <Spinner /> : <Square className="size-4" />} Arrêter
              </button>
            )}
            <a className={cx("btn-primary", !leads.length && "pointer-events-none opacity-50")} href={exportUrl("xlsx")}>
              <FileSpreadsheet className="size-4" /> Excel
            </a>
            <a className={cx("btn-secondary", !leads.length && "pointer-events-none opacity-50")} href={exportUrl("csv")}>
              <Download className="size-4" /> CSV
            </a>
          </div>
        </div>
        {(active || job.tasks_total > 0) && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>{active ? (job.stage === "enrich" ? "Analyse des sites web…" : "Collecte en cours…") : "Progression"}</span>
              <span className="tabular-nums">{job.tasks_done} / {job.tasks_total} étapes · {pct}%</span>
            </div>
            <ProgressBar value={pct} active={active} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entreprises" value={fmtNum(job.leads_count)} icon={<Building2 className="size-5" />} />
        <StatCard label="Téléphones" value={fmtNum(stats?.phones)} icon={<Phone className="size-5" />} accent="sky" />
        <StatCard label="WhatsApp" value={fmtNum(stats?.whatsapp)} icon={<MessageCircle className="size-5" />} accent="violet" />
        <StatCard label="Emails" value={fmtNum(stats?.emails)} icon={<Mail className="size-5" />} accent="amber" />
      </div>

      {Object.keys(job.provider_stats ?? {}).length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          Sources utilisées :
          {Object.entries(job.provider_stats).map(([k, v]) => <Badge key={k} color="slate">{SOURCE_LABEL[k] ?? k} · {v}</Badge>)}
        </div>
      )}

      <div className="card mt-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["all", "Toutes"],
              ["phone", "Avec téléphone"],
              ["whatsapp", "WhatsApp"],
              ["email", "Avec email"],
            ] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium transition", filter === k ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Filtrer par nom, quartier, email…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className={cx("btn-secondary shrink-0", showLog && "bg-slate-100")} onClick={() => setShowLog(!showLog)} title="Journal d'activité">
              <Terminal className="size-4" />
            </button>
          </div>
        </div>

        {showLog && (
          <div className="max-h-64 overflow-y-auto border-b border-slate-100 bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed">
            {[...(job.log ?? [])].reverse().map((l, i) => (
              <div key={i} className={cx(l.level === "error" ? "text-red-400" : l.level === "warning" ? "text-amber-300" : l.level === "success" ? "text-emerald-400" : "text-slate-300")}>
                <span className="text-slate-500">{new Date(l.t).toLocaleTimeString("fr-FR", { timeZone: "Africa/Dakar" })}</span> {l.msg}
              </div>
            ))}
            {!job.log?.length && <span className="text-slate-500">En attente…</span>}
          </div>
        )}

        {leads.length === 0 ? (
          <EmptyState
            icon={active ? <Spinner className="size-6" /> : <Search className="size-6" />}
            title={active ? "Collecte en cours…" : "Aucun résultat"}
            text={active ? "Les premières entreprises apparaissent ici dans quelques secondes. Vous pouvez quitter la page, la recherche continue." : "Essayez une autre activité ou un quartier plus large."}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Entreprise</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Web & réseaux</th>
                    <th className="px-4 py-3">Adresse</th>
                    <th className="px-4 py-3 text-right">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.slice(0, 1000).map((l) => (
                    <tr key={l.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{l.name}</p>
                        <p className="text-xs text-slate-500">{l.category ?? l.activity}{l.zone ? ` · ${l.zone}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        {l.phone ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-800">
                              <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="hover:text-brand-700">{l.phone}</a>
                              {l.operator && <Badge color={OP_COLOR[l.operator] ?? "slate"}>{l.operator}</Badge>}
                            </span>
                            {l.whatsapp && (
                              <a href={l.whatsapp} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                <MessageCircle className="size-3.5" /> WhatsApp
                              </a>
                            )}
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                        {l.email && <a href={`mailto:${l.email}`} className="mt-1 flex items-center gap-1 text-xs text-sky-700 hover:underline"><Mail className="size-3.5" />{l.email}</a>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-slate-500">
                          {l.website && <a href={l.website} target="_blank" rel="noreferrer" title={l.website} className="hover:text-brand-700"><Globe className="size-4" /></a>}
                          {l.facebook && <a href={l.facebook} target="_blank" rel="noreferrer" title="Facebook" className="hover:text-blue-600"><Facebook className="size-4" /></a>}
                          {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" title="Instagram" className="hover:text-pink-600"><Instagram className="size-4" /></a>}
                          {l.linkedin && <a href={l.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="hover:text-sky-700"><Linkedin className="size-4" /></a>}
                          {l.maps_url && <a href={l.maps_url} target="_blank" rel="noreferrer" title="Voir sur la carte" className="hover:text-red-600"><MapPin className="size-4" /></a>}
                          {!l.website && !l.facebook && !l.instagram && !l.linkedin && !l.maps_url && <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-slate-600">{l.address ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {l.rating ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-slate-800">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" /> {Number(l.rating).toFixed(1)}
                            <span className="text-xs font-normal text-slate-400">({l.reviews_count ?? 0})</span>
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              {filtered.length} sur {leads.length} entreprises affichées{filtered.length > 1000 ? " (1 000 premières à l'écran — l'export contient tout)" : ""}. L&apos;export applique le filtre sélectionné.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
