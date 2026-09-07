import assert from "node:assert/strict";
import test from "node:test";
import {
  rankStores,
  triageStore,
  type AgentSignal,
  type StoreInput,
} from "./store-triage.js";

const NOW = new Date("2026-09-07T12:00:00.000Z");
const HOY = "2026-09-07T09:00:00.000Z";

function signal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    agentCode: "a20_retencion_clientes",
    agentLabel: "Retención",
    ranAt: HOY,
    findings: [],
    proposals: [],
    confidence: "high",
    warnings: [],
    ...overrides,
  };
}

function store(overrides: Partial<StoreInput> = {}): StoreInput {
  return {
    connectionId: "c1",
    organizationId: "o1",
    organizationName: "Cliente",
    storeName: "tienda.myshopify.com",
    status: "connected",
    lastSyncAt: HOY,
    signals: [signal()],
    ...overrides,
  };
}

test("una tienda sana y analizada queda estable y sin motivos", () => {
  const result = triageStore(store(), NOW);

  assert.equal(result.level, "estable");
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.blind, false);
});

test("un hallazgo critico manda la tienda arriba", () => {
  const result = triageStore(
    store({
      signals: [
        signal({
          findings: [{ title: "Margen negativo", severity: "critical" }],
        }),
      ],
    }),
    NOW,
  );

  assert.equal(result.level, "critica");
  assert.equal(result.reasons[0]?.text, "Retención: Margen negativo");
});

test("la conexion rota es motivo suficiente aunque no haya hallazgos", () => {
  const result = triageStore(store({ status: "error" }), NOW);

  // Sin datos entrando, todo lo demas que se vea de esta tienda es una foto
  // vieja: es tan urgente como un hallazgo critico.
  assert.equal(result.level, "critica");
  assert.equal(result.blind, true);
  assert.match(result.reasons[0]!.text, /conexión con Shopify está rota/);
});

test("una tienda muda no puede parecer sana: el silencio puntua", () => {
  const muda = triageStore(store({ signals: [] }), NOW);
  const sana = triageStore(store(), NOW);

  assert.ok(muda.score > sana.score);
  assert.equal(muda.blind, true);
  assert.match(muda.reasons[0]!.text, /Ningún agente ha analizado/);
});

test("no sincronizar desde hace dias cuenta como no saber", () => {
  const result = triageStore(
    store({ lastSyncAt: "2026-08-13T16:13:42.000Z" }),
    NOW,
  );

  assert.equal(result.blind, true);
  assert.match(result.reasons[0]!.text, /Sin sincronizar desde hace 24 días/);
});

test("una tienda sincronizada ayer no se marca como parada", () => {
  const result = triageStore(
    store({ lastSyncAt: "2026-09-06T12:00:00.000Z" }),
    NOW,
  );

  assert.equal(result.blind, false);
  assert.equal(result.reasons.length, 0);
});

test("un analisis poco fiable sube la urgencia, no la baja", () => {
  const fiable = triageStore(store(), NOW);
  const dudoso = triageStore(
    store({ signals: [signal({ confidence: "low" })] }),
    NOW,
  );

  assert.ok(dudoso.score > fiable.score);
  assert.equal(dudoso.blind, true);
  assert.match(dudoso.reasons[0]!.text, /no es fiable/);
});

test("las tareas urgentes se resumen en una linea por agente", () => {
  const result = triageStore(
    store({
      signals: [
        signal({
          proposals: [{ priority: "urgent" }, { priority: "urgent" }],
        }),
      ],
    }),
    NOW,
  );

  const trabajo = result.reasons.filter((reason) => reason.kind === "trabajo");
  assert.equal(trabajo.length, 1);
  assert.match(trabajo[0]!.text, /2 tareas urgentes/);
});

test("los hallazgos informativos no ensucian la lista de motivos", () => {
  const result = triageStore(
    store({
      signals: [signal({ findings: [{ title: "Dato suelto", severity: "info" }] })],
    }),
    NOW,
  );

  assert.equal(result.reasons.length, 0);
  assert.equal(result.score, 0);
});

test("solo se devuelven los tres motivos mas graves", () => {
  const result = triageStore(
    store({
      status: "error",
      lastSyncAt: null,
      signals: [
        signal({
          findings: [
            { title: "Uno", severity: "critical" },
            { title: "Dos", severity: "high" },
            { title: "Tres", severity: "medium" },
          ],
        }),
      ],
    }),
    NOW,
  );

  assert.equal(result.reasons.length, 3);
  assert.ok(result.reasons[0]!.weight >= result.reasons[1]!.weight);
});

test("el ranking pone delante a la tienda con mas urgencia", () => {
  const ranked = rankStores(
    [
      store({ connectionId: "sana", storeName: "sana" }),
      store({
        connectionId: "rota",
        storeName: "rota",
        status: "error",
        signals: [
          signal({ findings: [{ title: "Sin stock", severity: "critical" }] }),
        ],
      }),
      store({
        connectionId: "muda",
        storeName: "muda",
        signals: [],
      }),
    ],
    NOW,
  );

  assert.deepEqual(
    ranked.map((row) => row.connection_id),
    ["rota", "muda", "sana"],
  );
});

test("a igualdad de urgencia va primero la que lleva mas sin mirarse", () => {
  const ranked = rankStores(
    [
      store({ connectionId: "reciente", signals: [signal({ ranAt: HOY })] }),
      store({
        connectionId: "antigua",
        signals: [signal({ ranAt: "2026-09-04T09:00:00.000Z" })],
      }),
    ],
    NOW,
  );

  assert.equal(ranked[0]?.connection_id, "antigua");
});
