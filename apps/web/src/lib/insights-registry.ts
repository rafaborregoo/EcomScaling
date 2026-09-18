// Del modulo suelto, no del barril `@/components/ui`: asi este fichero no
// arrastra React ni HeroUI y se puede probar con `node --test`.
import {
  insightBadgeCount,
  type MetricInsight,
} from "../components/ui/metric-insights-task";

/**
 * Donde vive cada cifra que la IA puede comentar. Es la unica lista: la card
 * dibuja su icono desde aqui y la zona del nav enumera lo mismo, asi que no
 * pueden discrepar.
 *
 * El `id` es tambien el ancla de la URL: quien navegue a `#insight-<id>` cae
 * en el sitio exacto y el campo parpadea (`:target` en globals.css). Por eso
 * el id no se renombra a la ligera -- un enlace guardado dejaria de anclar.
 */
export type InsightSpot = {
  id: string;
  /** Las dos o tres palabras que se leen en el nav. Nada mas. */
  label: string;
  /** Donde esta el dato. El `?tab=` lo entiende la propia pantalla. */
  href: string;
  /** Contexto para el nav: de que pantalla viene ("Dashboard · Meta Ads"). */
  location: string;
  /** Quien ve esa pantalla; el nav no ensena lo que el usuario no puede abrir. */
  audience: "consultant" | "client" | "both";
  /**
   * De que tienda habla. `null` = de toda la organizacion. Es el mismo criterio
   * que `agent_runs.store_id`, que ya guarda con que tienda se genero cada
   * ejecucion: un hallazgo NO es de la aplicacion, es de una tienda concreta.
   */
  storeId: string | null;
  insights: MetricInsight[];
};

/**
 * Que esta mirando el usuario ahora mismo. Sin esto, el mismo hallazgo salia
 * en el ROAS de todas las tiendas -- que es justo lo contrario de lo que dice
 * el dato.
 */
export type InsightScope = {
  organizationId: string;
  /** Tienda activa del selector del header. "" = "Todas las tiendas". */
  connectionId: string;
  isConsultant: boolean;
};

export type PlaybookInsightAssessment = {
  domain: string;
  disposition: string;
  unresolved_unknowns?: string[];
  reason_codes?: string[];
};

const PLAYBOOK_INSIGHT_META: Record<string, { slug: string; label: string; location: string }> = {
  ACQUISITION: { slug: "acquisition", label: "Adquisición", location: "Diagnóstico · F5.01" },
  PAID_MEDIA: { slug: "paid-media", label: "Paid media", location: "Diagnóstico · F5.02" },
  CONVERSION: { slug: "conversion", label: "Conversión / CRO", location: "Diagnóstico · F5.03" },
  OFFER_PRICING: { slug: "offer-pricing", label: "Oferta / pricing", location: "Diagnóstico · F5.04" },
  RETENTION_CRM: { slug: "retention-crm", label: "Retención / CRM", location: "Diagnóstico · F5.05" },
  UNIT_ECONOMICS: { slug: "unit-economics", label: "Unit economics", location: "Diagnóstico · F5.06" },
  PRODUCT_INVENTORY: { slug: "product-inventory", label: "Producto / stock", location: "Diagnóstico · F5.07" },
  OPERATIONS_CX: { slug: "operations-cx", label: "Operaciones / CX", location: "Diagnóstico · F5.08" },
  MEASUREMENT_EXPERIMENTATION: { slug: "measurement-experimentation", label: "Datos / experimentación", location: "Diagnóstico · F5.09" },
  SCALABILITY: { slug: "scalability", label: "Escalabilidad / constraints", location: "Diagnóstico · F5.10" },
  RECOVERY_CRISIS: { slug: "recovery-crisis", label: "Recovery / crisis", location: "Diagnóstico · F5.11" },
  BENCHMARKS_GUARDRAILS: { slug: "benchmark-guardrails", label: "Benchmarks / guardrails", location: "Diagnóstico · F6.00" },
  COHORT_CONTEXT: { slug: "cohort-context", label: "Contexto / cohortes", location: "Diagnóstico · F6.01" },
  DATA_QUALITY_RELIABILITY: { slug: "data-quality-reliability", label: "Calidad / fiabilidad", location: "Diagnóstico · F6.02" },
  ACQUISITION_DEMAND: { slug: "acquisition-demand", label: "Adquisición / demanda", location: "Diagnóstico · F6.03" },
  PAID_MEDIA_BENCHMARKS: { slug: "paid-media-benchmarks", label: "Paid Media / benchmarks", location: "Diagnóstico · F6.04" },
  CONVERSION_CRO_BENCHMARKS: { slug: "conversion-cro-benchmarks", label: "Conversión / CRO benchmarks", location: "Diagnóstico · F6.05" },
  OFFER_PRICING_BENCHMARKS: { slug: "offer-pricing-benchmarks", label: "Oferta / pricing benchmarks", location: "Diagnóstico · F6.06" },
  RETENTION_CRM_BENCHMARKS: { slug: "retention-crm-benchmarks", label: "Retención / CRM benchmarks", location: "Diagnóstico · F6.07" },
  UNIT_ECONOMICS_BENCHMARKS: { slug: "unit-economics-benchmarks", label: "Unit economics benchmarks", location: "Diagnóstico · F6.08" },
  OPERATIONS_CX_BENCHMARKS: { slug: "operations-cx-benchmarks", label: "Operaciones / CX benchmarks", location: "Diagnóstico · F6.09" },
  PRODUCT_INVENTORY_BENCHMARKS: { slug: "product-inventory-benchmarks", label: "Inventario / salud comercial", location: "Diagnóstico · F6.10" },
  SCALABILITY_BENCHMARKS: { slug: "scalability-benchmarks", label: "Escalabilidad / límites", location: "Diagnóstico · F6.11" },
  ANOMALIES_RED_FLAGS: { slug: "anomalies-red-flags", label: "Anomalías / red flags", location: "Diagnóstico · F6.12" },
  BENCHMARK_CONFIDENCE: { slug: "benchmark-confidence", label: "Confianza / incertidumbre", location: "Diagnóstico · F6.13" },
};

function playbookInsightSeverity(disposition: string): MetricInsight["severity"] {
  return disposition === "BLOCKED" || disposition === "REASSESS_DIAGNOSIS" ? "high" : "medium";
}

export function insightSpotsFromPlaybookAssessments(
  scope: InsightScope,
  assessments: PlaybookInsightAssessment[],
): InsightSpot[] {
  if (!scope.organizationId || !scope.isConsultant) return [];
  return assessments.flatMap((assessment) => {
    const meta = PLAYBOOK_INSIGHT_META[assessment.domain];
    if (!meta || !["BLOCKED", "VALIDATION_REQUIRED", "REASSESS_DIAGNOSIS", "REPRIORITIZE"].includes(assessment.disposition)) return [];
    const unknowns = assessment.unresolved_unknowns ?? [];
    const reasons = assessment.reason_codes ?? [];
    const pending = [...unknowns, ...reasons].filter(Boolean);
    return [{
      id: `playbook-${meta.slug}`,
      label: meta.label,
      href: `/shopify/diagnostico#insight-${meta.slug}`,
      location: meta.location,
      audience: "consultant" as const,
      storeId: null,
      insights: [{
        id: `playbook-${meta.slug}-${assessment.disposition.toLowerCase()}`,
        title: `${meta.label}: ${assessment.disposition}`,
        severity: playbookInsightSeverity(assessment.disposition),
        evidence: pending.length ? `Pendiente: ${pending.join(", ")}.` : "La evaluación requiere revisión antes de recomendar una intervención.",
        steps: ["Abrir la card del diagnóstico y validar la evidencia pendiente."],
      }],
    }];
  });
}

export function insightAnchorId(spotId: string) {
  return `insight-${spotId}`;
}

// MAQUETA (sin IA todavia): asi se veria cuando el agente de Meta devuelva sus
// hallazgos para ESTA tienda. Cuando se conecte, esta funcion se sustituye por
// la lectura de las salidas de agente ya filtradas por organizacion y tienda
// -- la forma de vuelta es la misma, por eso las pantallas no cambiaran.
function demoSpots(scope: InsightScope): InsightSpot[] {
  // Sin tienda concreta no hay de que hablar: el ROAS de "todas las tiendas"
  // es una suma, no algo sobre lo que un agente pueda recomendar nada.
  if (!scope.connectionId) return [];
  return [
    {
      id: "roas",
      label: "ROAS",
      href: "/dashboard?tab=meta#insight-roas",
      location: "Dashboard · Meta Ads",
      audience: "consultant",
      storeId: scope.connectionId,
      insights: [
        {
          id: "roas-bajo-break-even",
          title: "El ROAS lleva 9 días por debajo del break-even",
          severity: "high",
          evidence:
            "1,84x de media en los últimos 9 días contra un break-even de 2,30x. Cada euro invertido está perdiendo 0,20 €.",
          steps: [
            "Pausar los 3 conjuntos con ROAS < 1,5x y más de 200 € gastados",
            "Mover ese presupuesto al conjunto de retargeting (3,10x)",
          ],
          needsTask: true,
        },
        {
          id: "roas-margen-desactualizado",
          title: "El break-even se calcula con costes de hace 4 meses",
          severity: "medium",
          evidence:
            "El coste de producto no se actualiza desde mayo. Si ha subido, el break-even real es mayor y el ROAS de arriba se está juzgando contra un listón equivocado.",
          steps: ["Revisar coste por producto en Ajustes > Finanzas"],
          needsTask: true,
        },
        {
          id: "roas-ventana-atribucion",
          title: "Meta atribuye con ventana de 7 días",
          severity: "info",
          evidence:
            "Este ROAS es atribuido por Meta, no ventas reales de Shopify. La diferencia con el panel de Shopify es esperable.",
          steps: [
            "Contrastar con ingresos netos antes de decidir por esta cifra",
          ],
        },
      ],
    },
  ];
}

/** Lo que la IA tiene que decir sobre lo que el usuario esta mirando. */
export function insightSpotsFor(scope: InsightScope): InsightSpot[] {
  // Consultor en vista general (sin cliente elegido): no hay tienda de la que
  // hablar, y el badge del nav no debe sumar hallazgos de toda la cartera.
  if (!scope.organizationId) return [];

  return demoSpots(scope).filter((spot) => {
    if (spot.audience !== "both") {
      const forConsultant = spot.audience === "consultant";
      if (forConsultant !== scope.isConsultant) return false;
    }
    // Un hallazgo de otra tienda no se ensena aqui. Los de organizacion
    // (`storeId: null`) valen siempre, tambien con "Todas las tiendas".
    return spot.storeId === null || spot.storeId === scope.connectionId;
  });
}

export function insightSpotFor(scope: InsightScope, spotId: string) {
  return insightSpotsFor(scope).find((spot) => spot.id === spotId);
}

/** Lo que va en el contador del nav: la suma de lo que pide algo. */
export function totalInsightCount(spots: InsightSpot[]) {
  return spots.reduce(
    (total, spot) => total + insightBadgeCount(spot.insights),
    0,
  );
}
