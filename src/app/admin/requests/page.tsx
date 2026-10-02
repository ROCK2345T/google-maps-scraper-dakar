import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { RequestsList } from "./list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demandes d'accès" };

export default async function RequestsPage() {
  const rows = await db()`select id, company, contact_name, email, phone, message, status, created_at from app.access_requests order by created_at desc limit 300`;
  return (
    <div className="fade-in">
      <PageHeader title="Demandes d'accès" subtitle="Prospects ayant rempli le formulaire de votre page d'accueil. Convertissez-les en clients en un clic." />
      <RequestsList rows={JSON.parse(JSON.stringify(rows))} />
    </div>
  );
}
