import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __sql?: Sql };

/**
 * Client PostgreSQL unique par instance de fonction.
 * `prepare: false` est obligatoire avec le pooler Supabase en mode transaction (port 6543).
 */
export function db(): Sql {
  if (!globalForDb.__sql) {
    const url = env.databaseUrl;
    if (!url) throw new Error("DATABASE_URL n'est pas configurée.");
    globalForDb.__sql = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: url.includes("sslmode=disable") ? false : "require",
      onnotice: () => {},
      transform: { undefined: null },
    });
  }
  return globalForDb.__sql;
}

export type { Sql };
