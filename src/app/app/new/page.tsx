import { Suspense } from "react";
import { SearchWizard } from "./wizard";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Nouvelle recherche" };

export default function NewSearchPage() {
  return (
    <div className="fade-in">
      <PageHeader title="Nouvelle recherche" subtitle="Trois étapes : activités, zones, options. Le fichier Excel est prêt dès la fin de la collecte." />
      <Suspense>
        <SearchWizard />
      </Suspense>
    </div>
  );
}
