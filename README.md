# Blixis CMS bundle

An API-first CMS built as publishable packages on Blixis Framework. The workspace has an API development app, and will add an admin app and a frontend playground as the later milestones land. All custom packages live in `packages/`.

## Development

Requires Node 24, pnpm 11, Docker, and PostgreSQL 18.

```sh
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
pnpm run build
pnpm --filter @blixis-io/cms-dev-api prepare:cms
pnpm --filter @blixis-io/cms-dev-api dev
```

For authenticated development requests, set a generated `CMS_ADMIN_API_KEY` only while running `prepare:cms`; save it yourself. The scaffolded project generates and prints one automatically.

Milestone 1 is the API-only walking skeleton. `packages/create-cms` writes a standalone project with npm package dependencies; its packed-tarball test substitutes a local `cms-api` tarball until first publication. Nothing in this repository publishes packages automatically.
