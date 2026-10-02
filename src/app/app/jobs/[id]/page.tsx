import { JobView } from "@/components/job-view";

export const metadata = { title: "Résultats" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView id={id} backHref="/app/history" />;
}
