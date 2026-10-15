import "./env";
import { checkUrl } from "@/pipeline/validate";

/** Ad-hoc URL check using the pipeline's network stack. Usage: npx tsx scripts/check-url.ts <url>... */
for (const url of process.argv.slice(2)) {
  const r = await checkUrl(url);
  console.log(`${r.status.padEnd(8)} ${String(r.httpStatus ?? "").padEnd(4)} ${url} ${r.finalUrl && r.finalUrl !== url ? "→ " + r.finalUrl : ""} ${r.error ?? ""}`);
}
