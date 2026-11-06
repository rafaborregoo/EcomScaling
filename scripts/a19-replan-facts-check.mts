// Busca en el contexto real cada cifra que cita A19 en su razonamiento. Solo lee.
// npx dotenv -e .env.local -- npx tsx scripts/a19-replan-facts-check.mts
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const dir = resolve(".e-nora-test-lab/a19-replan-2026-11-05");
const report = JSON.parse(await readFile(resolve(dir, "report.json"), "utf8"));
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data } = await db.from("agent_context_snapshots").select("snapshot").eq("run_id", "7316abd6-2736-4a27-9384-7de268f62fb7").single();
const context = JSON.stringify(data!.snapshot);
const digits = (text: string) => text.replace(/[^\d]/g, "").replace(/0+$/, "");
const known = new Set([...context.matchAll(/\d[\d.,]*\d|\d/g)].map((match) => digits(match[0])));
const rows = [];
for (const row of report.results.filter((item: any) => item.status === "completed")) {
  const output = JSON.parse(row.raw_response);
  const prose = [output.diagnosis, output.goal?.rationale, ...(output.goal?.assumptions ?? []), ...output.warnings, ...output.phases.map((phase: any) => phase.rationale), ...output.phases.flatMap((phase: any) => phase.milestones.flatMap((milestone: any) => [milestone.change_reason, ...milestone.tasks.map((task: any) => task.change_reason)]))].filter(Boolean).join(" ");
  // Solo cifras con decimales o miles: las pequeñas (días, porcentajes redondos) coinciden por azar.
  const cited = [...new Set([...prose.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d{2}/g)].map((match) => match[0]))];
  const missing = cited.filter((value) => !known.has(digits(value)));
  rows.push({ model: row.model_id, cited: cited.length, not_in_context: missing });
}
await writeFile(resolve(dir, "facts.json"), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows));
