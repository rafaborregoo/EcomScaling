/**
 * La mesa diaria no guarda nada: lo unico suyo es el criterio con el que
 * ordena y fusiona trabajo que ya existe. Ese criterio es justo lo que se
 * rompe en silencio -- la pantalla seguiria pintando ocho filas, solo que las
 * equivocadas, y el consultor dedicaria su hora al cliente que no tocaba.
 *
 * Lo que se protege aqui:
 *  - una conexion rota sube por encima de todo lo demas (sin datos, el resto
 *    de la mesa de ese cliente no se puede creer),
 *  - una alerta que YA tiene tarea abierta no ocupa dos filas: se fusiona y la
 *    relacion se declara como evidencia,
 *  - cada fila lleva al modulo que la ejecuta, con el cliente ya seleccionado,
 *  - si una fuente se cae, la cola sigue util y lo dice en vez de parecer
 *    "todo al dia",
 *  - un cliente sin cobertura financiera o sin sync no se presenta como si
 *    estuviera medido.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkbench,
  resolveActivityCut,
  type WorkbenchAlertRow,
  type WorkbenchCallRow,
  type WorkbenchConnectionRow,
  type WorkbenchMilestoneRow,
  type WorkbenchOrganization,
  type WorkbenchSourceKey,
  type WorkbenchSourceState,
  type WorkbenchTaskRow,
} from "./consultant-workbench.js";

const NOW = Date.parse("2026-09-21T10:00:00.000Z");
const DAY = 86_400_000;

function org(
  id: string,
  display_name: string,
  overrides: Partial<WorkbenchOrganization["attention"]> = {},
  store_count = 1,
): WorkbenchOrganization {
  return {
    id,
    display_name,
    store_count,
    attention: {
      open_alerts: 0,
      critical_alerts: 0,
      high_alerts: 0,
      oldest_alert_days: 0,
      overdue_tasks: 0,
      open_tasks: 0,
      score: 0,
      ...overrides,
    },
  };
}

function alert(overrides: Partial<WorkbenchAlertRow> = {}): WorkbenchAlertRow {
  return {
    id: "alert-1",
    organization_id: "org-a",
    severity: "critical",
    status: "open",
    title: "ROAS por debajo del break-even",
    first_detected_at: new Date(NOW - 2 * DAY).toISOString(),
    ...overrides,
  };
}

function task(overrides: Partial<WorkbenchTaskRow> = {}): WorkbenchTaskRow {
  return {
    id: "task-1",
    organization_id: "org-a",
    title: "Bajar presupuesto del conjunto frio",
    status: "pending",
    priority: "medium",
    due_at: null,
    alert_id: null,
    assignee_name: null,
    ...overrides,
  };
}

function call(overrides: Partial<WorkbenchCallRow> = {}): WorkbenchCallRow {
  return {
    id: "call-1",
    organization_id: "org-a",
    title: "Revisión mensual",
    scheduled_at: null,
    held_at: new Date(NOW - DAY).toISOString(),
    summary_pending: true,
    ...overrides,
  };
}

const ALL_OK: Record<WorkbenchSourceKey, WorkbenchSourceState> = {
  alerts: "ok",
  tasks: "ok",
  calls: "ok",
  proposals: "ok",
  messages: "ok",
  connections: "ok",
  financial: "ok",
  milestones: "ok",
  campaigns: "ok",
};

function build(
  overrides: Partial<Parameters<typeof buildWorkbench>[0]> = {},
): ReturnType<typeof buildWorkbench> {
  return buildWorkbench({
    organizations: [org("org-a", "Tienda A")],
    alerts: [],
    tasks: [],
    calls: [],
    proposals: [],
    threads: [],
    connections: [],
    organizationsWithFinancialSettings: ["org-a"],
    milestones: [],
    campaigns: [],
    sources: ALL_OK,
    windowDays: 30,
    nowMs: NOW,
    ...overrides,
  });
}

test("una conexion rota sube por encima del resto del trabajo del cliente", () => {
  const result = build({
    alerts: [alert({ severity: "high" })],
    calls: [call()],
    connections: [
      {
        organization_id: "org-a",
        provider: "shopify",
        status: "reauthorization_required",
        last_sync_at: new Date(NOW - 5 * DAY).toISOString(),
      },
    ],
  });

  assert.equal(result.actions[0]?.kind, "integration_reauth");
  assert.equal(result.actions[0]?.priority, "urgent");
  assert.match(result.actions[0]?.title ?? "", /Reconecta Shopify/);
});

test("una alerta con tarea abierta no ocupa dos filas: se fusiona con evidencia", () => {
  const result = build({
    alerts: [alert({ id: "alert-9" })],
    tasks: [
      task({
        id: "task-9",
        alert_id: "alert-9",
        due_at: new Date(NOW - 2 * DAY).toISOString(),
      }),
    ],
  });

  const kinds = result.actions.map((action) => action.kind);
  assert.deepEqual(kinds, ["overdue_task"]);
  assert.ok(
    result.actions[0]?.evidence.some(
      (item) => item.label === "Alerta vinculada",
    ),
    "la tarea debe declarar de que alerta viene",
  );
});

test("la alerta sin tarea que la trate si tiene su propia fila", () => {
  const result = build({
    alerts: [alert({ id: "alert-9" })],
    tasks: [task({ id: "task-9", alert_id: null })],
  });

  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["critical_alert"],
  );
});

test("una tarea cerrada no arrastra su alerta fuera de la cola", () => {
  // El filtro de tareas abiertas es lo unico que impide que una tarea
  // completada siga tapando su alerta: sin esto, cerrar la tarea sin resolver
  // la alerta la haria desaparecer de la mesa.
  const result = build({
    alerts: [alert({ id: "alert-9" })],
    tasks: [task({ id: "task-9", alert_id: "alert-9", status: "completed" })],
  });

  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["critical_alert"],
  );
});

test("dentro de la misma urgencia manda el cliente que peor va", () => {
  const result = build({
    organizations: [
      org("org-a", "Tienda A", { score: 2, critical_alerts: 1 }),
      org("org-b", "Tienda B", { score: 20, critical_alerts: 1 }),
    ],
    organizationsWithFinancialSettings: ["org-a", "org-b"],
    alerts: [
      alert({ id: "alert-a", organization_id: "org-a" }),
      alert({ id: "alert-b", organization_id: "org-b" }),
    ],
  });

  assert.deepEqual(
    result.actions.map((action) => action.organization_id),
    ["org-b", "org-a"],
  );
});

test("lo vencido va antes que lo que solo esta priorizado alto", () => {
  const result = build({
    tasks: [
      task({
        id: "task-late",
        priority: "high",
        due_at: new Date(NOW - 3 * DAY).toISOString(),
      }),
    ],
    milestones: [
      {
        id: "ms-1",
        organization_id: "org-a",
        name: "Lanzar bundle",
        // Pasado de fecha -> "high", igual que la tarea; desempata el vencimiento.
        target_date: new Date(NOW + 2 * DAY).toISOString().slice(0, 10),
        status: "in_progress",
        phase_name: "Escalado",
      },
    ],
  });

  assert.equal(result.actions[0]?.id, "overdue_task:task-late");
});

test("cada fila abre el modulo que la ejecuta con el cliente ya seleccionado", () => {
  const result = build({
    alerts: [alert()],
    calls: [call({ id: "call-2" })],
    tasks: [
      task({ id: "task-2", due_at: new Date(NOW - DAY).toISOString() }),
    ],
    threads: [
      {
        organization_id: "org-a",
        unread_count: 3,
        counterpart_name: "Marta",
        last_message_at: new Date(NOW - DAY).toISOString(),
      },
    ],
    proposals: [
      {
        organization_id: "org-a",
        title: "Reactivar flujo de carrito",
        rationale: "El flujo lleva 20 días pausado.",
        priority: "high",
        phase: "Retención",
        evidence: [{ label: "Envíos", value: "0 en 20 días", source: "klaviyo" }],
      },
    ],
    connections: [
      {
        organization_id: "org-a",
        provider: "meta",
        status: "error",
        last_sync_at: null,
      },
    ],
    organizationsWithFinancialSettings: [],
  });

  const hrefByKind = new Map(
    result.actions.map((action) => [action.kind, action.href]),
  );
  assert.equal(hrefByKind.get("overdue_task"), "/tareas?organizationId=org-a");
  assert.equal(hrefByKind.get("critical_alert"), "/tareas?organizationId=org-a");
  assert.equal(hrefByKind.get("ai_proposal"), "/tareas?organizationId=org-a");
  assert.equal(
    hrefByKind.get("call_approval"),
    "/llamadas?organizationId=org-a",
  );
  assert.equal(
    hrefByKind.get("unread_message"),
    "/mensajes?organizationId=org-a",
  );
  assert.equal(
    hrefByKind.get("integration_reauth"),
    "/integraciones?organizationId=org-a",
  );
  assert.equal(
    hrefByKind.get("financial_coverage"),
    "/configuracion?organizationId=org-a",
  );
  // Ninguna fila decide por su cuenta: todas mandan a una pantalla humana.
  for (const action of result.actions) {
    assert.ok(action.action_label.length > 0, action.kind);
    assert.ok(action.reason.length > 0, action.kind);
  }
});

test("una fuente caida no vacia la cola: el resto sigue y se declara", () => {
  const result = build({
    alerts: [alert()],
    sources: { ...ALL_OK, proposals: "error", messages: "error" },
  });

  assert.equal(result.actions.length, 1);
  assert.equal(result.sources.proposals, "error");
  assert.equal(result.sources.messages, "error");
  assert.equal(result.sources.alerts, "ok");
});

test("la cartera declara lo que no esta medido en vez de dar por buena la cifra", () => {
  const result = build({
    organizations: [org("org-a", "Tienda A", {}, 2), org("org-b", "Sin tienda", {}, 0)],
    organizationsWithFinancialSettings: [],
    connections: [
      {
        organization_id: "org-a",
        provider: "shopify",
        status: "connected",
        last_sync_at: new Date(NOW - 6 * DAY).toISOString(),
      },
    ],
  });

  const rowA = result.portfolio.find((row) => row.organization_id === "org-a");
  const rowB = result.portfolio.find((row) => row.organization_id === "org-b");
  assert.ok(
    rowA?.data_issues.some((issue) => issue.startsWith("Sin sincronizar")),
  );
  assert.ok(rowA?.data_issues.includes("Sin configuración financiera"));
  assert.ok(rowB?.data_issues.includes("Sin tienda conectada"));
  // Un cliente sin tienda no puede pedir costes que no tienen nada que costear.
  assert.equal(
    result.actions.filter(
      (action) =>
        action.kind === "financial_coverage" &&
        action.organization_id === "org-b",
    ).length,
    0,
  );
});

test("la cartera trae todos los clientes, tambien los que no tienen nada que hacer", () => {
  const result = build({
    organizations: [
      org("org-a", "Tienda A", { score: 18 }),
      org("org-b", "Tienda B"),
    ],
    organizationsWithFinancialSettings: ["org-a", "org-b"],
  });

  assert.equal(result.portfolio.length, 2);
  assert.equal(result.portfolio[0]?.status, "urgente");
  assert.equal(result.portfolio[1]?.status, "al_dia");
  assert.equal(result.portfolio[1]?.next_action, null);
});

test("la siguiente accion de un cliente es la primera de SU cola, no la global", () => {
  const result = build({
    organizations: [
      org("org-a", "Tienda A", { score: 30 }),
      org("org-b", "Tienda B", { score: 1 }),
    ],
    organizationsWithFinancialSettings: ["org-a", "org-b"],
    alerts: [alert({ id: "alert-a", organization_id: "org-a" })],
    calls: [call({ id: "call-b", organization_id: "org-b" })],
  });

  const rowB = result.portfolio.find((row) => row.organization_id === "org-b");
  assert.match(rowB?.next_action?.title ?? "", /Aprueba el resumen/);
  assert.equal(rowB?.next_action?.href, "/llamadas?organizationId=org-b");
});

test("los proximos siete dias solo traen lo que cae dentro de la ventana", () => {
  const inside = new Date(NOW + 2 * DAY).toISOString();
  const outside = new Date(NOW + 20 * DAY).toISOString();
  const milestones: WorkbenchMilestoneRow[] = [
    {
      id: "ms-in",
      organization_id: "org-a",
      name: "Hito cercano",
      target_date: inside.slice(0, 10),
      status: "in_progress",
      phase_name: "Escalado",
    },
    {
      id: "ms-out",
      organization_id: "org-a",
      name: "Hito lejano",
      target_date: outside.slice(0, 10),
      status: "in_progress",
      phase_name: "Escalado",
    },
  ];
  const result = build({
    milestones,
    calls: [
      call({ id: "call-soon", scheduled_at: inside, summary_pending: false }),
      call({ id: "call-far", scheduled_at: outside, summary_pending: false }),
    ],
    tasks: [task({ id: "task-soon", due_at: inside })],
  });

  const ids = result.upcoming.map((item) => item.id);
  assert.ok(ids.includes("milestone:ms-in"));
  assert.ok(ids.includes("call:call-soon"));
  assert.ok(ids.includes("task:task-soon"));
  assert.ok(!ids.includes("milestone:ms-out"));
  assert.ok(!ids.includes("call:call-far"));
  // Orden cronologico: lo primero que ocurre, arriba.
  const times = result.upcoming.map((item) => Date.parse(item.at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("el resumen cuenta lo que hay en la cola, no lo que hay en la base", () => {
  const result = build({
    organizations: [org("org-a", "Tienda A", { critical_alerts: 2, score: 20 })],
    alerts: [
      alert({ id: "alert-1" }),
      alert({ id: "alert-2", severity: "high" }),
    ],
    calls: [call({ id: "call-1" })],
    threads: [
      {
        organization_id: "org-a",
        unread_count: 1,
        counterpart_name: "Marta",
        last_message_at: new Date(NOW - 3 * DAY).toISOString(),
      },
    ],
  });

  assert.equal(result.summary.clients, 1);
  assert.equal(result.summary.critical_alerts, 2);
  assert.equal(result.summary.pending_call_summaries, 1);
  assert.equal(result.summary.unread_threads, 1);
  assert.equal(result.summary.urgent_clients, 1);
});

test("el trabajo de un cliente que no esta en la cartera no entra", () => {
  // La unica frontera valida es la lista de organizaciones autorizadas. Si
  // llega una fila de otra organizacion, se descarta aqui tambien.
  const result = build({
    alerts: [alert({ id: "alert-x", organization_id: "org-ajena" })],
    tasks: [
      task({
        id: "task-x",
        organization_id: "org-ajena",
        due_at: new Date(NOW - DAY).toISOString(),
      }),
    ],
  });

  assert.deepEqual(result.actions, []);
});

test("dos construcciones con los mismos datos dan la misma lista", () => {
  const input = {
    organizations: [
      org("org-a", "Tienda A", { score: 5 }),
      org("org-b", "Tienda B", { score: 5 }),
    ],
    organizationsWithFinancialSettings: ["org-a", "org-b"],
    alerts: [
      alert({ id: "alert-a", organization_id: "org-a" }),
      alert({ id: "alert-b", organization_id: "org-b" }),
    ],
  };

  assert.deepEqual(
    build(input).actions.map((action) => action.id),
    build(input).actions.map((action) => action.id),
  );
});

test("una conexion sana y reciente no genera ruido", () => {
  const connections: WorkbenchConnectionRow[] = [
    {
      organization_id: "org-a",
      provider: "shopify",
      status: "connected",
      last_sync_at: new Date(NOW - 3600_000).toISOString(),
    },
  ];
  const result = build({ connections });

  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.portfolio[0]?.data_issues, []);
});

// --- F3: "desde mi ultima revision" ---------------------------------------
// El corte de actividad es lo unico que hace que "lo que cambio" signifique
// algo distinto de "lo que pasa en los ultimos N dias". Si elige mal, el
// bloque sigue pintando numeros: solo que bajo una etiqueta que miente.

test("sin revision previa, la actividad se cuenta desde la ventana", () => {
  const windowStartIso = new Date(NOW - 30 * DAY).toISOString();
  assert.deepEqual(
    resolveActivityCut({ lastReviewedAt: null, windowStartIso }),
    { since: windowStartIso, kind: "window" },
  );
});

test("una revision dentro de la ventana manda sobre la ventana", () => {
  const windowStartIso = new Date(NOW - 30 * DAY).toISOString();
  const reviewedAt = new Date(NOW - 3 * DAY).toISOString();
  assert.deepEqual(
    resolveActivityCut({ lastReviewedAt: reviewedAt, windowStartIso }),
    { since: reviewedAt, kind: "review" },
  );
});

test("una revision mas vieja que la ventana NO ensancha la cuenta", () => {
  // Es el fallo silencioso que justifica la funcion: con la ventana en 7 dias
  // y una revision de hace tres meses, contar "desde tu revision" meteria 90
  // dias de alertas bajo esa etiqueta.
  const windowStartIso = new Date(NOW - 7 * DAY).toISOString();
  const reviewedAt = new Date(NOW - 90 * DAY).toISOString();
  assert.deepEqual(
    resolveActivityCut({ lastReviewedAt: reviewedAt, windowStartIso }),
    { since: windowStartIso, kind: "window" },
  );
});

test("una fecha de revision corrupta cae a la ventana en vez de reventar", () => {
  const windowStartIso = new Date(NOW - 30 * DAY).toISOString();
  assert.deepEqual(
    resolveActivityCut({ lastReviewedAt: "no-es-una-fecha", windowStartIso }),
    { since: windowStartIso, kind: "window" },
  );
});
