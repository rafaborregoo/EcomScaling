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
  currentCampaignPlanOutputSchema,
  flattenCampaignPlanActions,
} from "@e-nora/ai";
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

test("las propuestas nuevas requieren fuente y evidencia por iniciativa; permite no proponer sin contexto", () => {
  const currentPlan = {
    ...plan,
    planning_window: {
      start_date: "2026-10-07",
      end_date: "2026-11-05",
      timezone: "Europe/Madrid",
    },
    campaigns: [],
    initiatives: [{
      name: "Preparar temporada",
      objective: "Captar demanda temprana",
      audience: "Clientes de la tienda",
      offer: { status: "none" as const, description: "Sin oferta", evidence: [] },
      start_date: "2026-10-07",
      end_date: "2026-11-05",
      hypothesis: "La guía puede iniciar la preparación.",
      evidence: [{ label: "Informe Shopify", value: "ventas estacionales", period: "2025", source: "shopify" as const }],
      success_metric: "Ingresos de la campaña",
      klaviyo: {
        campaigns: [{
          name: "Guía de temporada",
          objective: "Presentar la guía",
          paths: [{
            name: "Clientes",
            audience: "Clientes activos",
            messages: [{ title: "Guía de preparación", scheduled_date: "2026-10-10", purpose: "Dar ideas", creative_brief: "CTA a la guía; sin oferta confirmada." }],
          }],
        }],
        flows: [],
      },
      meta_campaigns: [],
    }],
  };
  assert.equal(currentCampaignPlanOutputSchema.safeParse(currentPlan).success, true);

  const withoutCampaignEvidence = structuredClone(currentPlan);
  (withoutCampaignEvidence.initiatives[0] as Record<string, any>).evidence = [];
  assert.equal(currentCampaignPlanOutputSchema.safeParse(withoutCampaignEvidence).success, false);

  const withoutPlanSource = { ...currentPlan, sources: [] };
  assert.equal(currentCampaignPlanOutputSchema.safeParse(withoutPlanSource).success, false);

  const noContextPlan = {
    ...currentPlan,
    initiatives: [],
    sources: [],
    warnings: ["No hay evidencia estacional o comercial suficiente."],
  };
  assert.equal(currentCampaignPlanOutputSchema.safeParse(noContextPlan).success, true);
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
  // 5 de septiembre + 3 dias = 8 de septiembre; es una accion de un dia.
  assert.equal(items[0]?.startsAt.slice(0, 10), "2026-09-08");
  assert.equal(items[0]?.endsAt.slice(0, 10), "2026-09-09");

  // Aprobar una semana mas tarde corre TODO el plan esa misma semana.
  const unaSemanaDespues = campaignPlanToCalendarItems(
    campaignPlanOutputSchema.parse(plan),
    aprobadoEl + 7 * 86_400_000,
  );
  assert.equal(unaSemanaDespues[0]?.startsAt.slice(0, 10), "2026-09-15");
  assert.equal(unaSemanaDespues[0]?.endsAt.slice(0, 10), "2026-09-16");
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

test("los horizontes incluyen semanas, mes, trimestre y rango personalizado", () => {
  assert.deepEqual(CAMPAIGN_PLAN_HORIZON_DAYS, {
    week_1: 7,
    week_2: 14,
    week_3: 21,
    month: 30,
    quarter: 90,
    custom: 366,
  });
});

test("una iniciativa aplana mensajes, preparacion de flow y anuncios con jerarquia y fechas propias", () => {
  const canonicalPlan = campaignPlanOutputSchema.parse({
    plan_name: "Preparar invierno",
    diagnosis: "Plan de temporada con oferta pendiente de confirmar.",
    planning_window: {
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      timezone: "Europe/Madrid",
    },
    campaigns: [],
    initiatives: [{
      name: "Preparar Navidad para la tienda de nieve",
      objective: "Activar demanda temprana con margen protegido",
      audience: "Clientes y personas interesadas en nieve",
      offer: { status: "proposal", description: "Valorar una oferta de temporada", evidence: [] },
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      hypothesis: "La preparacion anticipada puede captar compradores de invierno.",
      evidence: [{ label: "Ventas octubre", value: "sin datos concluyentes", period: "2025-10", source: "shopify" }],
      success_metric: "Ingresos y margen por campaña",
      klaviyo: {
        campaigns: [{
          name: "Lanzamiento de temporada",
          objective: "Presentar equipamiento de invierno",
          paths: [{
            name: "Clientes activos",
            audience: "Clientes con actividad reciente",
            messages: [
              { title: "Guia de preparacion", scheduled_date: "2026-10-05", purpose: "Dar ideas de preparacion", creative_brief: "Contenido util sin descuento confirmado." },
              { title: "Selección de equipamiento", scheduled_date: "2026-10-12", scheduled_time: "11:30", purpose: "Mostrar categorias relevantes", creative_brief: "Presentar productos con disponibilidad comprobada." },
            ],
          }],
        }],
        flows: [{
          name: "Bienvenida de invierno",
          trigger: "Suscripcion nueva",
          preparation_date: "2026-10-03",
          audience: "Nuevas personas suscritas",
          steps: [
            { order: 1, title: "Bienvenida", wait_days: 0, purpose: "Orientar", creative_brief: "Guia breve." },
            { order: 2, title: "Inspiracion", wait_days: 3, purpose: "Ayudar a elegir", creative_brief: "Selección por actividad." },
          ],
        }],
      },
      meta_campaigns: [{
        name: "Preparacion de temporada",
        objective: "Ventas",
        start_date: "2026-10-01",
        end_date: "2026-10-31",
        budget_guidance: "Definir tras revisar margen y resultados",
        ad_sets: [{
          name: "Interes en montaña",
          audience: "Personas con interes en actividades de montaña",
          placements: ["Reels", "Stories"],
          ads: [
            { name: "Video de preparacion", format: "video_vertical", scheduled_date: "2026-10-08", scheduled_time: "17:45", purpose: "Mostrar preparación", creative_brief: "Video vertical de equipo y uso real." },
            { name: "Carrusel de capas", format: "carousel", scheduled_date: "2026-10-20", purpose: "Explicar capas", creative_brief: "Carrusel educativo por capas." },
          ],
        }],
      }],
    }],
    sources: [{ kind: "metric", reference: "shopify_sales_monthly", period: "2025-10" }],
    confidence: "medium",
    warnings: [],
  });

  const actions = flattenCampaignPlanActions(canonicalPlan, Date.parse("2026-10-01T00:00:00Z"));
  assert.deepEqual(actions.map((action) => action.action_type), [
    "klaviyo_campaign_message",
    "klaviyo_campaign_message",
    "klaviyo_flow_preparation",
    "meta_ad_creative",
    "meta_ad_creative",
  ]);
  assert.deepEqual(actions.map((action) => action.scheduled_date), [
    "2026-10-05", "2026-10-12", "2026-10-03", "2026-10-08", "2026-10-20",
  ]);
  assert.equal(actions[2]?.title, "Preparar flow: Bienvenida de invierno");
  assert.equal((actions[3]?.hierarchy as { ad_set_name?: string }).ad_set_name, "Interes en montaña");
  assert.equal((actions[3]?.hierarchy as { creative_format?: string }).creative_format, "video_vertical");

  const calendarItems = campaignPlanToCalendarItems(canonicalPlan, Date.parse("2026-10-01T00:00:00Z"), [1, 3]);
  assert.deepEqual(calendarItems.map((item) => item.index), [1, 3]);
  assert.equal(calendarItems[0]?.startsAt, "2026-10-12T09:30:00.000Z");
  assert.equal(calendarItems[1]?.startsAt, "2026-10-08T15:45:00.000Z");
  assert.ok(calendarItems[0]?.description.includes("Oferta (proposal):"));
  assert.ok(calendarItems[1]?.description.includes("Conjunto de anuncios: Interes en montaña"));
});
