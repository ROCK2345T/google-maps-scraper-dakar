"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div key={t.id} className="fade-in pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg">
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />}
            <span className="text-slate-700">{t.text}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-2 text-slate-400 hover:text-slate-600" aria-label="Fermer">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
