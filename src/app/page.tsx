import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSpreadsheet, Globe, Lock, MapPin, MessageCircle, Phone, Search, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/ui";
import { AccessRequestForm } from "@/components/access-request-form";
import { env } from "@/lib/env";

export const revalidate = 3600;

const FEATURES = [
  { icon: MapPin, title: "38 zones du Sénégal", text: "Plateau, Almadies, Mermoz, Parcelles, Pikine, Thiès, Saint-Louis, Touba… Ciblez au quartier près." },
  { icon: Phone, title: "Numéros +221 normalisés", text: "Opérateur détecté (Orange, Free, Expresso) et lien WhatsApp direct pour chaque mobile." },
  { icon: Globe, title: "Emails & réseaux sociaux", text: "Le site officiel de chaque entreprise est analysé : email, Facebook, Instagram, LinkedIn, TikTok." },
  { icon: FileSpreadsheet, title: "Export Excel professionnel", text: "Fichier mis en forme, filtres activés, liens cliquables et feuille de synthèse. CSV compatible Excel FR." },
  { icon: CheckCircle2, title: "Zéro doublon, toujours du neuf", text: "Un contact n'est jamais livré deux fois à votre entreprise : chaque nouvelle recherche, même sur la même niche, ne fournit que des prospects inédits." },
  { icon: Zap, title: "Moteur multi-sources", text: "Plusieurs sources de données avec bascule automatique : si une source est indisponible, une autre prend le relais." },
  { icon: ShieldCheck, title: "Sécurisé & privé", text: "Chaque entreprise a son espace isolé, ses utilisateurs et son historique. Données hébergées sur une infrastructure cloud." },
];

const STEPS = [
  { n: "1", title: "Choisissez", text: "Activités (BTP, santé, immobilier…) et quartiers ciblés." },
  { n: "2", title: "Lancez", text: "La collecte tourne en arrière-plan, même si vous fermez la page." },
  { n: "3", title: "Exportez", text: "Téléchargez votre fichier Excel et contactez vos prospects sur WhatsApp." },
];

export default function Landing() {
  const wa = env.supportWhatsapp;
  return (
    <div className="bg-white">
      <div className="flag-bar h-1" />
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#fonctionnalites" className="hidden px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">Fonctionnalités</a>
            <a href="#demande" className="hidden px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">Tarifs & accès</a>
            <Link href="/login" className="btn-primary"><Lock className="size-4" /> Espace client</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,#d1fadf_0%,transparent_60%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              🇸🇳 Conçu pour les entreprises sénégalaises
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              Vos prochains clients à Dakar, <span className="text-brand-600">en un fichier Excel.</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              LeadScraper Dakar trouve les entreprises de votre secteur cible avec leurs téléphones, WhatsApp, emails, sites web et réseaux sociaux.
              Prospectez plus vite, sans saisie manuelle.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#demande" className="btn-primary px-6 py-3 text-base">Demander un accès <ArrowRight className="size-4" /></a>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">Se connecter</Link>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {["Aucune installation", "Fonctionne sur mobile", "Données mises à jour en direct", "Support WhatsApp"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-brand-600" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="card overflow-hidden shadow-xl shadow-brand-900/10">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 text-xs font-medium text-slate-500">Agences immobilières — Almadies</span>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {[
                ["Immo Prestige Almadies", "+221 77 *** ** 12", "Orange", "contact@…"],
                ["Teranga Habitat", "+221 78 *** ** 45", "Orange", "info@…"],
                ["Ngor Résidences", "+221 76 *** ** 08", "Free", "—"],
                ["Atlantique Conseil Immobilier", "+221 33 *** ** 90", "Fixe", "direction@…"],
              ].map(([n, p, o, e]) => (
                <div key={n} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{n}</p><p className="text-xs text-slate-500">{e}</p></div>
                  <div className="text-right"><p className="whitespace-nowrap font-medium text-slate-700">{p}</p><span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><MessageCircle className="size-3" />{o}</span></div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-sm font-semibold text-white">
              <span>248 entreprises trouvées</span><span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="size-4" /> Export Excel</span>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="border-y border-slate-100 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Tout pour prospecter efficacement</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">Une plateforme pensée pour les commerciaux, agences et PME qui vendent aux entreprises au Sénégal.</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><f.icon className="size-5" /></div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{s.n}</span>
                <div><h3 className="font-semibold text-slate-900">{s.title}</h3><p className="mt-1 text-sm text-slate-600">{s.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demande" className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Obtenez votre accès entreprise</h2>
            <p className="mt-3 text-slate-600">
              Les comptes sont créés par notre équipe pour garantir un service de qualité. Laissez vos coordonnées : nous vous contactons
              avec une démonstration et une offre adaptée à votre volume de prospection.
            </p>
            <div className="mt-8 space-y-3">
              {["Abonnement mensuel, sans engagement", "Quota de leads adapté à votre équipe", "Plusieurs utilisateurs par entreprise", "Accompagnement au démarrage"].map((t) => (
                <p key={t} className="flex items-center gap-3 text-slate-700"><CheckCircle2 className="size-5 text-brand-600" />{t}</p>
              ))}
            </div>
            {wa && (
              <a href={`https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent("Bonjour, je souhaite un accès à LeadScraper Dakar.")}`} target="_blank" rel="noreferrer" className="btn-secondary mt-8">
                <MessageCircle className="size-4 text-emerald-600" /> Écrire sur WhatsApp
              </a>
            )}
          </div>
          <div className="card p-6 sm:p-8"><AccessRequestForm /></div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo className="text-sm" />
          <p>© {new Date().getFullYear()} LeadScraper Dakar · Données d&apos;entreprises publiquement accessibles</p>
          <Link href="/login" className="inline-flex items-center gap-1 font-medium text-brand-700"><Search className="size-4" /> Espace client</Link>
        </div>
      </footer>
    </div>
  );
}
