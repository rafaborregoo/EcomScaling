/**
 * A02 tiene un alcance propio para el panel de rentabilidad del consultor.
 * Lo que se fija aqui es el destinatario: el cliente no lo lee, el consultor
 * recibe un mensaje distinto, y el cron de los dashboards del cliente no lo
 * genera por su cuenta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSULTANT_MONITOR_SCOPES,
  MONITOR_DASHBOARD_SCOPES,
  PANEL_CONSULTANT_GUIDANCE,
  A02_MANUAL_REFRESH_DAILY_LIMIT,
  isMonitorDashboardScope,
  manualRefreshCapExceeded,
  panelReadingDue,
  monitorScopeAllowedFor,
} from "./ai-runtime.js";
import { normalizeProfitabilityDays } from "./consultant-profitability.js";

test("'panel' es un alcance valido de A02 pero no del cron del cliente", () => {
  assert.equal(isMonitorDashboardScope("panel"), true);
  assert.deepEqual([...CONSULTANT_MONITOR_SCOPES], ["panel"]);
  assert.equal((MONITOR_DASHBOARD_SCOPES as readonly string[]).includes("panel"), false);
  assert.equal(isMonitorDashboardScope("rentabilidad"), false);
});

test("el alcance del consultor lo leen consultor y admin, nunca un cliente", () => {
  assert.equal(monitorScopeAllowedFor("panel", "consultant"), true);
  assert.equal(monitorScopeAllowedFor("panel", "platform_admin"), true);
  assert.equal(monitorScopeAllowedFor("panel", "client"), false);
  assert.equal(monitorScopeAllowedFor("panel", ""), false);
});

test("los alcances del cliente siguen abiertos a todos", () => {
  for (const scope of MONITOR_DASHBOARD_SCOPES) {
    assert.equal(monitorScopeAllowedFor(scope, "client"), true);
  }
});

test("la guia del panel escribe para el consultor y no para el cliente", () => {
  assert.match(PANEL_CONSULTANT_GUIDANCE, /exclusivamente el consultor/);
  assert.match(PANEL_CONSULTANT_GUIDANCE, /tercera persona/);
  assert.match(PANEL_CONSULTANT_GUIDANCE, /nunca te dirijas al cliente/);
  // Rentabilidad con fiabilidad: sin costes no se da un beneficio como firme.
  assert.match(PANEL_CONSULTANT_GUIDANCE, /no presentes ese beneficio como firme/);
  // ADR-0021: lo atribuido se nombra como atribuido y no se suma.
  assert.match(PANEL_CONSULTANT_GUIDANCE, /atribuido por Meta/);
});

test("el periodo de la rentabilidad solo admite los del selector", () => {
  assert.equal(normalizeProfitabilityDays("90"), 90);
  assert.equal(normalizeProfitabilityDays("365"), 365);
  assert.equal(normalizeProfitabilityDays("45"), 30);
  assert.equal(normalizeProfitabilityDays(undefined), 30);
});

test("la lectura del panel se regenera con el cron y a mano rige el mismo tope de dos que en los dashboards", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  // Sin lectura previa, o con mas edad que el ritmo del cron de 12 h: toca.
  assert.equal(panelReadingDue(null, now), true);
  assert.equal(panelReadingDue(now - 11 * 60 * 60 * 1000, now), true);
  // Recien generada: no se repite en el mismo tick ni a las pocas horas.
  assert.equal(panelReadingDue(now - 3 * 60 * 60 * 1000, now), false);
  assert.equal(A02_MANUAL_REFRESH_DAILY_LIMIT, 2);
  assert.equal(manualRefreshCapExceeded(1, A02_MANUAL_REFRESH_DAILY_LIMIT), false);
  assert.equal(manualRefreshCapExceeded(2, A02_MANUAL_REFRESH_DAILY_LIMIT), true);
});
