// Loads .env / .env.local for CLI scripts (Next.js loads them itself for the web app).
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
// Long-running scripts (pipeline, migrations, seed) use the session connection when one is
// configured; the web app keeps DATABASE_URL (Supabase transaction pooler).
if (process.env.WORKER_DATABASE_URL?.trim()) process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
