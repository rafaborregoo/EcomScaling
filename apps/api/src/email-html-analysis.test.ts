import assert from "node:assert/strict";
import test from "node:test";
import { analyzeEmailHtml } from "./email-html-analysis.js";

test("extracts bounded factual structure and signals without claiming rendered appearance", () => {
  const analysis = analyzeEmailHtml([
    '<html><head><meta name="viewport" content="width=device-width">',
    '<style>@media (max-width:600px){.cta{font-size:20px;color:#f00}}</style></head>',
    '<body><table><tr><td><h1>Hola {{ first_name }}</h1>',
    '<p style="font-size:16px;line-height:1.5;color:#111">OFERTA!!! ¿Vienes?</p>',
    '<a class="button" href="/sale" style="background-color:#080">Ver oferta</a>',
    '<img src="hero.jpg" alt="Colección" width="600"></td></tr></table></body></html>',
  ].join(""));
  assert.equal(analysis.structure.tables, 1);
  assert.equal(analysis.structure.rows, 1);
  assert.equal(analysis.responsive.mediaQueryCount, 1);
  assert.equal(analysis.responsive.hasViewportMeta, true);
  assert.deepEqual(analysis.typography.fontSizes, ["20px", "16px"]);
  assert.equal(analysis.links[0]?.buttonLike, true);
  assert.equal(analysis.textSignals.exclamations, 3);
  assert.equal(analysis.textSignals.questions, 1);
  assert.deepEqual(analysis.textSignals.dynamicMarkers, ["{{ first_name }}"]);
  assert.match(analysis.colors.note, /no representan area visible/);
  assert.ok(analysis.limitations.some((item) => item.includes("No se ha renderizado")));
});

test("handles absent html and flags truncation", () => {
  assert.equal(analyzeEmailHtml(null).structure.tables, 0);
  const truncated = analyzeEmailHtml("<div>" + "x".repeat(150_001));
  assert.equal(truncated.truncatedHtml, true);
  assert.ok(truncated.limitations.some((item) => item.includes("Analisis limitado")));
});
