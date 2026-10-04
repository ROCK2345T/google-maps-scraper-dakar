import "server-only";
import { redirect } from "next/navigation";
import { accessBlockReason, ensureSuperAdmin, getSessionUser } from "./auth";

/** Pour les pages serveur : renvoie l'utilisateur ou redirige vers la connexion. */
export async function pageUser() {
  await ensureSuperAdmin();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return { user, blocked: accessBlockReason(user) };
}
