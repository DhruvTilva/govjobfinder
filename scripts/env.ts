// Loads .env / .env.local for CLI scripts (Next.js loads them itself for the web app).
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
