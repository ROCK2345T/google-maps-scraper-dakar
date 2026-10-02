"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Ban, KeyRound, LogOut, Pencil, PlayCircle, Trash2, UserPlus, UserX, UserCheck } from "lucide-react";
import { api } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/modal";
import { CredentialsModal, type Credentials } from "@/components/credentials-modal";
import { OrgForm } from "@/components/org-form";
import { Badge, JOB_STATUS, ProgressBar, StatCard, fmtDate, fmtNum } from "@/components/ui";
import { orgState } from "../manager";

type Org = {
  id: string; name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; status: "active" | "suspended";
  suspended_reason: string | null; suspended_at: string | null; plan: string; monthly_lead_quota: number; max_users: number;
  subscription_ends_at: string | null; notes: string | null; created_at: string;
};
type User = { id: string; email: string; full_name: string | null; role: string; is_active: boolean; last_login_at: string | null };
type Job = { id: string; title: string; status: string; leads_count: number; created_at: string };
type Audit = { action: string; actor_email: string | null; details: Record<string, unknown>; created_at: string };

const ACTIONS: Record<string, string> = {
  login: "Connexion", organization_created: "Client créé", organization_updated: "Client modifié", organization_suspended: "Accès coupé",
  organization_reactivated: "Accès rétabli", user_created: "Utilisateur ajouté", user_reset_password: "Mot de passe réinitialisé",
  user_deactivate: "Utilisateur désactivé", user_activate: "Utilisateur réactivé", user_deleted: "Utilisateur supprimé",
  job_created: "Recherche lancée", job_cancelled: "Recherche arrêtée", export: "Export", password_changed: "Mot de passe changé",
  user_logout_everywhere: "Déconnexion forcée",
};

export function ClientDetail({ org, users, jobs, usage, audit }: { org: Org; users: User[]; jobs: Job[]; usage: { month: number; total: number }; audit: Audit[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [newUser, setNewUser] = useState({ email: "", fullName: "", role: "member" });
  const st = orgState(org);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast("success", success);
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
    }
  };

  const toggle = () => {
    if (org.status === "active") {
      const reason = window.prompt("Motif de la coupure (visible dans le journal) :", "Abonnement impayé");
      if (reason === null) return;
      run(() => api(`/api/admin/organizations/${org.id}`, { method: "PATCH", body: { status: "suspended", suspendedReason: reason } }), "Accès coupé : utilisateurs déconnectés.");
    } else {
      run(() => api(`/api/admin/organizations/${org.id}`, { method: "PATCH", body: { status: "active" } }), "Accès rétabli.");
    }
  };

  const userAction = async (u: User, action: string) => {
    try {
      const r = await api<{ credentials?: { email: string; password: string } }>(`/api/admin/users/${u.id}`, { method: "PATCH", body: { action } });
      if (r.credentials) setCreds({ ...r.credentials, company: org.name, phone: org.contact_phone });
      toast("success", "Action effectuée.");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
    }
  };

  const pct = org.monthly_lead_quota ? (usage.month / org.monthly_lead_quota) * 100 : 0;

  return (
    <div className="fade-in">
      <Link href="/admin/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"><ArrowLeft className="size-4" /> Tous les clients</Link>

      <div className="card mb-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Badge color={st.color} dot>{st.label}</Badge><span className="text-xs capitalize text-slate-500">Formule {org.plan}</span></div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{org.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{[org.contact_name, org.contact_phone, org.contact_email].filter(Boolean).join(" · ") || "Aucun contact renseigné"}</p>
            {org.status === "suspended" && <p className="mt-2 text-sm text-red-700">Suspendu le {fmtDate(org.suspended_at)}{org.suspended_reason ? ` — ${org.suspended_reason}` : ""}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Modifier</button>
            <button className={org.status === "active" ? "btn-danger" : "btn-primary"} onClick={toggle}>
              {org.status === "active" ? <><Ban className="size-4" /> Couper l&apos;accès</> : <><PlayCircle className="size-4" /> Rétablir l&apos;accès</>}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Leads ce mois</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">{fmtNum(usage.month)} <span className="text-sm font-medium text-slate-400">/ {fmtNum(org.monthly_lead_quota)}</span></p>
          <div className="mt-3"><ProgressBar value={pct} /></div>
        </div>
        <StatCard label="Leads au total" value={fmtNum(usage.total)} />
        <StatCard label="Fin d'abonnement" value={org.subscription_ends_at ? fmtDate(org.subscription_ends_at, false) : "Illimité"} hint={`Client depuis le ${fmtDate(org.created_at, false)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <span className="font-semibold text-slate-900">Utilisateurs ({users.length}/{org.max_users})</span>
            <button className="btn-secondary py-1.5" onClick={() => setAdding(true)}><UserPlus className="size-4" /> Ajouter</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{u.full_name ?? u.email} {!u.is_active && <Badge color="red">Désactivé</Badge>}</p>
                  <p className="truncate text-xs text-slate-500">{u.email} · {u.role === "owner" ? "Responsable" : "Utilisateur"} · dernière connexion {fmtDate(u.last_login_at)}</p>
                </div>
                <div className="flex gap-1">
                  <IconBtn title="Nouveau mot de passe" onClick={() => confirm(`Générer un nouveau mot de passe pour ${u.email} ?`) && userAction(u, "reset_password")}><KeyRound className="size-4" /></IconBtn>
                  <IconBtn title="Déconnecter partout" onClick={() => userAction(u, "logout_everywhere")}><LogOut className="size-4" /></IconBtn>
                  {u.is_active
                    ? <IconBtn title="Désactiver" onClick={() => userAction(u, "deactivate")}><UserX className="size-4" /></IconBtn>
                    : <IconBtn title="Réactiver" onClick={() => userAction(u, "activate")}><UserCheck className="size-4" /></IconBtn>}
                  <IconBtn title="Supprimer" danger onClick={() => confirm(`Supprimer définitivement ${u.email} ?`) && run(() => api(`/api/admin/users/${u.id}`, { method: "DELETE" }), "Utilisateur supprimé.")}><Trash2 className="size-4" /></IconBtn>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">Recherches récentes</div>
          <ul className="divide-y divide-slate-100">
            {jobs.length === 0 && <li className="px-6 py-8 text-center text-sm text-slate-500">Aucune recherche.</li>}
            {jobs.map((j) => {
              const s = JOB_STATUS[j.status] ?? JOB_STATUS.queued;
              return (
                <li key={j.id}>
                  <Link href={`/admin/jobs/${j.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{j.title}</p><p className="text-xs text-slate-500">{fmtDate(j.created_at)} · {fmtNum(j.leads_count)} leads</p></div>
                    <Badge color={s.color} dot>{s.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Notes internes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{org.notes || "—"}</p>
          <button className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline"
            onClick={() => {
              if (window.prompt(`Suppression DÉFINITIVE de « ${org.name} », de ses utilisateurs et de tous ses leads.\nTapez SUPPRIMER pour confirmer :`) !== "SUPPRIMER") return;
              api(`/api/admin/organizations/${org.id}`, { method: "DELETE" }).then(() => { toast("success", "Client supprimé."); router.push("/admin/clients"); }).catch((e) => toast("error", e.message));
            }}>
            <Trash2 className="size-4" /> Supprimer ce client
          </button>
        </div>
        <div className="card">
          <div className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">Activité</div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {audit.length === 0 && <li className="px-6 py-8 text-center text-sm text-slate-500">Aucune activité.</li>}
            {audit.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 px-6 py-2.5 text-sm">
                <span className="text-slate-700">{ACTIONS[a.action] ?? a.action} <span className="text-xs text-slate-400">{a.actor_email}</span></span>
                <span className="whitespace-nowrap text-xs text-slate-500">{fmtDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier le client" wide>
        <OrgForm
          initial={{
            name: org.name, contactName: org.contact_name ?? "", contactEmail: org.contact_email ?? "", contactPhone: org.contact_phone ?? "",
            plan: org.plan, monthlyLeadQuota: org.monthly_lead_quota, maxUsers: org.max_users,
            subscriptionEndsAt: org.subscription_ends_at ? org.subscription_ends_at.slice(0, 10) : "", notes: org.notes ?? "",
          }}
          submitLabel="Enregistrer"
          onSubmit={async (v) => {
            await run(() => api(`/api/admin/organizations/${org.id}`, {
              method: "PATCH",
              body: { name: v.name, contactName: v.contactName || null, contactEmail: v.contactEmail || null, contactPhone: v.contactPhone || null, plan: v.plan, monthlyLeadQuota: v.monthlyLeadQuota, maxUsers: v.maxUsers, subscriptionEndsAt: v.subscriptionEndsAt || null, notes: v.notes || null },
            }), "Client mis à jour.");
            setEditing(false);
          }}
        />
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title="Ajouter un utilisateur">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await api<{ credentials: { email: string; password: string } }>(`/api/admin/organizations/${org.id}/users`, { body: newUser });
            setAdding(false);
            setNewUser({ email: "", fullName: "", role: "member" });
            setCreds({ ...r.credentials, company: org.name, phone: org.contact_phone });
            router.refresh();
          } catch (err) {
            toast("error", err instanceof Error ? err.message : "Erreur");
          }
        }}>
          <div><label className="label">Email de connexion *</label><input className="input" type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
          <div><label className="label">Nom</label><input className="input" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} /></div>
          <div><label className="label">Rôle</label>
            <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="member">Utilisateur</option><option value="owner">Responsable</option>
            </select>
          </div>
          <button className="btn-primary w-full">Créer et générer le mot de passe</button>
        </form>
      </Modal>
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className={`rounded-lg p-2 transition ${danger ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}
