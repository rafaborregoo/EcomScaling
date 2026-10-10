import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const catalog = read("packages/ai/src/agent-eval-catalog.ts");
const judge = read("packages/ai/src/agent-judge.ts");
const coverage = read("docs/COBERTURA_JUEZ_26_AGENTES.md");
const audit = read("docs/AUDITORIA_JUEZ_AGENTES.md");
const plan = read("docs/PLAN_JUEZ_AGENTES.md");

const activeCodes = [...catalog.matchAll(/^\s+"(a\d{2}_[a-z0-9_]+)",?\s*$/gm)]
  .map((match) => match[1]);
const uniqueCodes = [...new Set(activeCodes)];
const rubricSection = judge.match(/const DOMAIN:[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
if (!rubricSection) throw new Error("agent_judge_domain_rubrics_not_found");
const rubricCodes = [...rubricSection[1].matchAll(/^\s+(a\d{2}_[a-z0-9_]+):\s*\[/gm)]
  .map((match) => match[1]);

const missingRubrics = uniqueCodes.filter((code) => !rubricCodes.includes(code));
const extraRubrics = rubricCodes.filter((code) => !uniqueCodes.includes(code));
const missingCoverageRows = uniqueCodes.filter((code) => !coverage.includes(`\`${code}\``));
const missingAuditRows = uniqueCodes.filter((code) => {
  const number = code.match(/^a(\d{2})_/)[1];
  return !new RegExp(`^## A${number}\\b`, "m").test(audit);
});
const missingPlanAgents = uniqueCodes.filter((code) => {
  const number = code.match(/^a(\d{2})_/)[1];
  return !new RegExp(`\\bA${number}\\b`).test(plan);
});

if (uniqueCodes.length !== 26) throw new Error(`active_agent_count_expected_26_got_${uniqueCodes.length}`);
if (missingRubrics.length || extraRubrics.length) {
  throw new Error(`rubric_catalog_mismatch:missing=${missingRubrics.join(",")};extra=${extraRubrics.join(",")}`);
}
if (missingCoverageRows.length) throw new Error(`coverage_doc_missing:${missingCoverageRows.join(",")}`);
if (missingAuditRows.length) throw new Error(`agent_audit_missing:${missingAuditRows.join(",")}`);
if (missingPlanAgents.length) throw new Error(`implementation_plan_missing_agents:${missingPlanAgents.join(",")}`);
if ((audit.match(/^## A19\b/gm) ?? []).length < 2) throw new Error("a19_architect_and_review_audits_required");

console.log(`AGENT_JUDGE_COVERAGE_OK: ${uniqueCodes.length} active codes have domain rubrics, matrix entries and audit sections; A19 architect/review are both present.`);
