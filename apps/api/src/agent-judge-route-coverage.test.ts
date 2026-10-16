import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { AGENT_EVAL_AGENT_CODES } from "@e-nora/ai";

function identifierName(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
}

test("every active judge profile maps to a persisted generation route", () => {
  const runtimePath = new URL("./ai-runtime.ts", import.meta.url);
  const source = readFileSync(runtimePath, "utf8");
  const sourceFile = ts.createSourceFile(
    fileURLToPath(runtimePath),
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const integratedCodes = new Set<string>();
  let planHorizonCodes: string[] = [];
  let planRunnerUsesDynamicSpec = false;

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callName = identifierName(node.expression);
      if (callName === "runGenericDiagnosticAgent") {
        const agentCode = node.arguments[3];
        if (agentCode && ts.isStringLiteralLike(agentCode)) integratedCodes.add(agentCode.text);
      }
      if (callName === "judgePersistedAgentOutput") {
        const judgeInput = node.arguments[2];
        if (judgeInput && ts.isObjectLiteralExpression(judgeInput)) {
          for (const property of judgeInput.properties) {
            if (
              ts.isPropertyAssignment(property)
              && identifierName(property.name) === "agentCode"
              && ts.isStringLiteralLike(property.initializer)
            ) integratedCodes.add(property.initializer.text);
          }
        }
      }
    }

    if (ts.isVariableDeclaration(node) && identifierName(node.name) === "PLAN_HORIZONS") {
      let horizons = node.initializer;
      while (horizons && (ts.isAsExpression(horizons) || ts.isTypeAssertionExpression(horizons))) {
        horizons = horizons.expression;
      }
      if (horizons && ts.isObjectLiteralExpression(horizons)) {
        for (const horizon of horizons.properties) {
          if (!ts.isPropertyAssignment(horizon) || !ts.isObjectLiteralExpression(horizon.initializer)) continue;
          const agentCode = horizon.initializer.properties.find((property) =>
            ts.isPropertyAssignment(property) && identifierName(property.name) === "agentCode",
          );
          if (agentCode && ts.isPropertyAssignment(agentCode) && ts.isStringLiteralLike(agentCode.initializer)) {
            planHorizonCodes.push(agentCode.initializer.text);
          }
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name?.text === "runPlanAgent" && node.body) {
      const body = node.body.getText(sourceFile);
      planRunnerUsesDynamicSpec = body.includes("PLAN_HORIZONS[horizon]")
        && /runGenericDiagnosticAgent\([\s\S]*?spec\.agentCode/.test(body);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.ok(planRunnerUsesDynamicSpec, "A04/A17/A18 must pass their horizon registry code into the judged generic runner");
  for (const code of planHorizonCodes) integratedCodes.add(code);

  const catalog = new Set<string>(AGENT_EVAL_AGENT_CODES);
  const unregistered = [...integratedCodes].filter((code) => !catalog.has(code));
  const missing = [...catalog].filter((code) => !integratedCodes.has(code));
  assert.deepEqual(unregistered, [], "runtime judge call sites must not reference inactive agent profiles");
  assert.deepEqual(missing, [], "every active profile needs a generic or specialized persisted judge call path");
  assert.equal(planHorizonCodes.length, 3, "the day/week/month registry must keep all three task agents explicit");
});
