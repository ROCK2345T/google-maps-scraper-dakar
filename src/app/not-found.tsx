import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <h1 className="mt-6 text-3xl font-bold text-slate-900">Page introuvable</h1>
      <p className="text-slate-500">Le lien est peut-être incorrect ou la page a été déplacée.</p>
      <Link href="/" className="btn-primary mt-2">Retour à l&apos;accueil</Link>
    </div>
  );
}
