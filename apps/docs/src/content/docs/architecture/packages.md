---
title: Packages and applications
description: Where the CMS runtime and development apps live.
---

All custom publishable code lives in `packages/`:

- `cms-api` supplies the framework module, health and auth routes, migration, and seed functions.
- `create-cms` generates a project that depends on `cms-api` by npm version.

`apps/api` is the development composition root. `apps/admin` and `apps/playground` are reserved for later milestones; the playground will test a frontend against CMS content. `apps/docs` is this private Starlight app.

The API package uses Blixis Framework modules, dependency injection, HTTP guards, the Postgres/Drizzle module, logging, configuration, and `serveOpenApi`. `@Returns` validates and filters endpoint responses. The API uses TypeScript 7's legacy decorator metadata; Vitest sets the matching Oxc flags.

The checked first-run behavior is in `tooling/smoke/packed.mjs`; PostgreSQL integration tests are in `packages/cms-api/src/api.integration.test.ts`.
