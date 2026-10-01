import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  test: {
    include: ["packages/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/cli.ts"],
      thresholds: { statements: 90, branches: 75, functions: 84, lines: 93 }
    }
  }
});
