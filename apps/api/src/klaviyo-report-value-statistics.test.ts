import assert from "node:assert/strict";
import test from "node:test";
import {
  isConversionMetricValueError,
  statisticsWithoutValues,
} from "./klaviyo-sync.js";

// Mensaje literal devuelto por la API el 2026-09-10 con `Placed Order`.
const ERROR_REAL =
  'klaviyo_api_error:EXTERNAL_RESOURCE_NOT_FOUND:400:{"errors":[{"status":400,' +
  '"code":"invalid","title":"Invalid input.","detail":"Passed in conversion ' +
  'metric does not support querying for values data","source":{"pointer":' +
  '"/data/attributes/conversion_metric_id"}}]}';

test("se reconoce el rechazo de la metrica de conversion, no cualquier 400", () => {
  assert.equal(isConversionMetricValueError(ERROR_REAL), true);
  assert.equal(
    isConversionMetricValueError("klaviyo_api_error:RATE_LIMITED:429:{}"),
    false,
  );
  assert.equal(isConversionMetricValueError(""), false);
});

test("el reintento conserva rendimiento y suelta solo lo que depende del valor", () => {
  const pedidas = [
    "bounce_rate",
    "click_rate",
    "clicks",
    "conversion_rate",
    "conversion_uniques",
    "conversion_value",
    "delivered",
    "open_rate",
    "opens_unique",
    "recipients",
    "revenue_per_recipient",
    "unsubscribes",
  ];
  const resto = statisticsWithoutValues(pedidas);

  // Lo que el modulo de email necesita para funcionar sigue ahi.
  for (const esperada of ["open_rate", "click_rate", "delivered", "recipients"]) {
    assert.ok(resto.includes(esperada), `falta ${esperada}`);
  }
  // Y las cuatro que hacen que Klaviyo rechace el informe entero, no.
  assert.deepEqual(
    pedidas.filter((s) => !resto.includes(s)),
    [
      "conversion_rate",
      "conversion_uniques",
      "conversion_value",
      "revenue_per_recipient",
    ],
  );
});

test("si solo se piden estadisticas de valor no queda nada que reintentar", () => {
  assert.deepEqual(statisticsWithoutValues(["conversion_value"]), []);
});
