import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomBytes, createHash } from "node:crypto";
import { createCmsApplication, migrateCms, seedInitialAdmin } from "./index.js";

const rootUrl = process.env.CMS_TEST_DATABASE_URL;
if (process.env.CI && !rootUrl) throw new Error("CMS_TEST_DATABASE_URL is required in CI");

describe.skipIf(!rootUrl)("CMS API against PostgreSQL 18", () => {
  const databaseName = `cms_test_${randomBytes(6).toString("hex")}`;
  const databaseUrl = new URL(rootUrl ?? "postgresql://unused");
  databaseUrl.pathname = `/${databaseName}`;
  const key = `blx_adm_${randomBytes(32).toString("base64url")}`;
  const config = {
    DATABASE_URL: databaseUrl.toString(),
    JWT_SECRET: randomBytes(48).toString("base64url"),
    SESSION_SECRET: randomBytes(48).toString("base64url"),
    PORT: "0"
  };
  let root: Client;
  let app: Awaited<ReturnType<typeof createCmsApplication>>["app"];

  beforeAll(async () => {
    root = new Client({ connectionString: rootUrl });
    await root.connect();
    const version = await root.query<{ server_version_num: string }>("SHOW server_version_num");
    const serverVersion = Number(version.rows[0]?.server_version_num);
    if (serverVersion < 180000 || serverVersion >= 190000) throw new Error("PostgreSQL 18 is required for this integration test");
    await root.query(`CREATE DATABASE ${databaseName}`);
    await migrateCms(databaseUrl.toString());
    await migrateCms(databaseUrl.toString());
    await seedInitialAdmin(databaseUrl.toString(), key);
    await seedInitialAdmin(databaseUrl.toString(), key);
    app = (await createCmsApplication(config)).app;
  });

  afterAll(async () => {
    await app?.close();
    if (root) {
      await root.query(`DROP DATABASE IF EXISTS ${databaseName}`);
      await root.end();
    }
  });

  it("stores only a hash and authenticates the initial key", async () => {
    const db = new Client({ connectionString: databaseUrl.toString() });
    await db.connect();
    const records = await db.query<{ key_hash: string }>("SELECT key_hash FROM auth.api_keys");
    await db.end();
    expect(records.rows).toHaveLength(1);
    expect(records.rows[0]?.key_hash).toBe(createHash("sha256").update(key).digest("hex"));
    expect(JSON.stringify(records.rows)).not.toContain(key);

    const unauthorized = await app.handle(new Request("http://localhost/api/v1/auth/me"));
    expect(unauthorized.status).toBe(401);
    const invalid = await app.handle(new Request("http://localhost/api/v1/auth/me", {
      headers: { authorization: `Bearer blx_adm_${randomBytes(32).toString("base64url")}` }
    }));
    expect(invalid.status).toBe(401);
    const malformed = await app.handle(new Request("http://localhost/api/v1/auth/me", {
      headers: { authorization: "Bearer blx_adm_short" }
    }));
    expect(malformed.status).toBe(401);
    const valid = await app.handle(new Request("http://localhost/api/v1/auth/me", {
      headers: { authorization: `Bearer ${key}` }
    }));
    expect(valid.status).toBe(200);
    const body = await valid.json();
    expect(body).toMatchObject({ name: "Initial administrator", kind: "apiKey" });
    expect(JSON.stringify(body)).not.toContain(key);
    expect(JSON.stringify(body)).not.toContain("keyHash");
  });

  it("serves database health and generated OpenAPI", async () => {
    const health = await app.handle(new Request("http://localhost/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", database: "ok" });
    const openapi = await app.handle(new Request("http://localhost/openapi.json"));
    expect(openapi.status).toBe(200);
    const document = await openapi.json() as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths).toHaveProperty("/api/v1/auth/me");
    expect(document.paths).toHaveProperty("/health");
  });

  it("rejects a modified applied migration", async () => {
    const db = new Client({ connectionString: databaseUrl.toString() });
    await db.connect();
    const original = await db.query<{ checksum: string }>("SELECT checksum FROM cms.migrations WHERE id = '0001_api_keys'");
    try {
      await db.query("UPDATE cms.migrations SET checksum = 'tampered' WHERE id = '0001_api_keys'");
      await expect(migrateCms(databaseUrl.toString())).rejects.toThrow("Migration checksum mismatch");
    } finally {
      await db.query("UPDATE cms.migrations SET checksum = $1 WHERE id = '0001_api_keys'", [original.rows[0]?.checksum]);
      await db.end();
    }
  });
});
