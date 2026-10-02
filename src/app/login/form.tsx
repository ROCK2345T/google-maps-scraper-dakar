"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { api } from "@/components/api-client";
import { Spinner } from "@/components/ui";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("expired") ? "Votre session a expiré, reconnectez-vous." : null);

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ redirect: string }>("/api/auth/login", { body: { email, password } });
          window.location.href = r.redirect;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur de connexion");
          setBusy(false);
        }
      }}
    >
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.sn" />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <div className="relative">
          <input id="password" className="input pr-10" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Afficher le mot de passe">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : <LogIn className="size-4" />} Se connecter</button>
    </form>
  );
}
