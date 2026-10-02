import { Suspense } from "react";
import { ClientsManager } from "./manager";

export const metadata = { title: "Clients & accès" };

export default function ClientsPage() {
  return <Suspense><ClientsManager /></Suspense>;
}
