"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { api } from "./api-client";
import { Spinner } from "./ui";

export function AccessRequestForm() {
  const [f, setF] = useState({ company: "", contactName: "", email: "", phone: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (done) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-brand-600" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Demande envoyée !</h3>
        <p className="mt-1 text-sm text-slate-600">Nous vous recontactons très rapidement pour activer votre accès.</p>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/access-requests", { body: f });
          setDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="text-lg font-semibold text-slate-900">Demande d&apos;accès</h3>
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div><label className="label">Entreprise *</label><input className="input" required value={f.company} onChange={set("company")} placeholder="Nom de votre société" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Votre nom</label><input className="input" value={f.contactName} onChange={set("contactName")} /></div>
        <div><label className="label">Téléphone / WhatsApp</label><input className="input" value={f.phone} onChange={set("phone")} placeholder="77 123 45 67" /></div>
      </div>
      <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set("email")} placeholder="vous@entreprise.sn" /></div>
      <div><label className="label">Votre besoin</label><textarea className="input min-h-24" value={f.message} onChange={set("message")} placeholder="Ex : nous cherchons des cliniques et pharmacies à Dakar…" /></div>
      <input type="text" name="website" value={f.website} onChange={set("website")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : <Send className="size-4" />} Envoyer ma demande</button>
    </form>
  );
}
