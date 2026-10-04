"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Mail, MessageCircle, UserPlus } from "lucide-react";
import { api } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, fmtDate } from "@/components/ui";

type Row = { id: string; company: string; contact_name: string | null; email: string | null; phone: string | null; message: string | null; status: string; created_at: string };
const ST: Record<string, { label: string; color: "amber" | "blue" | "green" | "slate" }> = {
  new: { label: "Nouvelle", color: "amber" }, contacted: { label: "Contactée", color: "blue" }, converted: { label: "Convertie", color: "green" }, rejected: { label: "Refusée", color: "slate" },
};

export function RequestsList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const setStatus = async (id: string, status: string) => {
    try {
      await api(`/api/admin/requests/${id}`, { method: "PATCH", body: { status } });
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erreur");
    }
  };
  if (!rows.length) return <div className="card"><EmptyState icon={<Inbox className="size-6" />} title="Aucune demande pour l'instant" text="Partagez le lien de votre page d'accueil : les entreprises intéressées apparaîtront ici." /></div>;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const wa = r.phone?.replace(/\D/g, "");
        const st = ST[r.status] ?? ST.new;
        const convert = `/admin/clients?new=1&request=${r.id}&company=${encodeURIComponent(r.company)}&contact=${encodeURIComponent(r.contact_name ?? "")}&email=${encodeURIComponent(r.email ?? "")}&phone=${encodeURIComponent(r.phone ?? "")}`;
        return (
          <div key={r.id} className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{r.company}</h3><Badge color={st.color}>{st.label}</Badge><span className="text-xs text-slate-500">{fmtDate(r.created_at)}</span></div>
              <p className="mt-1 text-sm text-slate-600">{[r.contact_name, r.phone, r.email].filter(Boolean).join(" · ")}</p>
              {r.message && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{r.message}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {wa && <a className="btn-secondary py-2" target="_blank" rel="noreferrer" href={`https://wa.me/${wa.length === 9 ? "221" + wa : wa}`} onClick={() => r.status === "new" && setStatus(r.id, "contacted")}><MessageCircle className="size-4 text-emerald-600" /> WhatsApp</a>}
              {r.email && <a className="btn-secondary py-2" href={`mailto:${r.email}`} onClick={() => r.status === "new" && setStatus(r.id, "contacted")}><Mail className="size-4" /> Email</a>}
              {r.status !== "converted" && <Link className="btn-primary py-2" href={convert}><UserPlus className="size-4" /> Créer le client</Link>}
              {r.status !== "rejected" && r.status !== "converted" && <button className="btn-ghost py-2" onClick={() => setStatus(r.id, "rejected")}>Refuser</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
