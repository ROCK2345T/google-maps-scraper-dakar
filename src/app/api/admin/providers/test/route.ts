import { z } from "zod";
import { assertSameOrigin, handler, ok, parseBody, requireAdmin } from "@/lib/api";
import { ZONE_BY_ID } from "@/lib/data/zones";
import { osmFiltersFor } from "@/lib/data/sectors";
import { PROVIDERS } from "@/lib/scraper/engine";
import type { ProviderId } from "@/lib/scraper/types";

export const maxDuration = 120;
const schema = z.object({
  keyword: z.string().trim().min(2).default("Pharmacie"),
  zoneId: z.string().default("plateau"),
});

/** Teste chaque source indépendamment : diagnostic des clés et des blocages. */
export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  await requireAdmin();
  const { keyword, zoneId } = await parseBody(req, schema);
  const zone = ZONE_BY_ID.get(zoneId) ?? ZONE_BY_ID.get("plateau")!;
  const input = {
    keyword, zoneName: zone.name, queryHint: zone.queryHint, lat: zone.lat, lng: zone.lng,
    radiusKm: zone.radiusKm, limit: 10, osmFilters: osmFiltersFor(keyword),
  };
  const results = await Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async (id) => {
      const p = PROVIDERS[id];
      if (!p.available()) return { id, label: p.label, configured: false, ok: false, count: 0, ms: 0, sample: [] as string[], error: "Non configurée" };
      const t0 = Date.now();
      try {
        const places = await p.search(input, Date.now() + 80_000);
        return {
          id, label: p.label, configured: true, ok: true, count: places.length, ms: Date.now() - t0,
          sample: places.slice(0, 3).map((x) => `${x.name}${x.phone ? " · " + x.phone : ""}`), error: null,
        };
      } catch (e) {
        return { id, label: p.label, configured: true, ok: false, count: 0, ms: Date.now() - t0, sample: [], error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return ok({ results });
});
