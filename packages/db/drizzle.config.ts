import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "../../supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_POSTGRES_URL ?? "postgres://localhost:54322/postgres",
  },
  strict: true,
  verbose: true,
});
