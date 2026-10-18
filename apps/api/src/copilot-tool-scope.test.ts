import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentTools } from "./ai-runtime.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const selectedStore = "00000000-0000-4000-8000-000000000002";
const otherStore = "00000000-0000-4000-8000-000000000003";
const runId = "00000000-0000-4000-8000-000000000004";
const callId = "00000000-0000-4000-8000-000000000005";

function fakeClient() {
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const rows: Record<string, Array<Record<string, unknown>>> = {
    tasks: [
      { id: "selected-visible", organization_id: organizationId, store_id: selectedStore, status: "pending", is_visible_to_client: true },
      { id: "selected-private", organization_id: organizationId, store_id: selectedStore, status: "pending", is_visible_to_client: false },
      { id: "other-visible", organization_id: organizationId, store_id: otherStore, status: "pending", is_visible_to_client: true },
    ],
    consulting_calls: [
      { id: callId, organization_id: organizationId, is_visible_to_client: true },
      { id: "private-call", organization_id: organizationId, is_visible_to_client: false },
    ],
    call_ai_summaries: [
      { id: "public-summary", organization_id: organizationId, call_id: callId, status: "published", summary: "Acuerdos", key_points: { facts: ["Hecho"], consultant_gaps: ["Interno"] } },
      { id: "draft-summary", organization_id: organizationId, call_id: callId, status: "pending_approval", summary: "Borrador privado", key_points: { facts: ["Privado"] } },
    ],
  };
  const client = {
    from(table: string) {
      const predicates: Array<(row: Record<string, unknown>) => boolean> = [];
      let start = 0;
      let end = Number.POSITIVE_INFINITY;
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) {
          filters.push({ table, column, value });
          predicates.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          predicates.push((row) => values.includes(row[column]));
          return query;
        },
        order() { return query; },
        limit(value: number) { end = value - 1; return query; },
        range(from: number, to: number) { start = from; end = to; return query; },
        maybeSingle() {
          const data = (rows[table] ?? []).filter((row) => predicates.every((predicate) => predicate(row)))[0] ?? null;
          return Promise.resolve({ data, error: null });
        },
        insert() { return Promise.resolve({ error: null }); },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const data = (rows[table] ?? []).filter((row) => predicates.every((predicate) => predicate(row))).slice(start, end + 1);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, filters };
}

test("A09 filtra tareas privadas, llamadas privadas y tareas de otras tiendas antes de devolverlas", async () => {
  const { client, filters } = fakeClient();
  const { tools } = buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["list_open_tasks", "get_task_history", "get_call_history"], "",
    selectedStore, ["core"], ["client_visible"],
    { actorUserId: organizationId, approvalMode: "required_before_publish" },
  );
  for (const name of ["list_open_tasks", "get_task_history"]) {
    const tool = tools.find((candidate) => candidate.name === name);
    assert.ok(tool, `${name} available`);
    const result = await tool.execute({ limit: 10 }) as { rows: Array<{ id: string }> };
    assert.deepEqual(result.rows.map((row) => row.id), ["selected-visible"]);
    assert.ok(filters.some((filter) => filter.table === "tasks" && filter.column === "store_id" && filter.value === selectedStore));
  }
  const calls = tools.find((candidate) => candidate.name === "get_call_history");
  assert.ok(calls);
  const result = await calls.execute({ limit: 10 });
  assert.match(JSON.stringify(result), /tienda/i);
  const organizationTools = buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["get_call_history"], "", null, ["core"], ["client_visible"],
    { actorUserId: organizationId, approvalMode: "required_before_publish" },
  ).tools;
  const organizationCalls = organizationTools.find((candidate) => candidate.name === "get_call_history");
  assert.ok(organizationCalls);
  const organizationResult = await organizationCalls.execute({ limit: 10 }) as { rows: Array<{ id: string }> };
  assert.deepEqual(organizationResult.rows.map((row) => row.id), [callId]);
  assert.ok(filters.some((filter) => filter.table === "consulting_calls" && filter.column === "is_visible_to_client" && filter.value === true));
});

test("A09 solo entrega el resumen publicado y recorta los campos internos de la llamada", async () => {
  const { client } = fakeClient();
  const { tools } = buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["get_call_detail"], "", null, ["core"], ["client_visible"],
    { actorUserId: organizationId, approvalMode: "required_before_publish" },
  );
  const tool = tools.find((candidate) => candidate.name === "get_call_detail");
  assert.ok(tool);
  const result = await tool.execute({ call_id: callId });
  assert.match(JSON.stringify(result), /Hecho/);
  assert.doesNotMatch(JSON.stringify(result), /Interno|Borrador privado/);
});

test("A09 anuncia las fechas que acepta meta_spend_detail", () => {
  const { client } = fakeClient();
  const { tools } = buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["meta_spend_detail"], "", null, ["core", "meta"],
    ["client_visible"], { actorUserId: organizationId, approvalMode: "required_before_publish" },
  );
  const tool = tools.find((candidate) => candidate.name === "meta_spend_detail");
  assert.ok(tool);
  const schema = tool.inputSchema as { properties: Record<string, unknown> };
  assert.ok(schema.properties.period_start);
  assert.ok(schema.properties.period_end);
});

test("A09 solo ofrece la cartera al personal autorizado", () => {
  const { client } = fakeClient();
  const build = (platformRole: string) => buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["get_consultant_workbench"], "", null, ["core"], ["client_visible"],
    {
      actorUserId: organizationId,
      approvalMode: "required_before_publish",
      actorContext: { profile: { platform_role: platformRole } } as never,
      bearerAuthorization: "Bearer test-token",
    },
  ).tools;
  assert.equal(build("user").some((tool) => tool.name === "get_consultant_workbench"), false);
  const tool = build("consultant").find((candidate) => candidate.name === "get_consultant_workbench");
  assert.ok(tool);
  assert.deepEqual((tool.inputSchema as { properties: { days: { enum: number[] } } }).properties.days.enum, [7, 30, 90]);
});
