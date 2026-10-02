import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Shell } from "@/components/shell";
import { BlockedScreen } from "@/components/blocked";
import { pageUser } from "@/lib/session-page";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, blocked } = await pageUser();
  if (user.role === "superadmin") redirect("/admin");
  if (blocked) return <BlockedScreen reason={blocked} whatsapp={env.supportWhatsapp} email={env.supportEmail} />;

  const daysLeft = user.subscriptionEndsAt ? Math.ceil((user.subscriptionEndsAt.getTime() - Date.now()) / 86_400_000) : null;
  const banner =
    daysLeft !== null && daysLeft <= 7 ? (
      <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800">
        <AlertTriangle className="size-4" /> Votre abonnement expire dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}. Pensez à le renouveler.
      </div>
    ) : null;

  return (
    <Shell
      area="client"
      user={{ name: user.fullName ?? user.email, email: user.email, org: user.organizationName }}
      banner={banner}
      nav={[
        { href: "/app", label: "Tableau de bord", icon: "LayoutDashboard" },
        { href: "/app/new", label: "Nouvelle recherche", icon: "Search" },
        { href: "/app/history", label: "Mes recherches", icon: "History" },
        { href: "/app/account", label: "Mon compte", icon: "UserCog" },
      ]}
    >
      {children}
    </Shell>
  );
}
