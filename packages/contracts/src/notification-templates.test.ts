import assert from "node:assert/strict";
import test from "node:test";
import { NOTIFICATION_TYPES } from "./notification-catalog.js";
import { NOTIFICATION_TEMPLATES, renderNotification } from "./notification-templates.js";

test("todo tipo del catálogo tiene plantilla", () => {
  for (const type of Object.keys(NOTIFICATION_TYPES)) {
    assert.ok(type in NOTIFICATION_TEMPLATES, `falta la plantilla de ${type}`);
  }
});

test("Para hoy: cuenta las que vencen hoy y las que van tarde, tarde primero", () => {
  const rendered = renderNotification(
    "daily_today",
    {
      store: "Prueba Borrego",
      tasks: [
        { id: "1", title: "Hoy", late: false },
        { id: "2", title: "Ayer", late: true },
      ],
    },
    "org",
  );
  assert.equal(rendered.title, "Para hoy en Prueba Borrego: 2 tareas");
  assert.equal(rendered.message, "1 vence hoy y 1 va tarde. «Ayer» y «Hoy».");
  assert.equal(rendered.url, "/tareas?organizationId=org&focus=2,1");
});

test("decisión del cliente sobre la IA: qué, por qué y a la propuesta", () => {
  const rendered = renderNotification(
    "client_decided_ai_output",
    { outputId: "o1", store: "Huerta", approved: false, titles: ["A", "B"], reason: "Ya lo hacemos" },
    "org",
  );
  assert.equal(rendered.title, "Huerta ha descartado 2 propuestas de NORA");
  assert.equal(rendered.message, "«A» y «B». Motivo: Ya lo hacemos");
  assert.equal(rendered.url, "/propuestas/o1?organizationId=org");
});

test("integración caída: nombra la plataforma y apunta a la conexión", () => {
  const rendered = renderNotification(
    "integration_error",
    { connectionId: "c1", provider: "meta_ads", accountName: "Cuenta Huerta" },
    "org",
  );
  assert.equal(rendered.title, "Meta Ads se ha desconectado");
  assert.equal(rendered.entityId, "c1");
  assert.ok(rendered.message?.startsWith("Cuenta Huerta. "));
});

test("alerta al consultor lleva la tienda delante; al cliente no", () => {
  const data = { alertId: "a1", title: "Ventas -40 %", message: null };
  assert.equal(renderNotification("alert_critical", { ...data, store: "Huerta" }, "org").title, "Huerta: Ventas -40 %");
  assert.equal(renderNotification("alert_critical", { ...data, store: null }, "org").title, "Ventas -40 %");
});
