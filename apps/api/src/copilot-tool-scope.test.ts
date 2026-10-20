import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentTools } from "./ai-runtime.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const selectedStore = "00000000-0000-4000-8000-000000000002";
const otherStore = "00000000-0000-4000-8000-000000000003";
const runId = "00000000-0000-4000-8000-000000000004";
const callId = "00000000-0000-4000-8000-000000000005";
const campaignItemId = "00000000-0000-4000-8000-000000000006";
const campaignCalendarId = "00000000-0000-4000-8000-000000000007";

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
    campaign_calendar_items: [
      { id: campaignItemId, organization_id: organizationId, calendar_id: campaignCalendarId, store_id: selectedStore, title: "Campaña seleccionada", is_visible_to_client: true, deleted_at: null },
      { id: "00000000-0000-4000-8000-000000000008", organization_id: organizationId, calendar_id: campaignCalendarId, store_id: otherStore, title: "Campaña ajena", is_visible_to_client: true, deleted_at: null },
    ],
    campaign_calendars: [
      { id: campaignCalendarId, organization_id: organizationId, store_id: selectedStore, name: "Calendario", year: 2026, is_visible_to_client: true },
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
        is(column: string, value: unknown) {
          filters.push({ table, column: `is:${column}`, value });
          predicates.push((row) => row[column] === value);
          return query;
        },
        or(expression: string) {
          filters.push({ table, column: "or", value: expression });
          const selectedStoreMatch = expression.match(/store_id\.eq\.([0-9a-f-]+)/i)?.[1];
          predicates.push((row) => row.store_id === null || row.store_id === undefined || row.store_id === selectedStoreMatch);
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

test("A09 comprueba tienda y visibilidad del elemento y calendario al leer una campaña exacta", async () => {
  const { client, filters } = fakeClient();
  const { tools } = buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["get_campaign_item_detail"], "", selectedStore, ["core"], ["client_visible"],
    {
      actorUserId: organizationId,
      approvalMode: "required_before_publish",
      actorContext: { profile: { platform_role: "user" }, memberships: [] } as never,
    },
  );
  const tool = tools.find((candidate) => candidate.name === "get_campaign_item_detail");
  assert.ok(tool);
  const result = await tool.execute({ campaign_item_id: campaignItemId });
  assert.match(JSON.stringify(result), /Campaña seleccionada/);
  assert.doesNotMatch(JSON.stringify(result), /Campaña ajena/);
  assert.ok(filters.some((filter) => filter.table === "campaign_calendar_items" && filter.column === "is_visible_to_client" && filter.value === true));
  assert.ok(filters.some((filter) => filter.table === "campaign_calendars" && filter.column === "is_visible_to_client" && filter.value === true));
  assert.ok(filters.some((filter) => filter.table === "campaign_calendar_items" && filter.column === "or"));
  assert.ok(filters.some((filter) => filter.table === "campaign_calendars" && filter.column === "or"));
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

test("A09 limita el detalle de borrador a miembros con permiso de marketing y sesión", () => {
  const { client } = fakeClient();
  const build = (role: string, hasBearer = true) => buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["get_marketing_draft_detail"], "", null, ["core"], ["client_visible"],
    {
      actorUserId: organizationId,
      approvalMode: "required_before_publish",
      actorContext: {
        profile: { platform_role: "user" },
        memberships: [{ organization_id: organizationId, role }],
      } as never,
      ...(hasBearer ? { bearerAuthorization: "Bearer test-token" } : {}),
    },
  ).tools.some((tool) => tool.name === "get_marketing_draft_detail");
  assert.equal(build("member"), false);
  assert.equal(build("owner", false), false);
  assert.equal(build("owner"), true);
});

test("A09 solo ofrece versiones históricas del Camino a la audiencia interna", () => {
  const { client } = fakeClient();
  const build = (audience: string[]) => buildAgentTools(
    {} as never, client as never, runId, organizationId,
    ["get_strategic_plan_version"], "", selectedStore, ["core"], audience,
    { actorUserId: organizationId, approvalMode: "required_before_publish" },
  ).tools;
  assert.equal(build(["client_visible"]).some((tool) => tool.name === "get_strategic_plan_version"), false);
  const tool = build(["consultant_only"]).find((candidate) => candidate.name === "get_strategic_plan_version");
  assert.ok(tool);
  assert.equal((tool.inputSchema as { properties: { plan_id: { format: string } } }).properties.plan_id.format, "uuid");
});
