/**
 * El aviso de "esta integración ha dejado de sincronizar".
 *
 * El caso que motiva esto, medido en producción: el token de Shopify caducó el
 * 13/08 y su refresco falla desde entonces, pero los webhooks siguieron
 * escribiendo 185 pedidos nuevos. Con las ventas de hoy en pantalla, un aviso
 * que dice "los datos pueden estar desactualizados" no lo cree nadie. Solo
 * mueve a actuar decir qué está parado y desde cuándo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeFreshness,
  freshnessMessage,
  type ScopeRun,
} from "./integration-freshness.js";

const AHORA = new Date("2026-09-07T08:00:00.000Z");

const run = (scope: string, at: string): ScopeRun => ({
  sync_scope: scope,
  last_success_at: at,
});

test("separa lo que sigue llegando de lo que se paró", () => {
  const summary = summarizeFreshness(
    [
      run("orders", "2026-09-07T07:05:00.000Z"),
      run("catalog", "2026-09-06T21:51:00.000Z"),
      run("customers", "2026-08-13T16:13:00.000Z"),
      run("refunds", "2026-08-13T16:13:00.000Z"),
    ],
    AHORA,
  );

  assert.deepEqual(summary.fresh, ["orders", "catalog"]);
  assert.deepEqual(
    summary.stale.map((item) => item.scope),
    ["customers", "refunds"],
  );
});

test("el aviso nombra lo que llega, lo que no, y desde cuándo", () => {
  const message = freshnessMessage(
    summarizeFreshness(
      [
        run("orders", "2026-09-07T07:05:00.000Z"),
        run("customers", "2026-08-13T16:13:00.000Z"),
        run("refunds", "2026-08-20T10:00:00.000Z"),
      ],
      AHORA,
    ),
    AHORA,
  );

  // La fecha es la del bloque parado hace MÁS tiempo, no la del último.
  assert.equal(
    message,
    "Pedidos siguen llegando, pero clientes y devoluciones no se actualizan desde el 13 de agosto.",
  );
});

test("sin nada parado no hay aviso", () => {
  // Una conexión que quedó en error por un motivo ya resuelto dejaría de
  // gritar; sin esto el aviso se vuelve ruido y se aprende a ignorarlo.
  assert.equal(
    freshnessMessage(
      summarizeFreshness([run("orders", "2026-09-07T07:05:00.000Z")], AHORA),
      AHORA,
    ),
    null,
  );
});

test("con todo parado no se inventa que algo llega", () => {
  const message = freshnessMessage(
    summarizeFreshness(
      [
        run("orders", "2026-08-13T16:13:00.000Z"),
        run("customers", "2026-08-13T16:13:00.000Z"),
      ],
      AHORA,
    ),
    AHORA,
  );

  assert.equal(
    message,
    "Pedidos y clientes no se actualizan desde el 13 de agosto.",
  );
});

test("48 h de margen: una pasada saltada no es una avería", () => {
  const summary = summarizeFreshness(
    [run("inventory", "2026-09-06T08:00:00.000Z")],
    AHORA,
  );
  assert.deepEqual(summary.stale, []);
});

test("una fecha ilegible cuenta como parada", () => {
  // Avisar de más deja a alguien comprobando; avisar de menos deja a alguien
  // mirando cifras viejas creyéndolas de hoy.
  const summary = summarizeFreshness([run("customers", "no-es-fecha")], AHORA);
  assert.equal(summary.stale.length, 1);
  assert.deepEqual(summary.fresh, []);
});
