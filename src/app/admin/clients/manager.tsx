"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Building2, PlayCircle, Plus, Search } from "lucide-react";
import { api } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/modal";
import { CredentialsModal, type Credentials } from "@/components/credentials-modal";
import { OrgForm, type OrgFormValues } from "@/components/org-form";
import { Badge, EmptyState, PageHeader, Spinner, fmtDate, fmtNum } from "@/components/ui";

type Org = {
  id: string; name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null; status: "active" | "suspended";
  plan: string; monthly_lead_quota: number; max_users: number; subscription_ends_at: string | null; users_count: number;
  leads_this_month: number; last_login_at: string | null; created_at: string;
};

export function orgState(o: Pick<Org, "status" | "subscription_ends_at">) {
  if (o.status === "suspended") return { label: "Suspendu", color: "red" as const };
  if (o.subscription_ends_at && new Date(o.subscription_ends_at) < new Date()) return { label: "Expiré", color: "amber" as const };
  return { label: "Actif", color: "green" as const };
}

const EMPTY: OrgFormValues = {
  name: "", contactName: "", contactEmail: "", contactPhone: "", plan: "pro", monthlyLeadQuota: 2000, maxUsers: 3,
  subscriptionEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), notes: "", ownerEmail: "", ownerName: "",
};

export function ClientsManager() {
  const params = useSearchParams();
  const toast = useToast();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const prefill: OrgFormValues = {
    ...EMPTY,
    name: params.get("company") ?? "",
    contactName: params.get("contact") ?? "",
    contactEmail: params.get("email") ?? "",
    contactPhone: params.get("phone") ?? "",
    ownerEmail: params.get("email") ?? "",
    ownerName: params.get("contact") ?? "",
  };

  const load = useCallback(async () => {
    try {
      const r = await api<{ organizations: Org[] }>("/api/admin/organizations");
      setOrgs(r.organizations);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (o: Org) => {
    const suspend = o.status === "active";
    let reason: string | null = null;
    if (suspend) {
      reason = window.prompt(`Couper l'accès de « ${o.name} » ?\nTous ses utilisateurs seront déconnectés immédiatement.\n\nMotif (optionnel) :`, "Abonnement impayé");
      if (reason === null) return;
    }
    setBusyId(o.id);
    try {
      await api(`/api/admin/organizations/${o.id}`, { method: "PATCH", body: { status: suspend ? "suspended" : "active", suspendedReason: reason } });
      toast("success", suspend ? `Accès de ${o.name} coupé.` : `Accès de ${o.name} rétabli.`);
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = (orgs ?? []).filter((o) => !q || [o.name, o.contact_name, o.contact_email, o.contact_phone].some((v) => v?.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="fade-in">
      <PageHeader title="Clients & accès" subtitle="Créez les comptes entreprises, gérez abonnements et quotas, coupez ou rétablissez l'accès en un clic."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="size-4" /> Nouveau client</button>} />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {orgs === null ? (
          <div className="flex justify-center py-16"><Spinner className="size-6 text-brand-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Building2 className="size-6" />} title="Aucun client" text="Créez votre premier client : il recevra un identifiant et un mot de passe pour se connecter."
            action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="size-4" /> Créer un client</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Formule</th><th className="px-5 py-3">Leads du mois</th><th className="px-5 py-3">Fin d&apos;abonnement</th><th className="px-5 py-3">Dernière connexion</th><th className="px-5 py-3 text-right">Accès</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => {
                  const st = orgState(o);
                  const pct = o.monthly_lead_quota ? Math.min(100, (o.leads_this_month / o.monthly_lead_quota) * 100) : 0;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <Link href={`/admin/clients/${o.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{o.name}</Link>
                        <p className="text-xs text-slate-500">{o.contact_name ?? o.contact_email ?? "—"} · {o.users_count} utilisateur(s)</p>
                      </td>
                      <td className="px-5 py-3.5"><Badge color={st.color} dot>{st.label}</Badge></td>
                      <td className="px-5 py-3.5 capitalize text-slate-600">{o.plan}</td>
                      <td className="px-5 py-3.5">
                        <span className="tabular-nums text-slate-700">{fmtNum(o.leads_this_month)} / {fmtNum(o.monthly_lead_quota)}</span>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{o.subscription_ends_at ? fmtDate(o.subscription_ends_at, false) : "Illimité"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{fmtDate(o.last_login_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => toggle(o)}
                          disabled={busyId === o.id}
                          className={o.status === "active"
                            ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"}
                        >
                          {busyId === o.id ? <Spinner className="size-3.5" /> : o.status === "active" ? <Ban className="size-3.5" /> : <PlayCircle className="size-3.5" />}
                          {o.status === "active" ? "Couper l'accès" : "Rétablir"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau client" wide>
        <OrgForm
          initial={prefill}
          withOwner
          submitLabel="Créer le client et générer les accès"
          onSubmit={async (v) => {
            try {
              const r = await api<{ id: string; credentials: { email: string; password: string } }>("/api/admin/organizations", {
                body: { ...v, subscriptionEndsAt: v.subscriptionEndsAt || null, requestId: params.get("request") ?? undefined },
              });
              setCreating(false);
              setCreds({ ...r.credentials, company: v.name, phone: v.contactPhone });
              toast("success", `Client ${v.name} créé.`);
              await load();
            } catch (e) {
              toast("error", e instanceof Error ? e.message : "Erreur");
            }
          }}
        />
      </Modal>
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
