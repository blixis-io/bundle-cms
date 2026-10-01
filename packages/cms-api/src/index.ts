import { Module } from "@blixis-io/core";
import { createHttpApplication } from "@blixis-io/http";
import { consoleTransport, LoggerModule } from "@blixis-io/logging";
import { serveOpenApi } from "@blixis-io/openapi";
import { AuthModule, AdminApiKeyGuard } from "./auth.js";
import { CmsConfigSchema, CONFIG, ConfigModule } from "./config.js";
import { AuthController, HealthController } from "./controllers.js";
import { DrizzleModule } from "./database.js";

@Module({ controllers: [HealthController, AuthController], providers: [AdminApiKeyGuard] })
export class CmsApiModule {}

export async function createCmsApplication(source: Record<string, string | undefined> = process.env) {
  const config = CmsConfigSchema.parse(source);
  const root = {
    module: CmsApiModule,
    imports: [
      ConfigModule.forRoot(source),
      LoggerModule.forRoot({ transports: [consoleTransport()] }),
      DrizzleModule.forRoot({ connection: config.DATABASE_URL, global: true }),
      AuthModule.forRoot({ secret: config.JWT_SECRET })
    ]
  };
  const app = await createHttpApplication(root, { requestTimeout: 15_000, bodyLimit: 1024 * 1024, shutdownTimeout: 10_000 });
  serveOpenApi(app, "/openapi.json", { title: "Blixis CMS API", version: "0.1.0" });
  return { app, config: app.get(CONFIG) };
}

export { migrateCms, seedInitialAdmin } from "./migrations.js";
