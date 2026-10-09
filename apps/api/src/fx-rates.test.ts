import assert from "node:assert/strict";
import test from "node:test";
import { parseEcbXml } from "./fx-rates.js";

test("lee los tipos del BCE por dia y moneda", () => {
  const xml = `<Cube><Cube time='2026-10-07'><Cube currency='USD' rate='1.1177'/><Cube currency='GBP' rate='0.84645'/></Cube><Cube time="2026-10-06"><Cube currency="USD" rate="1.1100"/></Cube></Cube>`;
  assert.deepEqual(parseEcbXml(xml), [
    { rate_date: "2026-10-07", currency_code: "USD", eur_rate: 1.1177 },
    { rate_date: "2026-10-07", currency_code: "GBP", eur_rate: 0.84645 },
    { rate_date: "2026-10-06", currency_code: "USD", eur_rate: 1.11 },
  ]);
});
