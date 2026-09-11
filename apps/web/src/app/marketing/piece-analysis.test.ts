/**
 * Las tres reglas fallan callando, y por eso llevan test.
 *
 * Si `isTemplateInUse` se equivoca, una pieza aprobada se queda en la sección
 * de borradores y el cliente cree que no tiene con qué salir. Si el indicador
 * de mensajes se enciende al revés, el consultor deja una objeción y el
 * cliente no ve nada que la delate. Y si el cuerpo de la pieza no viaja en la
 * pregunta, el Consultor IA responde con seguridad sobre un texto que no ha
 * leído.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPieceAnalysisQuestion,
  isTemplateInUse,
  threadIndicator,
} from "./piece-analysis";

test("aprobada y publicada son plantillas en uso; el resto son borradores", () => {
  assert.equal(isTemplateInUse("approved"), true);
  assert.equal(isTemplateInUse("published"), true);
  assert.equal(isTemplateInUse("draft"), false);
  assert.equal(isTemplateInUse("pending_approval"), false);
  // Rechazada vuelve a manos de quien la escribio: es borrador otra vez.
  assert.equal(isTemplateInUse("rejected"), false);
});

test("sin hilo no hay icono de mensaje", () => {
  assert.equal(threadIndicator(null, "client"), null);
  assert.equal(
    threadIndicator({ count: 0, last_at: null, last_author_kind: null }, "client"),
    null,
  );
});

test("el icono pide atencion cuando el ultimo que hablo no eres tu", () => {
  const consultorHabloUltimo = {
    count: 2,
    last_at: "2026-09-09T10:00:00.000Z",
    last_author_kind: "consultant",
  };

  const paraElCliente = threadIndicator(consultorHabloUltimo, "client");
  assert.equal(paraElCliente?.attention, true);
  assert.equal(paraElCliente?.count, 2);
  assert.match(paraElCliente?.label ?? "", /te han escrito/);

  // El mismo hilo, visto por quien escribio lo ultimo: no le han escrito.
  const paraElConsultor = threadIndicator(consultorHabloUltimo, "consultant");
  assert.equal(paraElConsultor?.attention, false);
  assert.equal(paraElConsultor?.count, 2);
});

test("la pregunta al copiloto lleva la pieza dentro y la marca como material", () => {
  const question = buildPieceAnalysisQuestion({
    template_name: "Rebajas de verano",
    subject: "Hasta -50%",
    preheader: "Solo esta semana",
    plain_text: "Cuerpo del email con la oferta.",
    status: "Aprobado",
    purpose: "Vender stock de verano",
    audience: "Compradores de los ultimos 90 dias",
    channel: "email_klaviyo",
    campaignTitle: "Verano 2026",
  });

  assert.match(question, /Rebajas de verano/);
  assert.match(question, /Hasta -50%/);
  assert.match(question, /Cuerpo del email con la oferta\./);
  assert.match(question, /Email \/ Klaviyo/);
  assert.match(question, /Verano 2026/);
  // El texto de la pieza va delimitado y declarado como material a evaluar:
  // si viajara suelto, cualquier "ignora lo anterior" dentro del cuerpo
  // (importado de Klaviyo, escrito por otro) seria una instruccion mas.
  assert.match(question, /<<</);
  assert.match(question, />>>/);
  assert.match(question, /no\s+instrucciones para ti/);
});

test("un cuerpo enorme se corta y lo dice", () => {
  const question = buildPieceAnalysisQuestion({
    template_name: "Largo",
    subject: "s",
    preheader: "p",
    plain_text: "x".repeat(5000),
    status: "Borrador",
    purpose: "",
    audience: "",
    channel: "meta_ads",
  });

  assert.match(question, /se ha cortado por longitud/);
  // Cortado, no mandado entero: el turno del copiloto tiene presupuesto.
  assert.ok(question.length < 5000);
  assert.match(question, /Anuncio de Meta Ads/);
});
