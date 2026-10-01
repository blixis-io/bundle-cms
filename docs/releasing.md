# Releasing

Publishing is deliberately manual. Merging a PR does not publish. The `release.yml` workflow offers a manual dispatch for one package at a time and runs `npm publish` with GitHub OIDC (`id-token: write`); it has no npm token secret.

New package names needing an initial npm placeholder and trusted-publisher configuration:

1. `@blixis-io/cms-api`
2. `@blixis-io/create-cms`

Configure each package on npmjs.com for `blixis-io/bundle-cms`, workflow filename `release.yml`, with `npm publish` allowed, following [npm's trusted publishing instructions](https://docs.npmjs.com/trusted-publishers/). Publish `cms-api` before `create-cms`; the generated project depends on `cms-api`. Changesets will bump the initial workspace `0.0.0` versions to `0.1.0` when the release PR is prepared.

The packed smoke test substitutes a `file:` tarball solely inside its temporary project. Normal generated projects use the npm version range `^0.1.0`.
