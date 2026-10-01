import { afterAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldApi } from "./scaffold.js";

const directories: string[] = [];
afterAll(async () => { for (const path of directories) await rm(path, { recursive: true, force: true }); });

describe("API scaffolding", () => {
  it("writes a standalone project with private generated secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "cms-scaffold-test-"));
    directories.push(root);
    const directory = join(root, "demo");
    const { adminKey } = await scaffoldApi({ directory, install: false });
    const env = await readFile(join(directory, ".env"), "utf8");
    const compose = await readFile(join(directory, "docker-compose.yml"), "utf8");
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const port = env.match(/^DB_PORT=(\d+)$/m)?.[1];
    expect(port).toBeTruthy();
    expect(compose).toContain('127.0.0.1:${DB_PORT}:5432');
    expect(env).toContain(`:${port}/cms`);
    expect((await stat(join(directory, ".env"))).mode & 0o777).toBe(0o600);
    expect(manifest.dependencies["@blixis-io/cms-api"]).toBe("^0.1.0");
    expect(await readFile(join(directory, ".gitignore"), "utf8")).toContain(".env");
    expect(adminKey).toMatch(/^blx_adm_[A-Za-z0-9_-]{43}$/);
    for (const file of await readdir(directory)) {
      if (file === "src") continue;
      expect(await readFile(join(directory, file), "utf8")).not.toContain(adminKey);
    }
  });

  it("refuses to overwrite an existing project", async () => {
    const root = await mkdtemp(join(tmpdir(), "cms-scaffold-test-"));
    directories.push(root);
    await writeFile(join(root, "keep.txt"), "keep");
    await expect(scaffoldApi({ directory: root, install: false })).rejects.toThrow("not empty");
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("keep");
  });

  it("passes the one-time key only to the seed process", async () => {
    const root = await mkdtemp(join(tmpdir(), "cms-scaffold-test-"));
    directories.push(root);
    const directory = join(root, "demo");
    const calls: { command: string; args: string[]; key?: string }[] = [];
    const result = await scaffoldApi({
      directory,
      cmsApiSpec: "file:/tmp/cms-api-test.tgz",
      run: async (command, args, cwd, env) => {
        expect(cwd).toBe(directory);
        calls.push({ command, args, key: env?.CMS_ADMIN_API_KEY });
      }
    });
    expect(calls.map(({ command, args }) => `${command} ${args.join(" ")}`)).toEqual([
      "pnpm install", "docker compose up -d --wait", "pnpm run build", "pnpm run prepare:cms"
    ]);
    expect(calls.slice(0, 3).every((call) => !call.key)).toBe(true);
    expect(calls[3]?.key).toBe(result.adminKey);
    expect(await readFile(join(directory, ".env"), "utf8")).not.toContain(result.adminKey);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies["@blixis-io/cms-api"]).toBe("file:/tmp/cms-api-test.tgz");
  });
});
