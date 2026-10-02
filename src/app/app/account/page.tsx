import { pageUser } from "@/lib/session-page";
import { PageHeader, fmtDate, fmtNum } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const { user } = await pageUser();
  const wa = env.supportWhatsapp;
  return (
    <div className="fade-in">
      <PageHeader title="Mon compte" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Informations</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Nom", user.fullName ?? "—"],
              ["Email de connexion", user.email],
              ["Entreprise", user.organizationName ?? "—"],
              ["Rôle", user.role === "owner" ? "Responsable du compte" : "Utilisateur"],
              ["Quota mensuel", `${fmtNum(user.monthlyLeadQuota)} leads`],
              ["Abonnement", user.subscriptionEndsAt ? `jusqu'au ${fmtDate(user.subscriptionEndsAt, false)}` : "Actif"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-3 last:border-0">
                <dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          {wa && (
            <a href={`https://wa.me/${wa.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-secondary mt-5 w-full">
              Besoin d&apos;aide ou de plus de leads ? Contactez le support
            </a>
          )}
        </div>
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Changer le mot de passe</h2>
          <p className="mt-1 text-sm text-slate-500">Les autres appareils connectés seront déconnectés.</p>
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
