import { defineAuthModule } from "@blixis-io/auth";
import { Injectable, Inject } from "@blixis-io/di";
import { RequestContext, UnauthorizedException, type CanActivate, type ExecutionContext } from "@blixis-io/http";
import { createHash } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { z } from "zod";
import { DATABASE, type CmsDatabase } from "./database.js";
import { apiKeys } from "./schema.js";

export const { AuthModule } = defineAuthModule(z.object({ sub: z.string() }));

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly db: CmsDatabase,
    private readonly context: RequestContext
  ) {}

  async canActivate({ request }: ExecutionContext): Promise<boolean> {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer blx_adm_")) throw new UnauthorizedException();
    const key = authorization.slice(7);
    if (!/^blx_adm_[A-Za-z0-9_-]{43}$/.test(key)) throw new UnauthorizedException();
    const hash = createHash("sha256").update(key).digest("hex");
    const [record] = await this.db.select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys).where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt))).limit(1);
    if (!record) throw new UnauthorizedException();
    this.context.set("cms.actor", { id: record.id, name: record.name });
    return true;
  }
}
