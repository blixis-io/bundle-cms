import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const temporary = await mkdtemp(join(tmpdir(), "blixis-cms-packed-"));
const runner = join(temporary, "runner");
const project = join(temporary, "demo");
const composeProject = `cms-smoke-${randomBytes(5).toString("hex")}`;
const childEnv = { ...process.env, COMPOSE_PROJECT_NAME: composeProject };
let server;
let dockerStarted = false;

function command(program, args, cwd, env = childEnv) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(program, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolveCommand({ stdout, stderr })
      : reject(new Error(`${program} ${args.join(" ")} failed with exit ${code}: ${stderr.slice(-1000)}`)));
  });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Generated API exited with ${server.exitCode ?? server.signalCode}`);
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch { /* Wait until the server listens. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("Generated API did not become healthy");
}

try {
  await command("pnpm", ["run", "build"], root);
  await command("pnpm", ["pack", "--pack-destination", temporary], join(root, "packages/cms-api"));
  await command("pnpm", ["pack", "--pack-destination", temporary], join(root, "packages/create-cms"));
  const archives = await readdir(temporary);
  const apiArchive = join(temporary, archives.find((file) => file.includes("cms-api") && file.endsWith(".tgz")) ?? "missing-api.tgz");
  const scaffoldArchive = join(temporary, archives.find((file) => file.includes("create-cms") && file.endsWith(".tgz")) ?? "missing-scaffold.tgz");
  await command("mkdir", ["-p", runner], temporary);
  await writeFile(join(runner, "package.json"), '{"name":"cms-packed-runner","version":"1.0.0","private":true,"type":"module"}\n');
  await command("pnpm", ["add", "-D", `file:${scaffoldArchive}`], runner);
  dockerStarted = true;
  const created = await command("pnpm", ["exec", "create-cms", project, "--api"], runner, {
    ...childEnv, BLIXIS_CMS_API_SPEC: `file:${apiArchive}`
  });
  const key = created.stdout.match(/Initial admin API key \(shown once\): (blx_adm_[A-Za-z0-9_-]{43})/)?.[1];
  if (!key) throw new Error("Scaffolder did not print exactly one admin API key");
  if (created.stdout.match(/Initial admin API key/g)?.length !== 1) throw new Error("Scaffolder printed the key more than once");
  const envFile = await readFile(join(project, ".env"), "utf8");
  if (envFile.includes(key)) throw new Error("Admin API key was written to .env");
  const port = envFile.match(/^PORT=(\d+)$/m)?.[1];
  if (!port) throw new Error("Generated project has no API port");
  const base = `http://127.0.0.1:${port}`;
  server = spawn("pnpm", ["dev"], { cwd: project, env: childEnv, stdio: "ignore", detached: true });
  await waitForHealth(base);
  const unauthenticated = await fetch(`${base}/api/v1/auth/me`);
  if (unauthenticated.status !== 401) throw new Error(`Unauthenticated request returned ${unauthenticated.status}`);
  const authenticated = await fetch(`${base}/api/v1/auth/me`, { headers: { authorization: `Bearer ${key}` } });
  if (authenticated.status !== 200) throw new Error(`Admin key request returned ${authenticated.status}`);
  const actor = await authenticated.json();
  if (actor.kind !== "apiKey" || JSON.stringify(actor).includes(key)) throw new Error("Auth response is invalid or leaked the key");
  const openapi = await fetch(`${base}/openapi.json`);
  const document = await openapi.json();
  if (document.openapi !== "3.1.0" || !document.paths["/api/v1/auth/me"]) throw new Error("OpenAPI route is invalid");
  console.log("Packed scaffolder smoke passed: install, migration, seed, boot, health, auth, OpenAPI");
} finally {
  if (server) {
    const exited = new Promise((resolveWait) => {
      if (server.exitCode !== null || server.signalCode !== null) resolveWait();
      else server.once("exit", resolveWait);
    });
    if (server.exitCode === null && server.signalCode === null) {
      try {
        if (server.pid) process.kill(-server.pid, "SIGTERM");
        else server.kill("SIGTERM");
      } catch { /* Process already exited. */ }
    }
    await exited;
  }
  if (dockerStarted) await command("docker", ["compose", "down", "-v"], project).catch(() => undefined);
  await rm(temporary, { recursive: true, force: true });
}
