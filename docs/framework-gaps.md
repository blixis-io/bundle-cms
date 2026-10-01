# Framework gaps

Record missing framework behavior here when implementation reaches it. The local framework documentation for dynamic modules is stale: its Modules page says repeated `forRoot()` registrations collapse by class, while current `packages/core/src/application.ts` and its tests register distinct dynamic module objects with distinct tokens. The CMS relies on the implementation and will keep a regression test for any repeated registration it uses.

`@blixis-io/events` and `@blixis-io/testing` were not published when the bundle brief was written. CMS domain events will sit behind a local interface until the package is available; integration tests use Vitest directly.
