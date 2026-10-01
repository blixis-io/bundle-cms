#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { scaffoldApi } from "./scaffold.js";

async function main() {
  const args = process.argv.slice(2);
  const modes = args.filter((arg) => ["--api", "--dashboard", "--both"].includes(arg));
  if (modes.length > 1) throw new Error("Choose only one of --api, --dashboard, or --both");
  let mode = modes[0];
  let directory = args.find((arg) => !arg.startsWith("-"));
  if (!directory) {
    if (!stdin.isTTY) throw new Error("Project directory is required in non-interactive mode");
    const prompt = createInterface({ input: stdin, output: stdout });
    try { directory = await prompt.question("Project directory: "); }
    finally { prompt.close(); }
  }
  if (!mode) {
    if (!stdin.isTTY) throw new Error("Pass --api, --dashboard, or --both in non-interactive mode");
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await prompt.question("Generate 1) API  2) Dashboard  3) Both [1]: ");
      mode = ({ "": "--api", "1": "--api", "2": "--dashboard", "3": "--both" } as Record<string, string>)[answer];
    } finally { prompt.close(); }
  }
  if (!mode) throw new Error("Invalid selection");
  if (mode !== "--api") throw new Error(`${mode} will be available in the dashboard milestone`);
  const result = await scaffoldApi({ directory, cmsApiSpec: process.env.BLIXIS_CMS_API_SPEC });
  stdout.write(`\nReady: ${result.directory}\nRun: cd ${result.directory} && pnpm dev\nInitial admin API key (shown once): ${result.adminKey}\n`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
