# @blixis-io/cms-api

The Node API package for the Blixis CMS bundle. The first release contains a Postgres-backed health endpoint, hashed administrator API-key authentication, migration and seed functions, and OpenAPI 3.1. Generated projects import only the package root.

The API key is shown by the scaffolder once. Only its SHA-256 hash is stored in Postgres. Generate keys with at least 32 random bytes.
