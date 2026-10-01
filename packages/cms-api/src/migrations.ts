import { createHash } from "node:crypto";
import { Client } from "pg";
import { newId } from "./ids.js";

const MIGRATIONS = [
  {
    id: "0001_api_keys",
    sql: `CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.api_keys (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);`
  }
] as const;

/** Applies checksum-checked migrations under a transaction-scoped advisory lock. */
export async function migrateCms(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(134657, 1)");
    await client.query("CREATE SCHEMA IF NOT EXISTS cms");
    await client.query(`CREATE TABLE IF NOT EXISTS cms.migrations (
      id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const migration of MIGRATIONS) {
      const checksum = createHash("sha256").update(migration.sql).digest("hex");
      const existing = await client.query<{ checksum: string }>("SELECT checksum FROM cms.migrations WHERE id = $1", [migration.id]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${migration.id}`);
        continue;
      }
      await client.query(migration.sql);
      await client.query("INSERT INTO cms.migrations (id, checksum) VALUES ($1, $2)", [migration.id, checksum]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

/** Seeds one initial administrator key; never stores or logs the raw key. */
export async function seedInitialAdmin(databaseUrl: string, key: string): Promise<void> {
  if (!/^blx_adm_[A-Za-z0-9_-]{43}$/.test(key)) throw new Error("Invalid generated admin API key");
  const hash = createHash("sha256").update(key).digest("hex");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO auth.api_keys (id, name, key_hash) VALUES ($1, $2, $3)
       ON CONFLICT (key_hash) DO NOTHING`,
      [newId(), "Initial administrator", hash]
    );
  } finally {
    await client.end();
  }
}
