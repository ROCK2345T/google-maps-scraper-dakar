import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { db } from "@/lib/db";
import { pageUser } from "@/lib/session-page";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await pageUser();
  if (user.role !== "superadmin") redirect("/app");
  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from app.access_requests where status = 'new'`;
  return (
    <Shell
      area="admin"
      user={{ name: user.fullName ?? "Administrateur", email: user.email }}
      nav={[
        { href: "/admin", label: "Vue d'ensemble", icon: "LayoutDashboard" },
        { href: "/admin/clients", label: "Clients & accès", icon: "Building2" },
        { href: "/admin/requests", label: "Demandes d'accès", icon: "Inbox", badge: n },
        { href: "/admin/jobs", label: "Recherches", icon: "Activity" },
        { href: "/admin/audit", label: "Journal d'audit", icon: "ScrollText" },
        { href: "/admin/system", label: "Système & sources", icon: "Settings2" },
        { href: "/admin/account", label: "Mon compte", icon: "UserCog" },
      ]}
    >
      {children}
    </Shell>
  );
}
