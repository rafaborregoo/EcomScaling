import assert from "node:assert/strict";
import test from "node:test";
import {
  rankMetaAccounts,
  triageMetaAccount,
  type MetaAccountInput,
} from "./meta-triage.js";

const NOW = new Date("2026-09-08T12:00:00.000Z");

function account(overrides: Partial<MetaAccountInput> = {}): MetaAccountInput {
  return {
    organization_id: "org-1",
    organization_name: "Tienda sana",
    ad_accounts: 1,
    connection_status: "connected",
    last_sync_at: "2026-09-08T06:00:00.000Z",
    spend: 5000,
    days_with_spend: 30,
    pixels: 1,
    pixels_silent: 0,
    ads_with_issues: 0,
    ad_sets_learning: 0,
    spend_below_average: 0,
    spend_with_verdict: 5000,
    recent_changes: 2,
    ...overrides,
  };
}

test("una cuenta sin nada roto queda estable y sin motivos", () => {
  const result = triageMetaAccount(account(), NOW);
  assert.equal(result.level, "estable");
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.blind, false);
});

test("un pixel apagado deja la cuenta en critica por si solo", () => {
  const result = triageMetaAccount(account({ pixels_silent: 1 }), NOW);
  assert.equal(result.level, "critica");
  assert.equal(result.blind, true, "sin pixel no sabemos como va");
  assert.match(result.reasons[0]?.text ?? "", /optimizando a ciegas/);
});

test("la conexion rota pesa mas que cualquier hallazgo y ciega la cuenta", () => {
  const roto = triageMetaAccount(
    account({ connection_status: "error" }),
    NOW,
  );
  assert.equal(roto.level, "critica");
  assert.equal(roto.blind, true);
  assert.equal(roto.reasons[0]?.kind, "conexion");
});

test("no haber conectado nunca tambien es un motivo para mirar", () => {
  const result = triageMetaAccount(
    account({ connection_status: null, last_sync_at: null, spend: 0, pixels: 0 }),
    NOW,
  );
  // El silencio no puede parecer salud: sin esto quedaria la ultima de la lista.
  assert.notEqual(result.level, "estable");
  assert.equal(result.blind, true);
  assert.match(result.reasons[0]?.text ?? "", /ninguna cuenta de Meta conectada/);
});

test("una conexion rota no vuelve a acusar de sync viejo", () => {
  // Los dos motivos dirian lo mismo con otras palabras y el peso saldria
  // doble: si la conexion esta rota, es normal que no haya sincronizado.
  const result = triageMetaAccount(
    account({ connection_status: "error", last_sync_at: null }),
    NOW,
  );
  assert.equal(result.reasons.filter((r) => r.kind === "dato").length, 0);
});

test("los anuncios rechazados suman con techo", () => {
  const pocos = triageMetaAccount(account({ ads_with_issues: 1 }), NOW);
  const muchos = triageMetaAccount(account({ ads_with_issues: 50 }), NOW);

  assert.equal(pocos.level, "media");
  // Sin techo, cincuenta anuncios rechazados enterrarian un pixel apagado.
  assert.ok(muchos.score < 40, `cincuenta anuncios suman ${muchos.score}`);
});

test("el gasto detras de creatividades malas se mide en cuota, no en euros", () => {
  // Misma cuota, cuentas de tamaño muy distinto: las dos tienen el problema.
  const pequena = triageMetaAccount(
    account({ spend_below_average: 400, spend_with_verdict: 1000 }),
    NOW,
  );
  const grande = triageMetaAccount(
    account({ spend_below_average: 40000, spend_with_verdict: 100000 }),
    NOW,
  );

  assert.equal(pequena.score, grande.score);
  assert.match(pequena.reasons[0]?.text ?? "", /40% del gasto juzgado/);
});

test("sin veredictos no se inventa una cuota", () => {
  const result = triageMetaAccount(
    account({ spend_below_average: 0, spend_with_verdict: 0 }),
    NOW,
  );
  assert.equal(result.reasons.filter((r) => r.kind === "dinero").length, 0);
});

test("a igualdad de puntuacion se mira antes la que quema mas dinero", () => {
  const ranked = rankMetaAccounts(
    [
      account({
        organization_id: "org-poco",
        organization_name: "Poco gasto",
        pixels_silent: 1,
        spend: 300,
      }),
      account({
        organization_id: "org-mucho",
        organization_name: "Mucho gasto",
        pixels_silent: 1,
        spend: 90000,
      }),
    ],
    NOW,
  );

  assert.equal(ranked[0]?.organization_id, "org-mucho");
  assert.equal(ranked[0]?.score, ranked[1]?.score);
});

test("el orden va de mas urgente a menos", () => {
  const ranked = rankMetaAccounts(
    [
      account({ organization_id: "sana", organization_name: "Sana" }),
      account({
        organization_id: "aprendiendo",
        organization_name: "Aprendiendo",
        ad_sets_learning: 3,
      }),
      account({
        organization_id: "ciega",
        organization_name: "Ciega",
        pixels_silent: 1,
      }),
    ],
    NOW,
  );

  assert.deepEqual(
    ranked.map((row) => row.organization_id),
    ["ciega", "aprendiendo", "sana"],
  );
});

test("los motivos salen ordenados por peso", () => {
  const result = triageMetaAccount(
    account({ ads_with_issues: 1, pixels_silent: 1, ad_sets_learning: 2 }),
    NOW,
  );

  const pesos = result.reasons.map((reason) => reason.weight);
  assert.deepEqual(pesos, [...pesos].sort((a, b) => b - a));
  assert.equal(result.reasons[0]?.kind, "medicion");
});
