import { defineConfigModule } from "@blixis-io/config";
import { z } from "zod";

export const CmsConfigSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgres"),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000)
});

export const { CONFIG, ConfigModule } = defineConfigModule(CmsConfigSchema);
