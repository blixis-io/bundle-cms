import type { UserConfig } from "rolldown";

export function libraryConfig(entry: string): UserConfig {
  return {
    input: entry,
    platform: "node",
    external: [/^@blixis-io\//, /^drizzle-orm(?:\/|$)/, /^pg$/, /^zod$/],
    output: { dir: "dist", format: "esm", sourcemap: true }
  };
}
