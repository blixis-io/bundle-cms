---
title: Create an API
description: Generate and run the API-only project.
---

Requires Node 24, pnpm 11, and Docker. The generated Compose file uses PostgreSQL 18.

Once `@blixis-io/create-cms` and `@blixis-io/cms-api` have their first npm publications:

```sh
pnpm create @blixis-io/cms demo --api
cd demo
pnpm dev
```

The generator installs dependencies, starts Postgres on an available local port, runs its migration, and seeds an initial administrator API key. It prints that key once at the end. Keep the key in a password manager; the project stores no plaintext copy. `.env` is gitignored and holds the database password and JWT/session secrets.

Try the API after `pnpm dev` starts, using the port shown in `.env`:

```sh
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/openapi.json
curl -H 'Authorization: Bearer <printed-key>' http://127.0.0.1:3000/api/v1/auth/me
```

Replace `3000` with the generated `PORT`. The packed-tarball smoke test executes this first-run path with local tarballs before npm publication.
