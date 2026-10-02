"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";
import { Modal } from "./modal";

export type Credentials = { email: string; password: string; company?: string; phone?: string | null };

export function CredentialsModal({ creds, onClose }: { creds: Credentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!creds) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const text =
    `Bonjour${creds.company ? " " + creds.company : ""},\n\n` +
    `Votre accès à LeadScraper Dakar est prêt :\n` +
    `🔗 ${url}\n` +
    `📧 Email : ${creds.email}\n` +
    `🔑 Mot de passe : ${creds.password}\n\n` +
    `Pensez à changer votre mot de passe dans « Mon compte » après la première connexion.`;
  const phone = creds.phone?.replace(/\D/g, "");
  const waNumber = phone ? (phone.length === 9 ? `221${phone}` : phone) : "";

  return (
    <Modal open onClose={onClose} title="Identifiants à transmettre">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Ce mot de passe n&apos;est affiché qu&apos;<strong>une seule fois</strong>. Copiez-le ou envoyez-le maintenant.
      </div>
      <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 font-mono text-sm">
        <p><span className="text-slate-500">Lien :</span> {url}</p>
        <p><span className="text-slate-500">Email :</span> {creds.email}</p>
        <p className="flex items-center gap-2"><KeyRound className="size-4 text-brand-600" /><span className="text-lg font-bold tracking-wider text-slate-900">{creds.password}</span></p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copié !" : "Copier le message"}
        </button>
        <a className="btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`}>
          <MessageCircle className="size-4 text-emerald-600" /> Envoyer par WhatsApp
        </a>
        <a className="btn-ghost" href={`mailto:${creds.email}?subject=${encodeURIComponent("Vos accès LeadScraper Dakar")}&body=${encodeURIComponent(text)}`}>Par email</a>
      </div>
    </Modal>
  );
}
