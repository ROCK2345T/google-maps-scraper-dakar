import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getSessionUser, ensureSuperAdmin } from "@/lib/auth";
import { LoginForm } from "./form";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  try {
    await ensureSuperAdmin();
    const user = await getSessionUser();
    if (user) redirect(user.role === "superadmin" ? "/admin" : "/app");
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/"><Logo /></Link>
          <h1 className="mt-10 text-2xl font-bold tracking-tight text-slate-900">Connexion à votre espace</h1>
          <p className="mt-2 text-sm text-slate-500">Utilisez les identifiants fournis par votre conseiller.</p>
          <Suspense><LoginForm /></Suspense>
          <p className="mt-8 text-sm text-slate-500">
            Pas encore de compte ? <Link href="/#demande" className="font-semibold text-brand-700 hover:underline">Demander un accès</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 lg:block">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="text-3xl font-bold leading-tight">« Des centaines de prospects qualifiés à Dakar, prêts dans Excel en quelques minutes. »</p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
            {[["+221", "numéros normalisés"], ["WhatsApp", "lien direct"], ["Excel", "prêt à l'emploi"]].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-white/10 p-4 backdrop-blur"><p className="text-lg font-bold">{a}</p><p className="text-brand-100">{b}</p></div>
            ))}
          </div>
          <div className="flag-bar mt-10 h-1.5 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
