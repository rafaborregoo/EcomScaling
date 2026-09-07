/**
 * A19 (arquitecto del camino): las dos piezas que deciden si un plan generado
 * por IA nace usable o nace roto.
 *
 *  1. El contrato. Un camino sin `target_offset_days` o sin `success_metric`
 *     es una lista de deseos: el schema tiene que rechazarlo en vez de crear
 *     hitos sin fecha que nadie sabe cuando estan cumplidos.
 *  2. La conversion a plan. El offset se ancla en el momento de ACEPTAR, no en
 *     el de generar. Si alguien lo cambia al `generated_at` del output, un
 *     camino aceptado una semana despues nace con todos los hitos corridos y
 *     el primero ya vencido, sin ningun error visible.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { caminoPlanOutputSchema, CAMINO_HORIZON_MONTHS } from "@ecomscaling/ai";
import { caminoProposalToPlanInput } from "./strategic-plans.js";

const proposal = {
  plan_name: "Recuperar margen y estabilizar surtido",
  diagnosis: "Margen bruto del 18% en 90 dias con 42 productos sin coste.",
  phases: [
    {
      name: "Recuperar margen",
      description: "Cargar costes y cortar el sangrado.",
      rationale: "Sin coste real no se puede decidir nada de precio.",
      evidence: [
        {
          label: "Margen bruto",
          value: "18%",
          period: "ultimos 90 dias",
          source: "shopify" as const,
        },
      ],
      milestones: [
        {
          name: "Cargar coste del top 80% de facturacion",
          description: "Subir el coste unitario de los 20 productos que mas venden.",
          target_offset_days: 14,
          success_metric: "Menos de 5 productos sin coste en el top 80%.",
        },
      ],
    },
    {
      name: "Escalar adquisicion",
      description: "Subir inversion solo donde el margen aguanta.",
      rationale: "Escalar antes de arreglar el margen multiplica la perdida.",
      evidence: [],
      milestones: [
        {
          name: "Duplicar presupuesto en los conjuntos rentables",
          description: "Solo los que superen el ROAS objetivo dos semanas seguidas.",
          target_offset_days: 75,
          success_metric: "ROAS por encima de 2.5x con el doble de gasto.",
        },
      ],
    },
  ],
  sources: [
    { kind: "metric" as const, reference: "shopify_sales_summary", period: "90d" },
  ],
  confidence: "medium" as const,
  warnings: ["Klaviyo no esta conectado: el plan no cubre email."],
};

test("el contrato del camino exige fecha y criterio de exito en cada hito", () => {
  assert.ok(caminoPlanOutputSchema.safeParse(proposal).success);

  const sinFecha = structuredClone(proposal) as Record<string, any>;
  delete sinFecha.phases[0].milestones[0].target_offset_days;
  assert.equal(
    caminoPlanOutputSchema.safeParse(sinFecha).success,
    false,
    "un hito sin fecha objetivo no es un hito",
  );

  const sinCriterio = structuredClone(proposal) as Record<string, any>;
  delete sinCriterio.phases[0].milestones[0].success_metric;
  assert.equal(
    caminoPlanOutputSchema.safeParse(sinCriterio).success,
    false,
    "un hito sin criterio de exito se marcaria completado a ojo",
  );

  const fechaHaciaAtras = structuredClone(proposal) as Record<string, any>;
  fechaHaciaAtras.phases[0].milestones[0].target_offset_days = 0;
  assert.equal(
    caminoPlanOutputSchema.safeParse(fechaHaciaAtras).success,
    false,
    "un hito no puede vencer hoy mismo ni antes",
  );
});

test("la fecha del hito se ancla al momento de aceptar, no al de generar", () => {
  const aceptadoEl = Date.parse("2026-09-05T10:00:00.000Z");
  const plan = caminoProposalToPlanInput(
    caminoPlanOutputSchema.parse(proposal),
    aceptadoEl,
  );

  assert.equal(plan.name, proposal.plan_name);
  assert.equal(plan.phases?.length, 2);

  // 5 de septiembre + 14 dias = 19 de septiembre.
  assert.equal(plan.phases?.[0]?.milestones?.[0]?.targetDate, "2026-09-19");
  // + 75 dias = 19 de noviembre.
  assert.equal(plan.phases?.[1]?.milestones?.[0]?.targetDate, "2026-11-19");

  // Aceptar una semana mas tarde corre las fechas esa misma semana: el plan no
  // nace con el primer hito ya vencido.
  const unaSemanaDespues = caminoProposalToPlanInput(
    caminoPlanOutputSchema.parse(proposal),
    aceptadoEl + 7 * 86_400_000,
  );
  assert.equal(
    unaSemanaDespues.phases?.[0]?.milestones?.[0]?.targetDate,
    "2026-09-26",
  );
});

test("el criterio de exito sobrevive al plan: no hay columna propia para el", () => {
  const plan = caminoProposalToPlanInput(
    caminoPlanOutputSchema.parse(proposal),
    Date.now(),
  );
  const description = plan.phases?.[0]?.milestones?.[0]?.description ?? "";

  assert.ok(description.includes("Criterio de exito:"));
  assert.ok(
    description.includes("Menos de 5 productos sin coste en el top 80%."),
    "si se pierde, el hito se marca completado a ojo",
  );
});

test("los cuatro horizontes del camino cubren de un mes a un ano", () => {
  assert.deepEqual(CAMINO_HORIZON_MONTHS, {
    month: 1,
    quarter: 3,
    half_year: 6,
    year: 12,
  });
});
