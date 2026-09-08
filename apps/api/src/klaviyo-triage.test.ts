import assert from "node:assert/strict";
import test from "node:test";
import {
  rankKlaviyoAccounts,
  triageKlaviyoAccount,
  type KlaviyoAccountInput,
} from "./klaviyo-triage.js";

const AHORA = new Date("2026-09-08T12:00:00Z");

function cuenta(over: Partial<KlaviyoAccountInput> = {}): KlaviyoAccountInput {
  return {
    organization_id: "org-1",
    organization_name: "Tienda",
    connection_status: "connected",
    last_sync_at: "2026-09-08T10:00:00Z",
    sync_incomplete: false,
    emails_total: 4,
    emails_sin_utm: 0,
    emails_sin_cuerpo: 0,
    flows_active: 2,
    campaigns_in_window: 3,
    last_send_at: "2026-09-05T10:00:00Z",
    lists: 2,
    segments: 3,
    ...over,
  };
}

test("una tienda sana no pide revision", () => {
  const r = triageKlaviyoAccount(cuenta(), AHORA);
  assert.equal(r.level, "estable");
  assert.equal(r.score, 0);
  assert.deepEqual(r.reasons, []);
});

test("sin flujos activos es critica: no es que vaya mal, es que no envia", () => {
  const r = triageKlaviyoAccount(cuenta({ flows_active: 0 }), AHORA);
  assert.equal(r.level, "critica");
  assert.ok(r.reasons.some((x) => x.kind === "envio"));
});

test("con la conexion rota NO se afirma que no tenga flujos", () => {
  // El error que llevo a A12 a proponer montar flujos que ya existian: 0
  // flujos con el sync roto significa "no los hemos traido", no "no hay".
  const r = triageKlaviyoAccount(
    cuenta({ connection_status: "error", flows_active: 0 }),
    AHORA,
  );
  assert.equal(r.blind, true);
  assert.ok(
    !r.reasons.some((x) => x.text.includes("Ningún flujo activo")),
    "no debe afirmar que no hay flujos sin poder verlos",
  );
  assert.ok(r.reasons.some((x) => x.kind === "conexion"));
});

test("un sync viejo ciega la cuenta y la deja en alta", () => {
  const r = triageKlaviyoAccount(
    cuenta({ last_sync_at: "2026-09-01T10:00:00Z" }),
    AHORA,
  );
  assert.equal(r.blind, true);
  assert.equal(r.level, "alta");
});

test("un catalogo incompleto cuenta aunque el sync diga que fue bien", () => {
  const r = triageKlaviyoAccount(cuenta({ sync_incomplete: true }), AHORA);
  assert.equal(r.blind, true);
  assert.ok(r.reasons.some((x) => x.text.includes("dejó recursos")));
});

test("ningun email con UTM pesa mas que solo algunos", () => {
  const todos = triageKlaviyoAccount(
    cuenta({ emails_total: 4, emails_sin_utm: 4 }),
    AHORA,
  );
  const algunos = triageKlaviyoAccount(
    cuenta({ emails_total: 4, emails_sin_utm: 2 }),
    AHORA,
  );
  assert.ok(todos.score > algunos.score);
  assert.ok(todos.reasons.some((x) => x.kind === "medicion"));
});

test("un mes sin enviar deja la lista enfriandose", () => {
  const r = triageKlaviyoAccount(
    cuenta({ last_send_at: "2026-07-01T10:00:00Z" }),
    AHORA,
  );
  assert.ok(r.reasons.some((x) => x.text.includes("se enfría")));
  assert.equal(r.level, "media");
});

test("los emails sin cuerpo suman pero con tope", () => {
  const uno = triageKlaviyoAccount(cuenta({ emails_sin_cuerpo: 1 }), AHORA);
  const muchos = triageKlaviyoAccount(cuenta({ emails_sin_cuerpo: 40 }), AHORA);
  assert.ok(muchos.score > uno.score);
  assert.ok(muchos.score <= 18, "el tope evita que un caso ahogue al resto");
});

test("no conectada nunca sube igual, porque no saber es razon para mirar", () => {
  const r = triageKlaviyoAccount(
    cuenta({
      connection_status: null,
      last_sync_at: null,
      emails_total: 0,
      flows_active: 0,
      lists: 0,
      segments: 0,
      last_send_at: null,
    }),
    AHORA,
  );
  assert.equal(r.blind, true);
  assert.ok(r.score > 0, "una tienda sin conectar no puede parecer sana");
});

test("el orden manda la puntuacion, y a igualdad los emails en juego", () => {
  const ranking = rankKlaviyoAccounts(
    [
      cuenta({ organization_id: "a", organization_name: "Sana" }),
      cuenta({
        organization_id: "b",
        organization_name: "Sin flujos",
        flows_active: 0,
      }),
      cuenta({
        organization_id: "c",
        organization_name: "Rota",
        connection_status: "error",
      }),
    ],
    AHORA,
  );
  assert.equal(ranking[0]?.organization_id, "c");
  assert.equal(ranking[1]?.organization_id, "b");
  assert.equal(ranking[2]?.organization_id, "a");
});
