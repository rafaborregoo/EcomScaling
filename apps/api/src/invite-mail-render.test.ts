/**
 * El cuerpo del correo de invitacion. Se prueba el render, no el envio: lo que
 * se puede romper sin que nadie lo note es el contenido -- un enlace escapado
 * de mas deja de funcionar, y un correo sin URL visible es inservible en cuanto
 * el cliente no pinta el boton.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { renderInviteHtml, renderInviteText } from "./invite-mailer.js";

const base = {
  to: "cliente@example.com",
  title: "Invitación a Acme en E-NORA",
  intro: "Tu consultor ha creado la organización Acme.",
  actionLabel: "Revisar invitación",
  actionUrl: "https://app.ecomscaling.es/acceso?code=ABC123",
};

test("el enlace aparece en el href y tambien como texto copiable", () => {
  const out = renderInviteHtml(base);

  // El & de la query se escapa en el atributo, que es lo correcto en HTML;
  // lo que no puede pasar es que el enlace no este.
  assert.ok(out.includes("acceso?code=ABC123"));
  assert.ok(out.includes('href="https://app.ecomscaling.es/acceso?code=ABC123"'));
  // Dos veces: el boton y el texto de respaldo de debajo.
  assert.equal(out.split("https://app.ecomscaling.es/acceso?code=ABC123").length - 1, 3);
});

test("quien invita sale en el cuerpo y en el preheader", () => {
  const out = renderInviteHtml({ ...base, senderName: "Noemí Parada" });

  assert.ok(out.includes("<strong>Noemí Parada</strong> te ha invitado"));
  assert.ok(out.includes("Noemí Parada te ha invitado a E-NORA."));
});

test("sin quien invita no se cuela una linea vacia ni un 'undefined'", () => {
  const out = renderInviteHtml(base);

  assert.ok(!out.includes("undefined"));
  assert.ok(!out.includes("te ha invitado a E-NORA"));
});

test("la caducidad se escribe en castellano y solo si la hay", () => {
  const conFecha = renderInviteHtml({
    ...base,
    expiresAt: "2026-09-22T10:00:00.000Z",
  });
  assert.ok(conFecha.includes("22 de septiembre de 2026"));

  assert.ok(!renderInviteHtml(base).includes("caduca"));
  // Una fecha ilegible no puede romper el correo ni imprimir "Invalid Date".
  assert.ok(!renderInviteHtml({ ...base, expiresAt: "ayer" }).includes("caduca"));
});

test("el nombre del destinatario se escapa: no se inyecta HTML por el perfil", () => {
  const out = renderInviteHtml({
    ...base,
    recipientName: '<script>alert("x")</script>',
  });

  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
});

test("la version en texto lleva el enlace y no deja lineas 'null'", () => {
  const out = renderInviteText({ ...base, senderName: "Noemí Parada" });

  assert.ok(out.includes("https://app.ecomscaling.es/acceso?code=ABC123"));
  assert.ok(out.includes("Noemí Parada te ha invitado"));
  assert.ok(!out.includes("null"));
  assert.ok(!out.includes("undefined"));
});
