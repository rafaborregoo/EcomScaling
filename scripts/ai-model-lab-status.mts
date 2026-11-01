import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { requeueBlocked } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const path = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(path, "utf8")),
);
let reviews: Array<{ result_id: string }> = [];
try {
  reviews = JSON.parse(await readFile(resolve(dir, "reviews.json"), "utf8"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
if (process.argv.includes("--resume-blocked")) {
  if (report.results.some((r) => r.status === "running"))
    throw new Error("runner_still_active");
  const blocked = report.results.filter((r) => r.status === "blocked");
  if (blocked.length) {
    const archive = `report.before-resume.${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await writeFile(resolve(dir, archive), JSON.stringify(report, null, 2));
    report.results = requeueBlocked(report.results);
    report.updated_at = new Date().toISOString();
    report.issues.push({
      id: `resume:${Date.now()}`,
      severity: "low",
      title: "Reanudación de ejecuciones bloqueadas",
      detail: `${blocked.length} combinaciones pasan a pendientes. El intento anterior se conserva en ${archive}. No se repiten respuestas terminadas ni timeouts.`,
      status: "limited",
      agent_code: null,
      evidence: archive,
      resolution:
        "Solo ejecutar el runner tras comprobar que vuelve a haber cuota.",
    });
    await writeFile(path, JSON.stringify(report, null, 2));
  }
}
const stats = report.results.reduce<Record<string, number>>((out, r) => {
  out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}, {});
const agents = [...new Set(report.cases.map((c) => c.agent_code))];
const lines = [
  "<!-- LAB_STATUS_START -->",
  "## Estado calculado desde los artefactos",
  "",
  `Comprobación: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (Europe/Madrid).`,
  "",
  `${agents.length} agentes, ${report.cases.length} casos, ${report.results.length} combinaciones. Revisiones automáticas persistidas: ${reviews.length}.`,
  "",
  `Estados: ${Object.entries(stats)
    .map(([key, n]) => `${key}: ${n}`)
    .join("; ")}.`,
  "",
  "Todos los agentes participan con los seis modelos, con independencia del modelo asignado en producción.",
  "",
  "| Modelo | Respuestas | Fallos | En ejecución o pendientes | Bloqueadas |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...report.models.map((model) => {
    const rows = report.results.filter((r) => r.model_id === model.id);
    return `| ${model.label} | ${rows.filter((r) => r.status === "completed").length} / ${rows.length} | ${rows.filter((r) => r.status === "failed").length} | ${rows.filter((r) => ["pending", "running"].includes(r.status)).length} | ${rows.filter((r) => r.status === "blocked").length} |`;
  }),
  "",
  "| Agente | Respuestas / previstas | Bloqueadas | Fallidas | Revisadas |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...agents.map((agent) => {
    const cases = new Set(
      report.cases.filter((c) => c.agent_code === agent).map((c) => c.id),
    );
    const rows = report.results.filter((r) => cases.has(r.case_id));
    return `| ${agent} | ${rows.filter((r) => r.status === "completed").length} / ${rows.length} | ${rows.filter((r) => r.status === "blocked").length} | ${rows.filter((r) => r.status === "failed").length} | ${reviews.filter((v) => rows.some((r) => r.id === v.result_id)).length} |`;
  }),
  "",
  "<!-- LAB_STATUS_END -->",
].join("\n");
const mdPath = resolve("docs/SEGUIMIENTO_LABORATORIO_IA_2026-10-27.md");
const md = await readFile(mdPath, "utf8");
await writeFile(
  mdPath,
  md.includes("<!-- LAB_STATUS_START -->")
    ? md.replace(
        /<!-- LAB_STATUS_START -->[\s\S]*?<!-- LAB_STATUS_END -->/,
        lines,
      )
    : `${md}\n${lines}\n`,
);
console.log(
  JSON.stringify({
    cases: report.cases.length,
    total: report.results.length,
    states: stats,
    reviews: reviews.length,
  }),
);
