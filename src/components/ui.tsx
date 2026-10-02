import { Loader2 } from "lucide-react";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5 font-extrabold tracking-tight", className)}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#00853f" />
        <path d="M32 12c-8.3 0-15 6.5-15 14.6C17 37.5 32 52 32 52s15-14.5 15-25.4C47 18.5 40.3 12 32 12z" fill="#fff" />
        <path d="M32 19.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z" fill="#00853f" />
      </svg>
      <span className={light ? "text-white" : "text-slate-900"}>
        LeadScraper<span className="text-brand-600"> Dakar</span>
      </span>
    </span>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className)} />;
}

const BADGE: Record<string, string> = {
  green: "bg-brand-50 text-brand-700 ring-brand-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({ color = "slate", children, dot }: { color?: keyof typeof BADGE; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", BADGE[color])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const JOB_STATUS: Record<string, { label: string; color: keyof typeof BADGE }> = {
  queued: { label: "En attente", color: "slate" },
  running: { label: "En cours", color: "blue" },
  completed: { label: "Terminée", color: "green" },
  failed: { label: "Échec", color: "red" },
  cancelled: { label: "Arrêtée", color: "amber" },
};

export function StatCard({ label, value, hint, icon, accent = "brand" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; accent?: "brand" | "sky" | "amber" | "violet" }) {
  const ring = { brand: "bg-brand-50 text-brand-600", sky: "bg-sky-50 text-sky-600", amber: "bg-amber-50 text-amber-600", violet: "bg-violet-50 text-violet-600" }[accent];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", ring)}>{icon}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, active }: { value: number; active?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cx("h-full rounded-full bg-brand-600 transition-all duration-700", active && "progress-stripes")} style={{ width: `${Math.max(v, active ? 4 : 0)}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function fmtDate(d: string | Date | null | undefined, withTime = true) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function fmtNum(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("fr-FR");
}
