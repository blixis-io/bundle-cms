import { Inject } from "@blixis-io/di";
import { ApiTags, Controller, Get, RequestContext, Returns, UseGuards } from "@blixis-io/http";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { AdminApiKeyGuard } from "./auth.js";
import { DATABASE, type CmsDatabase } from "./database.js";

@ApiTags("system")
@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: CmsDatabase) {}

  @Get()
  @Returns(z.object({ status: z.literal("ok"), database: z.literal("ok") }))
  async health() {
    await this.db.execute(sql`SELECT 1`);
    return { status: "ok", database: "ok" };
  }
}

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly context: RequestContext) {}

  @Get("me")
  @UseGuards(AdminApiKeyGuard)
  @Returns(z.object({ id: z.uuid(), name: z.string(), kind: z.literal("apiKey") }))
  me() {
    const actor = this.context.get<{ id: string; name: string }>("cms.actor");
    return { ...actor, kind: "apiKey" as const };
  }
}
