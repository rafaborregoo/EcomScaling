import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaCreativeAssetRows,
  buildMetaInsightRowPayload,
  parseMetaPixelStats,
} from "./meta-sync.js";

// --- Estadisticas del pixel -------------------------------------------------

test("el mapa de eventos por bucket se abre en una fila por evento", () => {
  const rows = parseMetaPixelStats([
    {
      start_time: "2026-09-01T00:00:00+0000",
      value: { PageView: "1200", Purchase: 18 },
    },
  ]);

  assert.deepEqual(rows, [
    { metricDate: "2026-09-01", eventName: "PageView", eventCount: 1200 },
    { metricDate: "2026-09-01", eventName: "Purchase", eventCount: 18 },
  ]);
});

test("tambien se lee la forma plana, un evento por entrada", () => {
  const rows = parseMetaPixelStats([
    { start_time: "2026-09-02T00:00:00+0000", event: "Purchase", value: "7" },
  ]);

  assert.deepEqual(rows, [
    { metricDate: "2026-09-02", eventName: "Purchase", eventCount: 7 },
  ]);
});

test("una entrada sin fecha no inventa un dia", () => {
  assert.deepEqual(parseMetaPixelStats([{ value: { PageView: 5 } }]), []);
});

test("una forma que no reconocemos devuelve vacio y no ceros", () => {
  // El llamador registra un error justo con esto: un pixel sin eventos y un
  // pixel que no sabemos leer se ven igual desde fuera.
  assert.deepEqual(
    parseMetaPixelStats([{ start_time: "2026-09-03T00:00:00+0000", data: 5 }]),
    [],
  );
});

// --- Piezas de la creatividad -----------------------------------------------

test("una creatividad fija se abre en sus piezas y todas son primarias", () => {
  const rows = buildMetaCreativeAssetRows({
    image_hash: "abc123",
    body: "Envio gratis hoy",
    title: "Zapatillas nuevas",
    link_url: "https://tienda.example/zapatillas",
    call_to_action_type: "SHOP_NOW",
  });

  assert.deepEqual(
    rows.map((row) => [row.asset_type, row.is_primary]),
    [
      ["image", true],
      ["primary_text", true],
      ["headline", true],
      ["link_url", true],
      ["call_to_action", true],
    ],
  );
  assert.equal(rows[0]?.asset_hash, "abc123");
});

test("las variantes dinamicas salen numeradas y no como primarias", () => {
  const rows = buildMetaCreativeAssetRows({
    asset_feed_spec: {
      bodies: [{ text: "Copy A" }, { text: "Copy B" }],
      videos: [{ video_id: "v1", thumbnail_url: "https://t/1.jpg" }],
      call_to_action_types: ["SHOP_NOW"],
    },
  });

  assert.deepEqual(
    rows.map((row) => [row.asset_type, row.position, row.is_primary]),
    [
      ["primary_text", 0, false],
      ["primary_text", 1, false],
      ["video", 0, false],
      ["call_to_action", 0, false],
    ],
  );
  assert.equal(rows[1]?.text_value, "Copy B");
  assert.equal(rows[2]?.external_asset_id, "v1");
  assert.equal(rows[3]?.text_value, "SHOP_NOW");
});

test("una creatividad vacia no genera piezas", () => {
  assert.deepEqual(buildMetaCreativeAssetRows({ id: "c1" }), []);
});

// --- Cortes de desglose -----------------------------------------------------

test("un corte distinto cambia el hash, asi que no se pisa con el de plataforma", () => {
  const insight = {
    ad_id: "ad-1",
    date_start: "2026-09-01",
    publisher_platform: "facebook",
    age: "25-34",
    gender: "female",
  };

  const platform = buildMetaInsightRowPayload(
    "org-1",
    "acct-1",
    insight,
    undefined,
    "2026-09-01T00:00:00.000Z",
    undefined,
  );
  const demographic = buildMetaInsightRowPayload(
    "org-1",
    "acct-1",
    insight,
    undefined,
    "2026-09-01T00:00:00.000Z",
    undefined,
    ["age", "gender"],
  );

  assert.deepEqual(platform?.breakdowns, { publisher_platform: "facebook" });
  assert.deepEqual(demographic?.breakdowns, {
    age: "25-34",
    gender: "female",
  });
  assert.notEqual(platform?.breakdown_hash, demographic?.breakdown_hash);
});

test("un corte sin valores de desglose cae en 'none', no en un hash falso", () => {
  const row = buildMetaInsightRowPayload(
    "org-1",
    "acct-1",
    { ad_id: "ad-1", date_start: "2026-09-01" },
    undefined,
    "2026-09-01T00:00:00.000Z",
    undefined,
    ["country"],
  );

  assert.equal(row?.breakdowns, null);
  assert.equal(row?.breakdown_hash, "none");
});
