import "./env";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { adminUsers } from "@/db/schema";

/**
 * Creates or resets an admin account.
 *   npm run admin:create -- --email you@example.com --name "Your Name" [--role admin|editor]
 * The password is read from ADMIN_PASSWORD or prompted for (never passed as an argument).
 */
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const email = arg("email")?.trim().toLowerCase();
const name = arg("name") ?? email?.split("@")[0];
const role = (arg("role") ?? "admin") as "admin" | "editor";
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !["admin", "editor"].includes(role)) {
  console.error('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--role admin|editor]');
  process.exit(1);
}
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Password (min 12 characters): ");
  rl.close();
}
if (!password || password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

await runMigrations();
const db = await getDb();
const passwordHash = await bcrypt.hash(password, 12);
const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email));
if (existing) {
  await db.update(adminUsers).set({ passwordHash, role, name: name!, active: true }).where(eq(adminUsers.id, existing.id));
  console.log(`Updated ${role} account ${email}.`);
} else {
  await db.insert(adminUsers).values({ email, name: name!, passwordHash, role });
  console.log(`Created ${role} account ${email}.`);
}
await closeDb();
