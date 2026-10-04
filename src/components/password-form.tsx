"use client";

import { useState } from "react";
import { api } from "./api-client";
import { useToast } from "./toast";
import { Spinner } from "./ui";

export function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== confirm) return toast("error", "Les deux nouveaux mots de passe ne correspondent pas.");
        setBusy(true);
        try {
          await api("/api/account/password", { body: { current, next } });
          toast("success", "Mot de passe modifié.");
          setCurrent(""); setNext(""); setConfirm("");
        } catch (err) {
          toast("error", err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div><label className="label">Mot de passe actuel</label><input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" /></div>
      <div><label className="label">Nouveau mot de passe</label><input className="input" type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" /></div>
      <div><label className="label">Confirmer</label><input className="input" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></div>
      <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Enregistrer</button>
    </form>
  );
}
