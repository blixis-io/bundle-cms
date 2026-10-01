import { randomBytes } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

export interface ScaffoldOptions {
  directory: string;
  cmsApiSpec?: string;
  install?: boolean;
  run?: (command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) => Promise<void>;
}

export interface ScaffoldResult { directory: string; adminKey: string }

function secret(bytes = 32): string { return randomBytes(bytes).toString("base64url"); }

export async function runCommand(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`)));
  });
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) { reject(new Error("No TCP port was allocated")); return; }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
  });
}

function projectFiles(name: string, password: string, jwtSecret: string, sessionSecret: string, cmsApiSpec: string, dbPort: number, apiPort: number, composeName: string) {
  const databaseUrl = `postgresql://cms:${encodeURIComponent(password)}@127.0.0.1:${dbPort}/cms`;
  return {
    ".gitignore": "node_modules/\ndist/\n.env\n",
    ".env.example": "DATABASE_URL=postgresql://cms:change-me@127.0.0.1:5432/cms\nDB_PASSWORD=change-me\nDB_PORT=5432\nCOMPOSE_PROJECT_NAME=cms-demo\nJWT_SECRET=change-me-at-least-32-characters-long\nSESSION_SECRET=change-me-at-least-32-characters-long\nPORT=3000\n",
    ".env": `DATABASE_URL=${databaseUrl}\nDB_PASSWORD=${password}\nDB_PORT=${dbPort}\nCOMPOSE_PROJECT_NAME=${composeName}\nJWT_SECRET=${jwtSecret}\nSESSION_SECRET=${sessionSecret}\nPORT=${apiPort}\n`,
    ".nvmrc": "24\n",
    "docker-compose.yml": `services:\n  postgres:\n    image: postgres:18-alpine\n    environment:\n      POSTGRES_USER: cms\n      POSTGRES_PASSWORD: \${DB_PASSWORD}\n      POSTGRES_DB: cms\n    ports:\n      - "127.0.0.1:\${DB_PORT}:5432"\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U cms -d cms"]\n      interval: 2s\n      timeout: 2s\n      retries: 30\n    volumes:\n      - postgres_data:/var/lib/postgresql\nvolumes:\n  postgres_data:\n`,
    "package.json": JSON.stringify({
      name, version: "0.1.0", private: true, type: "module", engines: { node: ">=24" },
      packageManager: "pnpm@11.25.0",
      scripts: {
        build: "tsc -p tsconfig.json",
        start: "node --env-file=.env dist/main.js",
        dev: "pnpm run build && concurrently -k \"tsc -w -p tsconfig.json\" \"node --watch --env-file=.env dist/main.js\"",
        "prepare:cms": "node --env-file=.env dist/prepare.js"
      },
      dependencies: { "@blixis-io/cms-api": cmsApiSpec },
      devDependencies: { "@types/node": "^24.0.0", concurrently: "^9.2.1", typescript: "^7.0.2" }
    }, null, 2) + "\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "es2023", lib: ["es2023"], types: ["node"], module: "nodenext", moduleResolution: "nodenext",
        strict: true, experimentalDecorators: true, emitDecoratorMetadata: true,
        useDefineForClassFields: false, skipLibCheck: true, outDir: "dist", rootDir: "src"
      }, include: ["src"]
    }, null, 2) + "\n",
    "src/main.ts": `import { createCmsApplication } from "@blixis-io/cms-api";\n\nconst { app, config } = await createCmsApplication();\nawait app.listen(config.PORT);\nconsole.log(\`Blixis CMS API listening on http://localhost:\${config.PORT}\`);\n\nfor (const signal of ["SIGINT", "SIGTERM"] as const) {\n  process.once(signal, () => { void app.close(signal); });\n}\n`,
    "src/prepare.ts": `import { migrateCms, seedInitialAdmin } from "@blixis-io/cms-api";\n\nconst databaseUrl = process.env.DATABASE_URL;\nif (!databaseUrl) throw new Error("DATABASE_URL is required");\nawait migrateCms(databaseUrl);\nconst adminKey = process.env.CMS_ADMIN_API_KEY;\nif (adminKey) await seedInitialAdmin(databaseUrl, adminKey);\n`,
    "README.md": `# ${name}\n\nRun \`pnpm dev\` for the API. \`GET /health\` checks Postgres, \`GET /openapi.json\` serves OpenAPI, and \`GET /api/v1/auth/me\` accepts the initial API key as a Bearer token.\n\n\`pnpm run prepare:cms\` reapplies checksum-checked migrations. The initial API key was printed once by the scaffolder and is not stored here.\n`
  } as const;
}

export async function scaffoldApi(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const directory = resolve(options.directory);
  const name = basename(directory).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  const existing = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (existing.length) throw new Error(`Target directory is not empty: ${directory}`);
  const password = secret(32);
  const adminKey = `blx_adm_${secret(32)}`;
  const dbPort = await availablePort();
  let apiPort = await availablePort();
  while (apiPort === dbPort) apiPort = await availablePort();
  const files = projectFiles(name, password, secret(48), secret(48), options.cmsApiSpec ?? "^0.1.0", dbPort, apiPort, `cms_${randomBytes(6).toString("hex")}`);
  await mkdir(directory, { recursive: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(directory, relativePath);
    if (relativePath.includes("/")) await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(path, contents, { mode: relativePath === ".env" ? 0o600 : 0o644 });
  }
  if (options.install !== false) {
    const run = options.run ?? runCommand;
    await run("pnpm", ["install"], directory);
    await run("docker", ["compose", "up", "-d", "--wait"], directory);
    await run("pnpm", ["run", "build"], directory);
    await run("pnpm", ["run", "prepare:cms"], directory, { ...process.env, CMS_ADMIN_API_KEY: adminKey });
  }
  return { directory, adminKey };
}
