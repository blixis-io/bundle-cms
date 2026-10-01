import { migrateCms, seedInitialAdmin } from "@blixis-io/cms-api";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
await migrateCms(databaseUrl);
const adminKey = process.env.CMS_ADMIN_API_KEY;
if (adminKey) await seedInitialAdmin(databaseUrl, adminKey);
