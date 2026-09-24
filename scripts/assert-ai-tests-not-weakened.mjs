// AI-30 fase 8: ningun cambio puede debilitar en silencio los tests de la capa
// de IA ni el dataset de evaluacion reservado (docs/ai/AI_SECURITY.md: ningun
// agente elimina asserts, marca tests como skip ni cambia valores esperados).
//
// Compara contra HEAD el numero de asserts de packages/ai/src/*.test.ts y el de
// casos del dataset. Si baja, falla. Una reduccion deliberada se aprueba de
// forma explicita: AI_TESTS_REDUCTION_APPROVED=1 npm run verify.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aiSrc = "packages/ai/src";
const dataset = `${aiSrc}/agent-eval-dataset.ts`;

const headVersion = (file) => {
  try {
    return execFileSync("git", ["show", `HEAD:${file}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null; // fichero nuevo: no hay nada que debilitar
  }
};
const count = (text, pattern) => (text ? (text.match(pattern) ?? []).length : 0);

const ASSERT = /\bassert(\.\w+)?\(/g;
const SKIP = /\b(it|test|describe)\.(skip|todo)\(|\{\s*skip:\s*true/g;
// Un caso por agente de la lista AGENTS (buildFixture genera el resto).
const CASE = /"a\d{2}_[a-z_]+"/g;

const problems = [];
const tests = readdirSync(path.join(root, aiSrc)).filter((file) => file.endsWith(".test.ts"));
for (const name of tests) {
  const file = `${aiSrc}/${name}`;
  const now = readFileSync(path.join(root, file), "utf8");
  const before = headVersion(file);
  if (before === null) continue;
  if (count(now, ASSERT) < count(before, ASSERT)) {
    problems.push(`${file}: asserts ${count(before, ASSERT)} -> ${count(now, ASSERT)}`);
  }
  if (count(now, SKIP) > count(before, SKIP)) {
    problems.push(`${file}: tests saltados ${count(before, SKIP)} -> ${count(now, SKIP)}`);
  }
}
for (const file of headTestFiles()) {
  if (!tests.includes(path.basename(file))) problems.push(`${file}: fichero de test eliminado`);
}

const datasetBefore = headVersion(dataset);
const datasetNow = readFileSync(path.join(root, dataset), "utf8");
if (datasetBefore !== null && count(datasetNow, CASE) < count(datasetBefore, CASE)) {
  problems.push(`${dataset}: casos ${count(datasetBefore, CASE)} -> ${count(datasetNow, CASE)}`);
}

function headTestFiles() {
  try {
    return execFileSync("git", ["ls-tree", "--name-only", "HEAD", `${aiSrc}/`], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((file) => file.endsWith(".test.ts"));
  } catch {
    return [];
  }
}

if (problems.length > 0 && process.env.AI_TESTS_REDUCTION_APPROVED !== "1") {
  console.error("La capa de IA pierde cobertura respecto a HEAD:\n- " + problems.join("\n- "));
  console.error("Si es deliberado y revisado por una persona: AI_TESTS_REDUCTION_APPROVED=1");
  process.exit(1);
}
console.log(`AI tests not weakened: ${tests.length} ficheros de test + dataset de evals comparados con HEAD`);
