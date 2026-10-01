import { createCmsApplication } from "@blixis-io/cms-api";

const { app, config } = await createCmsApplication();
await app.listen(config.PORT);
console.log(`Blixis CMS API listening on http://localhost:${config.PORT}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void app.close(signal); });
}
