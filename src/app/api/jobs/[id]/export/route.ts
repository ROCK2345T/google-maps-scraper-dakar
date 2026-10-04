import { audit, handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { buildCsv, buildWorkbook, safeFilename, type LeadRow } from "@/lib/export";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const filter = url.searchParams.get("filter") ?? "all";
  const sql = db();

  const [job] = await sql<{ id: string; title: string; organization_id: string; org_name: string; created_at: Date; params: unknown }[]>`
    select j.id, j.title, j.organization_id, o.name as org_name, j.created_at, j.params
    from app.jobs j join app.organizations o on o.id = j.organization_id where j.id = ${id}`;
  if (!job || (user.role !== "superadmin" && job.organization_id !== user.organizationId)) throw new HttpError(404, "Recherche introuvable");

  const leads = await sql<LeadRow[]>`
    select name, category, activity, zone, phone, operator, whatsapp, email, emails, website, address, rating,
           reviews_count, facebook, instagram, linkedin, twitter, tiktok, opening_hours, latitude, longitude, maps_url, source
    from app.leads where job_id = ${id}
      and (${filter} <> 'phone' or phone is not null)
      and (${filter} <> 'email' or email is not null)
      and (${filter} <> 'whatsapp' or whatsapp is not null)
    order by name`;

  const base = `leads_${safeFilename(job.title)}_${new Date().toISOString().slice(0, 10)}`;
  await audit(user, "export", { jobId: id, format, count: leads.length }, job.organization_id);

  if (format === "csv") {
    return new Response(buildCsv(leads), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }
  const buf = await buildWorkbook(leads, { title: job.title, company: job.org_name, generatedAt: new Date() });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
});
