/**
 * A05 (estrategia de campanas): las dos cosas que, si fallan, fallan callando.
 *
 *  1. Las fechas. El modelo devuelve DESPLAZAMIENTOS en dias y el backend las
 *     ancla al momento de APROBAR. Si alguien las anclara al de generar, un
 *     plan propuesto el lunes y aprobado el viernes nace con la primera
 *     campana empezada hace cuatro dias -- y el calendario se ve perfectamente
 *     normal.
 *  2. El indice de la seleccion. El consultor descarta campanas antes de
 *     aprobar; si al filtrar se reindexara, se crearia la campana equivocada
 *     con el titulo de otra. Tambien parece correcto salvo que lo leas.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignPlanOutputSchema,
  CAMPAIGN_PLAN_HORIZON_DAYS,
} from "@ecomscaling/ai";
import { campaignPlanToCalendarItems } from "./campaign-planning.js";

const plan = {
  plan_name: "Recuperar la base y sostener margen",
  diagnosis: "Email atribuye 1.240 EUR en 90 dias sin flujo de carrito.",
  campaigns: [
    {
      title: "Flujo de carrito abandonado",
      channel: "Email" as const,
      objective: "Recuperar compras iniciadas",
      audience: "Quien anadio al carrito y no compro en 7 dias",
      hypothesis: "No existe flujo de carrito y el 38% anade sin comprar",
      start_offset_days: 3,
      duration_days: 14,
      evidence: [
        {
          label: "Ingresos atribuidos por Klaviyo",
          value: "1.240 EUR",
          period: "ultimos 90 dias",
          source: "klaviyo" as const,
        },
      ],
      success_metric: "Mas de 400 EUR atribuidos por Klaviyo en 30 dias",
    },
    {
      title: "Reactivacion de inactivos 90 dias",
      channel: "Email" as const,
      objective: "Recuperar clientes dormidos",
      audience: "Compraron hace mas de 90 dias",
      hypothesis: "La base no recibe nada desde junio",
      start_offset_days: 21,
      duration_days: 7,
      evidence: [],
      success_metric: "Tasa de apertura por encima del 25%",
    },
    {
      title: "Escalar el conjunto rentable en Meta",
      channel: "Meta" as const,
      objective: "Subir ventas con ROAS sostenible",
      audience: "Similar a compradores de los ultimos 180 dias",
      hypothesis: "El conjunto actual aguanta ROAS 2.8 con poco gasto",
      start_offset_days: 45,
      duration_days: 30,
      evidence: [],
      success_metric: "ROAS por encima de 2.5 con el doble de gasto",
    },
  ],
  sources: [
    { kind: "metric" as const, reference: "klaviyo_email_report", period: "90d" },
  ],
  confidence: "medium" as const,
  warnings: ["Meta sin gasto en los ultimos 30 dias."],
};

test("el contrato exige hipotesis y criterio de exito en cada campana", () => {
  assert.ok(campaignPlanOutputSchema.safeParse(plan).success);

  const sinHipotesis = structuredClone(plan) as Record<string, any>;
  delete sinHipotesis.campaigns[0].hypothesis;
  assert.equal(
    campaignPlanOutputSchema.safeParse(sinHipotesis).success,
    false,
    "una campana sin hipotesis es un capricho, no una propuesta",
  );

  const sinCriterio = structuredClone(plan) as Record<string, any>;
  delete sinCriterio.campaigns[0].success_metric;
  assert.equal(
    campaignPlanOutputSchema.safeParse(sinCriterio).success,
    false,
    "sin criterio de exito nadie sabra si funciono",
  );
});

test("una campana no puede durar cero dias ni arrancar en negativo", () => {
  const duracionCero = structuredClone(plan) as Record<string, any>;
  duracionCero.campaigns[0].duration_days = 0;
  assert.equal(campaignPlanOutputSchema.safeParse(duracionCero).success, false);

  const arranqueNegativo = structuredClone(plan) as Record<string, any>;
  arranqueNegativo.campaigns[0].start_offset_days = -1;
  assert.equal(
    campaignPlanOutputSchema.safeParse(arranqueNegativo).success,
    false,
  );
});

test("solo acepta canales que el calendario sabe mapear", () => {
  const canalInventado = structuredClone(plan) as Record<string, any>;
  canalInventado.campaigns[0].channel = "TikTok";
  assert.equal(
    campaignPlanOutputSchema.safeParse(canalInventado).success,
    false,
    "un canal que el calendario no mapea acabaria como tarea 'general'",
  );
});

test("las fechas se anclan al momento de aprobar, no al de generar", () => {
  const aprobadoEl = Date.parse("2026-09-05T10:00:00.000Z");
  const items = campaignPlanToCalendarItems(
    campaignPlanOutputSchema.parse(plan),
    aprobadoEl,
  );

  assert.equal(items.length, 3);
  // 5 de septiembre + 3 dias = 8 de septiembre; +14 de duracion = 22.
  assert.equal(items[0]?.startsAt.slice(0, 10), "2026-09-08");
  assert.equal(items[0]?.endsAt.slice(0, 10), "2026-09-22");

  // Aprobar una semana mas tarde corre TODO el plan esa misma semana.
  const unaSemanaDespues = campaignPlanToCalendarItems(
    campaignPlanOutputSchema.parse(plan),
    aprobadoEl + 7 * 86_400_000,
  );
  assert.equal(unaSemanaDespues[0]?.startsAt.slice(0, 10), "2026-09-15");
  assert.equal(unaSemanaDespues[0]?.endsAt.slice(0, 10), "2026-09-29");
});

test("descartar campanas no reindexa: se crea la que el consultor eligio", () => {
  const items = campaignPlanToCalendarItems(
    campaignPlanOutputSchema.parse(plan),
    Date.parse("2026-09-05T10:00:00.000Z"),
    [2],
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.index, 2);
  assert.equal(items[0]?.title, "Escalar el conjunto rentable en Meta");
  assert.equal(items[0]?.channel, "Meta");
  // +45 dias desde el 5 de septiembre = 20 de octubre.
  assert.equal(items[0]?.startsAt.slice(0, 10), "2026-10-20");
});

test("los indices invalidos o repetidos que llegan del cliente se descartan", () => {
  const parsed = campaignPlanOutputSchema.parse(plan);
  const now = Date.parse("2026-09-05T10:00:00.000Z");

  assert.deepEqual(
    campaignPlanToCalendarItems(parsed, now, [9, -1, 1.5, 1, 1]).map(
      (item) => item.index,
    ),
    [1],
    "fuera de rango, negativos, no enteros y duplicados fuera",
  );
  assert.deepEqual(campaignPlanToCalendarItems(parsed, now, []), []);
});

test("la hipotesis y el criterio viajan a la descripcion del item", () => {
  const items = campaignPlanToCalendarItems(
    campaignPlanOutputSchema.parse(plan),
    Date.now(),
    [0],
  );
  const description = items[0]?.description ?? "";

  // Sin esto, dentro de tres semanas el item del calendario es un titulo suelto
  // y nadie recuerda por que se planifico.
  assert.ok(description.includes("Hipótesis:"));
  assert.ok(description.includes("Se cumple cuando:"));
  assert.ok(description.includes("Audiencia:"));
});

test("los dos horizontes del plan son un mes y un trimestre", () => {
  assert.deepEqual(CAMPAIGN_PLAN_HORIZON_DAYS, { month: 30, quarter: 90 });
});
