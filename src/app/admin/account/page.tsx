import { PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";

export const metadata = { title: "Mon compte" };

export default function AdminAccount() {
  return (
    <div className="fade-in max-w-xl">
      <PageHeader title="Mon compte administrateur" subtitle="Changez le mot de passe initial dès votre première connexion." />
      <div className="card p-6"><PasswordForm /></div>
    </div>
  );
}
