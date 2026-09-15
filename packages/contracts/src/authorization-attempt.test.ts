/**
 * Que cuenta como intento de autorizacion abandonado.
 *
 * Lo que hay que proteger aqui son dos errores opuestos y los dos caros:
 *   - borrar el intento de alguien que en ese momento tiene abierta la pantalla
 *     de permisos de Shopify (se queda sin `state` y el callback falla);
 *   - dejar viva para siempre una fila `pending` que ocupa cupo del plan y se
 *     lee como una tienda rota.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZATION_ABANDONED_PURGE_MS,
  AUTHORIZATION_IN_PROGRESS_MS,
  authorizationPurgeCutoff,
  classifyAuthorizationAttempt,
  isPurgeableAuthorizationAttempt,
} from "./authorization-attempt.js";

const AHORA = new Date("2026-09-14T21:00:00.000Z");

function haceMs(ms: number): string {
  return new Date(AHORA.getTime() - ms).toISOString();
}

test("recien pulsado es una autorizacion en curso, no un problema", () => {
  const attempt = {
    status: "pending",
    connected_at: null,
    created_at: haceMs(30_000),
  };

  assert.equal(classifyAuthorizationAttempt(attempt, AHORA), "in_progress");
  assert.equal(isPurgeableAuthorizationAttempt(attempt, AHORA), false);
});

test("justo antes del margen sigue en curso; justo despues, abandonado", () => {
  const dentro = {
    status: "pending",
    connected_at: null,
    created_at: haceMs(AUTHORIZATION_IN_PROGRESS_MS - 1000),
  };
  const fuera = {
    status: "pending",
    connected_at: null,
    created_at: haceMs(AUTHORIZATION_IN_PROGRESS_MS + 1000),
  };

  assert.equal(classifyAuthorizationAttempt(dentro, AHORA), "in_progress");
  assert.equal(classifyAuthorizationAttempt(fuera, AHORA), "abandoned");
});

test("abandonado no se borra hasta pasar el plazo de purga", () => {
  const reciente = {
    status: "pending",
    connected_at: null,
    created_at: haceMs(AUTHORIZATION_IN_PROGRESS_MS + 60_000),
  };
  const viejo = {
    status: "pending",
    connected_at: null,
    created_at: haceMs(AUTHORIZATION_ABANDONED_PURGE_MS + 1000),
  };

  // Entre los dos plazos la persona ve "no terminaste de conectar" y puede
  // retomarlo: la fila no puede evaporarse mientras la esta mirando.
  assert.equal(classifyAuthorizationAttempt(reciente, AHORA), "abandoned");
  assert.equal(isPurgeableAuthorizationAttempt(reciente, AHORA), false);

  assert.equal(isPurgeableAuthorizationAttempt(viejo, AHORA), true);
});

test("relanzar el flujo reinicia el reloj", () => {
  const attempt = {
    status: "pending",
    connected_at: null,
    created_at: haceMs(AUTHORIZATION_ABANDONED_PURGE_MS * 3),
    updated_at: haceMs(10_000),
  };

  // El upsert del arranque pisa la fila: cuenta el ultimo intento, no el
  // primero. Si no, un reintento nacia ya marcado para borrar.
  assert.equal(classifyAuthorizationAttempt(attempt, AHORA), "in_progress");
  assert.equal(isPurgeableAuthorizationAttempt(attempt, AHORA), false);
});

test("una tienda conectada nunca es un intento, aunque hoy este pending", () => {
  const conectada = {
    status: "pending",
    connected_at: haceMs(AUTHORIZATION_ABANDONED_PURGE_MS * 10),
    created_at: haceMs(AUTHORIZATION_ABANDONED_PURGE_MS * 10),
  };

  assert.equal(classifyAuthorizationAttempt(conectada, AHORA), null);
  assert.equal(isPurgeableAuthorizationAttempt(conectada, AHORA), false);
});

test("los demas estados quedan fuera: no son intentos de autorizacion", () => {
  for (const status of [
    "connected",
    "error",
    "reauthorization_required",
    "disconnected",
    "pending_deletion",
  ]) {
    assert.equal(
      classifyAuthorizationAttempt(
        { status, connected_at: null, created_at: haceMs(86_400_000) },
        AHORA,
      ),
      null,
      `${status} no deberia tratarse como intento de autorizacion`,
    );
  }
});

test("una fecha ilegible no autoriza a borrar nada", () => {
  const attempt = {
    status: "pending",
    connected_at: null,
    created_at: "no-es-una-fecha",
  };

  assert.equal(classifyAuthorizationAttempt(attempt, AHORA), "in_progress");
  assert.equal(isPurgeableAuthorizationAttempt(attempt, AHORA), false);
});

test("el corte de la purga es justo el plazo hacia atras", () => {
  assert.equal(
    authorizationPurgeCutoff(AHORA),
    new Date(AHORA.getTime() - AUTHORIZATION_ABANDONED_PURGE_MS).toISOString(),
  );
});
