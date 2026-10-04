"use client";

import { useState } from "react";
import { Spinner } from "./ui";

export const PLANS = [
  { id: "starter", label: "Starter", quota: 500, users: 1 },
  { id: "pro", label: "Pro", quota: 2000, users: 3 },
  { id: "business", label: "Business", quota: 10000, users: 10 },
  { id: "custom", label: "Sur mesure", quota: 5000, users: 5 },
];

export type OrgFormValues = {
  name: string; contactName: string; contactEmail: string; contactPhone: string; plan: string;
  monthlyLeadQuota: number; maxUsers: number; subscriptionEndsAt: string; notes: string; ownerEmail?: string; ownerName?: string;
};

export function OrgForm({ initial, withOwner, submitLabel, onSubmit }: { initial: OrgFormValues; withOwner?: boolean; submitLabel: string; onSubmit: (v: OrgFormValues) => Promise<void> }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof OrgFormValues>(k: K, val: OrgFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const addMonths = (n: number) => {
    const d = v.subscriptionEndsAt ? new Date(v.subscriptionEndsAt) : new Date();
    const base = d < new Date() ? new Date() : d;
    base.setMonth(base.getMonth() + n);
    set("subscriptionEndsAt", base.toISOString().slice(0, 10));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(v);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div><label className="label">Nom de l&apos;entreprise *</label><input className="input" required value={v.name} onChange={(e) => set("name", e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Contact</label><input className="input" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} /></div>
        <div><label className="label">Téléphone / WhatsApp</label><input className="input" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="77 123 45 67" /></div>
      </div>
      <div><label className="label">Email de contact</label><input className="input" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></div>

      <div>
        <label className="label">Formule</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLANS.map((p) => (
            <button type="button" key={p.id}
              onClick={() => setV((x) => ({ ...x, plan: p.id, monthlyLeadQuota: p.quota, maxUsers: p.users }))}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${v.plan === p.id ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:bg-slate-50"}`}>
              <span className="block font-semibold text-slate-900">{p.label}</span>
              <span className="text-xs text-slate-500">{p.quota.toLocaleString("fr-FR")} leads · {p.users} util.</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Quota mensuel (leads)</label><input className="input" type="number" min={0} value={v.monthlyLeadQuota} onChange={(e) => set("monthlyLeadQuota", Number(e.target.value))} /></div>
        <div><label className="label">Utilisateurs max</label><input className="input" type="number" min={1} value={v.maxUsers} onChange={(e) => set("maxUsers", Number(e.target.value))} /></div>
      </div>
      <div>
        <label className="label">Fin d&apos;abonnement (accès coupé automatiquement après cette date)</label>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-48" type="date" value={v.subscriptionEndsAt} onChange={(e) => set("subscriptionEndsAt", e.target.value)} />
          <button type="button" className="btn-secondary" onClick={() => addMonths(1)}>+1 mois</button>
          <button type="button" className="btn-secondary" onClick={() => addMonths(3)}>+3 mois</button>
          <button type="button" className="btn-secondary" onClick={() => addMonths(12)}>+1 an</button>
          <button type="button" className="btn-ghost" onClick={() => set("subscriptionEndsAt", "")}>Illimité</button>
        </div>
      </div>
      {withOwner && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <p className="mb-3 text-sm font-semibold text-brand-800">Compte de connexion du client</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Email de connexion *</label><input className="input" type="email" required value={v.ownerEmail ?? ""} onChange={(e) => set("ownerEmail", e.target.value)} /></div>
            <div><label className="label">Nom de l&apos;utilisateur</label><input className="input" value={v.ownerName ?? ""} onChange={(e) => set("ownerName", e.target.value)} /></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Un mot de passe sécurisé est généré automatiquement et affiché une seule fois.</p>
        </div>
      )}
      <div><label className="label">Notes internes</label><textarea className="input min-h-20" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Tarif négocié, mode de paiement, échéances…" /></div>
      <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} {submitLabel}</button>
    </form>
  );
}
