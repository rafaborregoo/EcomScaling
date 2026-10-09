import assert from "node:assert/strict";
import test from "node:test";
import { campaignBriefFromCamino } from "./camino-campaign-brief";

test("el brief ordena los hitos por fecha y cabe en el limite del agente", () => {
  const brief = campaignBriefFromCamino({
    planName: "Temporada de nieve",
    goal: "Ventas netas 72.000 €",
    milestones: [
      { name: "Navidad lista", date: "2026-12-10" },
      { name: "Black Friday preparado", date: "2026-11-13" },
      ...Array.from({ length: 200 }, (_, index) => ({ name: `Hito de relleno número ${index}`, date: "2027-01-01" })),
    ],
  });
  assert.ok(brief.length <= 1900);
  assert.ok(brief.indexOf("Black Friday preparado") < brief.indexOf("Navidad lista"));
  assert.ok(brief.includes("Temporada de nieve"));
});
