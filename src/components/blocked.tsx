import { Lock, MessageCircle, Mail } from "lucide-react";
import { Logo } from "./ui";
import { LogoutButton } from "./logout-button";

export function BlockedScreen({ reason, whatsapp, email }: { reason: string; whatsapp?: string; email?: string }) {
  const expired = reason === "expired";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Lock className="size-7" /></div>
        <h1 className="text-xl font-bold text-slate-900">{expired ? "Abonnement expiré" : "Accès suspendu"}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {expired
            ? "La période d'abonnement de votre entreprise est terminée. Renouvelez-la pour retrouver l'accès à vos recherches et exports."
            : "L'accès de votre entreprise au logiciel a été suspendu par votre fournisseur. Vos données sont conservées."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {whatsapp && (
            <a className="btn-primary" href={`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Bonjour, je souhaite réactiver mon accès LeadScraper Dakar.")}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> Contacter sur WhatsApp
            </a>
          )}
          {email && <a className="btn-secondary" href={`mailto:${email}`}><Mail className="size-4" /> {email}</a>}
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
