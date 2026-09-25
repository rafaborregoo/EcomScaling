import { readFile } from "node:fs/promises";
import process from "node:process";

const workflowDirectory = ".github/workflows";
const workflows = [
  {
    file: "conversion-cro-benchmarks-p05.yml",
    test: "test:conversion-cro-benchmarks",
    start: "start:conversion-cro-benchmarks",
  },
  {
    file: "offer-pricing-benchmarks-p06.yml",
    test: "test:offer-pricing-benchmarks",
    start: "start:offer-pricing-benchmarks",
  },
  {
    file: "retention-crm-benchmarks-p07.yml",
    test: "test:retention-crm-benchmarks",
    start: "start:retention-crm-benchmarks",
  },
  {
    file: "unit-economics-benchmarks-p08.yml",
    test: "test:unit-economics-benchmarks",
    start: "start:unit-economics-benchmarks",
  },
  {
    file: "operations-cx-benchmarks-p09.yml",
    test: "test:operations-cx-benchmarks",
    start: "start:operations-cx-benchmarks",
  },
  {
    file: "product-inventory-benchmarks-p10.yml",
    start: "start:product-inventory-benchmarks",
  },
  {
    file: "scalability-benchmarks-p11.yml",
    start: "start:scalability-benchmarks",
  },
  { file: "anomalies-red-flags-p12.yml", start: "start:anomalies-red-flags" },
  { file: "benchmark-confidence-p13.yml", start: "start:benchmark-confidence" },
];

const contractBuild = "npm run build --workspace=@e-nora/contracts";
const apiBuild = "npm run build --workspace=@e-nora/api";
const workerBuild = "npm run build --workspace=@e-nora/worker";
const violations = [];

for (const workflow of workflows) {
  const path = `${workflowDirectory}/${workflow.file}`;
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    violations.push(`${path}: workflow not found`);
    continue;
  }

  const indexOf = (value) => source.indexOf(value);
  const node24 = indexOf("node-version: 24");
  const contracts = indexOf(contractBuild);
  const api = indexOf(apiBuild);
  const worker = indexOf(workerBuild);
  const start = indexOf(workflow.start);

  if (node24 === -1) violations.push(`${path}: must use Node.js 24`);
  if (contracts === -1) violations.push(`${path}: must build contracts`);
  if (api === -1) violations.push(`${path}: must build API`);
  if (worker === -1) violations.push(`${path}: must build worker`);
  if (start === -1) violations.push(`${path}: missing worker start command`);
  if (api !== -1 && worker !== -1 && api > worker) {
    violations.push(`${path}: API must build before worker`);
  }
  if (worker !== -1 && start !== -1 && worker > start) {
    violations.push(`${path}: worker must build before its start command`);
  }

  if (workflow.test) {
    const test = indexOf(workflow.test);
    if (test === -1) violations.push(`${path}: missing benchmark test command`);
    if (contracts !== -1 && test !== -1 && contracts > test) {
      violations.push(
        `${path}: contracts must build before its benchmark test`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("BENCHMARK_WORKFLOW_BUILD_ORDER_VIOLATION");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `BENCHMARK_WORKFLOW_BUILD_ORDER_OK: ${workflows.length} workflows compile contracts and worker artifacts before use`,
);
