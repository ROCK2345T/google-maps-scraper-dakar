"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.href = "/login";
      }}
    >
      <LogOut className="size-4" /> Se déconnecter
    </button>
  );
}
