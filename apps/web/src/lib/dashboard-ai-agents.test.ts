import assert from "node:assert/strict";
import test from "node:test";
import {
  DECISION_AI_AGENTS,
  KLAVIYO_DASHBOARD_AI_AGENT,
  KNOWLEDGE_AI_AGENT,
  META_DASHBOARD_AI_AGENT,
  SHOPIFY_DASHBOARD_AI_AGENTS,
  STOCK_PLANNER_AI_AGENT,
} from "./dashboard-ai-agents";

test("el resumen general conserva solo los cuatro horizontes de decisión", () => {
  assert.deepEqual(
    DECISION_AI_AGENTS.map((agent) => agent.key),
    ["monitor", "task-planner", "plan-week", "plan-month"],
  );
});

test("los especialistas quedan asignados a su dashboard", () => {
  assert.deepEqual(
    SHOPIFY_DASHBOARD_AI_AGENTS.map((agent) => agent.key),
    ["operativa-shopify", "stock-planner"],
  );
  assert.equal(META_DASHBOARD_AI_AGENT.key, "operativa-meta");
  assert.equal(KLAVIYO_DASHBOARD_AI_AGENT.key, "email-analyst");
  assert.equal(KNOWLEDGE_AI_AGENT.key, "knowledge-manager");
  assert.equal(STOCK_PLANNER_AI_AGENT.getPath, "/ai/stock-planner");
  assert.equal(STOCK_PLANNER_AI_AGENT.consultantOnly, false);
});
