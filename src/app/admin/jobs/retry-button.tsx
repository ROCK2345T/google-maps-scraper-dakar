"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/components/api-client";
import { useToast } from "@/components/toast";

export function RetryButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/admin/jobs/${id}`, { method: "POST" });
          toast("success", "Recherche relancée.");
          router.refresh();
        } catch (e) {
          toast("error", e instanceof Error ? e.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> Relancer
    </button>
  );
}
