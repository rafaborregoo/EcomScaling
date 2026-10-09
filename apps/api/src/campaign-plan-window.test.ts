import assert from "node:assert/strict";
import test from "node:test";
import {
  localCampaignDateTimeToUtc,
  resolveCampaignPlanWindow,
} from "./campaign-plan-window.js";

test("los horizontes predefinidos incluyen hoy en la zona de la tienda", () => {
  const result = resolveCampaignPlanWindow(
    { horizon: "week_1" },
    { timezone: "Europe/Madrid", now: new Date("2026-10-07T12:00:00.000Z") },
  );

  assert.deepEqual(result, {
    ok: true,
    startDate: "2026-10-07",
    endDate: "2026-10-13",
    timezone: "Europe/Madrid",
    days: 7,
  });
});

test("el intervalo personalizado admite hoy y rechaza fechas pasadas e intervalos mayores de un año", () => {
  const options = {
    timezone: "Europe/Madrid",
    now: new Date("2026-10-06T12:00:00.000Z"),
  };
  assert.equal(
    resolveCampaignPlanWindow(
      { horizon: "custom", startDate: "2026-10-05", endDate: "2026-10-07" },
      options,
    ).ok,
    false,
  );
  assert.equal(resolveCampaignPlanWindow(
    { horizon: "custom", startDate: "2026-10-06", endDate: "2026-10-07" }, options,
  ).ok, true);
  assert.equal(
    resolveCampaignPlanWindow(
      { horizon: "custom", startDate: "2026-10-07", endDate: "2027-10-08" },
      options,
    ).ok,
    false,
  );
});

test("la hora de calendario respeta el cambio horario de la tienda", () => {
  assert.equal(
    localCampaignDateTimeToUtc("2026-03-29", "Europe/Madrid").toISOString(),
    "2026-03-29T07:00:00.000Z",
  );
  assert.equal(
    localCampaignDateTimeToUtc("2026-11-27", "Europe/Madrid", 17, 30).toISOString(),
    "2026-11-27T16:30:00.000Z",
  );
});
