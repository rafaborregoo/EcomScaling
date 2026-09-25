/**
 * FASE 3 / D10 — El motor de severidad, conectado a datos reales.
 *
 * `assessSeverity` (en `@e-nora/contracts`) es puro. Este fichero es su
 * unica parte sucia, como los de `D01` a `D06`.
 *
 * LO QUE HACE Y LO QUE NO. No pone ni una severidad: las cinco columnas salen
 * `unknown` y la evaluacion dice por que. El apartado 29 declara que la fuente
 * **no define formula de severidad, ni ponderacion de impacto, ni modelo
 * monetario**, y el guardrail 17 anade que un scope pequeno puede ser material
 * -- o sea que tampoco hay umbral por cuota. "Un 3% del revenue es moderate"
 * seria inventarse el umbral que el documento se niega a dar.
 *
 * Lo que si hace es la **rama de cuantificacion**: cuanto se movio, sobre que
 * base, en que periodo, con que metodo y con que supuestos. Convierte "las
 * ventas netas bajan un 18%" en "-2.400 EUR en la semana, el 3,1% del revenue
 * del periodo". Segun los guardrails 15 a 18, elegir mal esa base es la forma
 * mas comun de exagerar un problema o de quitarle importancia, asi que la base
 * se elige **una** y se razona por escrito.
 *
 * DE DONDE SALEN LOS DENOMINADORES. De `shopify_sales_daily`, la misma funcion
 * SQL que alimenta a `D05` (ADR-0006 punto 6: agregar en SQL, nunca en Node).
 * Reusarla en vez de escribir otra evita lo de siempre: dos funciones que dentro
 * de seis meses dan cifras distintas sobre el mismo periodo.
 *
 * UNA EVALUACION VIGENTE POR CASO. `assessment_status` distingue `current` de
 * `superseded`, y solo se escribe una nueva **cuando la medida cambia**. Volver
 * a escribir la misma cifra cada dia convertiria el historico en ruido y haria
 * imposible ver cuando se movio de verdad.
 */
import { createClient } from "@supabase/supabase-js";
import {
  assessSeverity,
  DEFAULT_SEVERITY_THRESHOLDS,
  severityThresholdsSchema,
  type CaseForSeverity,
  type DenominatorReading,
  type SignalForSeverity,
} from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { type LoadedApiEnv } from "@e-nora/config";

const logger = createLogger("severity-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Supabase = ReturnType<typeof createServiceClient>;

/**
 * Las bases del periodo del caso, medidas.
 *
 * Solo revenue y pedidos: son las dos que `shopify_sales_daily` sabe dar. La
 * contribucion seria la mejor base para casi todo esto --el mismo incidente es
 * un 3% del revenue y un 30% de la contribucion-- y no se puede calcular porque
 * 43 de 44 referencias no tienen coste. El motor lo dice en `limitations` en vez
 * de usar revenue y callarse.
 */
async function leerDenominadores(
  supabase: Supabase,
  organizationId: string,
  storeId: string | null,
  desde: string,
  hasta: string,
): Promise<DenominatorReading[]> {
  const { data, error } = await supabase.rpc("shopify_sales_daily", {
    target_organization_id: organizationId,
    period_start: desde,
    period_end: hasta,
    target_store_id: storeId,
  });

  if (error) {
    logger.error("severity_denominators_failed", {
      organization_id: organizationId,
      error: error.message,
    });
    return [];
  }

  const filas = (data ?? []) as { net_sales: number | string; orders_count: number | string }[];
  const revenue = filas.reduce((total, f) => total + Number(f.net_sales ?? 0), 0);
  const orders = filas.reduce((total, f) => total + Number(f.orders_count ?? 0), 0);

  return [
    { denominator: "revenue", value: revenue },
    { denominator: "orders", value: orders },
  ];
}

/** Una pasada de severidad para una organizacion. */
export async function runSeverityEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const resumen = { cases: 0, assessments: 0, unchanged: 0, without_signal: 0 };

  const { data: casos, error: errorCasos } = await supabase
    .from("diagnostic_cases")
    .select(
      "id, store_id, target_metric, scope, analysis_period_start, analysis_period_end",
    )
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);

  if (errorCasos) throw new Error(`diagnostic_cases_load_failed: ${errorCasos.message}`);
  if ((casos ?? []).length === 0) return resumen;

  // Umbrales de gravedad: los de la tienda si el consultor los cambio, y si no
  // los de por defecto de la cartera (decision 2026-09-24).
  const { data: umbralPropio } = await supabase
    .from("severity_thresholds")
    .select("low, moderate, high, critical")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const propios = umbralPropio ? severityThresholdsSchema.safeParse({
    low: Number(umbralPropio.low),
    moderate: Number(umbralPropio.moderate),
    high: Number(umbralPropio.high),
    critical: Number(umbralPropio.critical),
  }) : null;
  const thresholds = propios?.success
    ? { values: propios.data, source: "organization" as const }
    : { values: DEFAULT_SEVERITY_THRESHOLDS, source: "default" as const };

  // D01, una vez por organizacion. Medir mal no es perder dinero (guardrail 49),
  // pero una resta exacta sobre un dato malo sigue siendo un dato malo.
  const { data: calidad } = await supabase
    .from("data_quality_assessments")
    .select("reliability")
    .eq("organization_id", organizationId)
    // La fuente primaria de los diagnosticos son los pedidos de Shopify. Antes
    // filtraba por `role`, que es columna de diagnostic_case_data_quality y no
    // de esta tabla: la consulta fallaba y D01 no llegaba nunca a D10.
    .eq("source", "shopify")
    .eq("dataset", "orders")
    .order("assessed_at", { ascending: false })
    .limit(1);

  const dataReliability = (calidad?.[0]?.reliability as string | undefined) ?? null;

  for (const caso of casos ?? []) {
    resumen.cases += 1;

    const { data: senales } = await supabase
      .from("signals")
      .select(
        "id, metric, direction, observed_value, baseline_value, magnitude_absolute, trajectory, persistence, business_exposure, window_start, window_end",
      )
      .eq("organization_id", organizationId)
      .eq("metric", caso.target_metric as string)
      .lte("window_start", caso.analysis_period_end as string)
      .gte("window_end", caso.analysis_period_start as string)
      .order("window_end", { ascending: false })
      .limit(1);

    const senal = senales?.[0] ?? null;
    if (!senal) resumen.without_signal += 1;

    // La recurrencia sale del sintoma que esa senal sostiene, no de buscar por
    // metrica: es el enlace real y evita atribuirle a un caso la historia de
    // otro que solo comparte la cifra.
    let recurrencia: { persistence: string; recurrence_count: number } | null = null;
    if (senal) {
      const { data: enlaces } = await supabase
        .from("symptom_signals")
        .select("symptom_id")
        .eq("signal_id", senal.id as string)
        .limit(1);

      const symptomId = enlaces?.[0]?.symptom_id as string | undefined;
      if (symptomId) {
        const { data: sintoma } = await supabase
          .from("symptoms")
          .select("persistence, recurrence_count")
          .eq("id", symptomId)
          .maybeSingle();
        if (sintoma) {
          recurrencia = {
            persistence: sintoma.persistence as string,
            recurrence_count: Number(sintoma.recurrence_count ?? 0),
          };
        }
      }
    }

    const { data: tienda } = caso.store_id
      ? await supabase
          .from("shopify_stores")
          .select("currency_code")
          .eq("id", caso.store_id as string)
          .maybeSingle()
      : { data: null };

    const borrador = assessSeverity({
      diagnosticCase: {
        case_id: caso.id as string,
        target_metric: caso.target_metric as string,
        scope: caso.scope as string,
        analysis_period_start: caso.analysis_period_start as string,
        analysis_period_end: caso.analysis_period_end as string,
      } satisfies CaseForSeverity,
      signal: senal
        ? ({
            metric: senal.metric as string,
            direction: senal.direction as string,
            observed_value: senal.observed_value as number | null,
            baseline_value: senal.baseline_value as number | null,
            magnitude_absolute: senal.magnitude_absolute as number | null,
            trajectory: (senal.trajectory as string | null) ?? null,
            persistence: senal.persistence as string,
            business_exposure: (senal.business_exposure as string | null) ?? null,
            window_start: senal.window_start as string,
            window_end: senal.window_end as string,
          } satisfies SignalForSeverity)
        : null,
      denominators: await leerDenominadores(
        supabase,
        organizationId,
        (caso.store_id as string | null) ?? null,
        caso.analysis_period_start as string,
        caso.analysis_period_end as string,
      ),
      currency: (tienda?.currency_code as string | undefined) ?? "EUR",
      dataReliability,
      symptomRecurrence: recurrencia,
      thresholds,
    });

    // Si la medida no ha cambiado, no se escribe otra fila. El historico sirve
    // para ver cuando se movio algo, y repetir la misma cifra cada dia lo
    // convierte en ruido.
    const { data: vigente } = await supabase
      .from("severity_assessments")
      .select("id, summary, impact_confidence, measurement_compromised, acute_severity, overall_severity")
      .eq("case_id", caso.id as string)
      .eq("assessment_status", "current")
      .maybeSingle();

    if (
      vigente &&
      vigente.summary === borrador.summary &&
      vigente.impact_confidence === borrador.impact_confidence &&
      vigente.measurement_compromised === borrador.measurement_compromised &&
      vigente.acute_severity === borrador.acute_severity &&
      vigente.overall_severity === borrador.overall_severity
    ) {
      resumen.unchanged += 1;
      continue;
    }

    if (vigente) {
      await supabase
        .from("severity_assessments")
        .update({ assessment_status: "superseded" })
        .eq("id", vigente.id as string);
    }

    const { data: fila, error } = await supabase
      .from("severity_assessments")
      .insert({
        organization_id: organizationId,
        case_id: borrador.case_id,
        assessment_status: "current",
        target: borrador.target,
        scope: borrador.scope,
        acute_severity: borrador.acute_severity,
        cumulative_severity: borrador.cumulative_severity,
        forward_risk_severity: borrador.forward_risk_severity,
        structural_severity: borrador.structural_severity,
        overall_severity: borrador.overall_severity,
        cause_confidence: borrador.cause_confidence,
        impact_confidence: borrador.impact_confidence,
        severity_confidence: borrador.severity_confidence,
        trajectory: borrador.trajectory,
        velocity: borrador.velocity,
        recurrence: borrador.recurrence,
        measurement_compromised: borrador.measurement_compromised,
        material_exposure: borrador.material_exposure,
        escalation_signal: borrador.escalation_signal,
        summary: borrador.summary,
        limitations: borrador.limitations,
      })
      .select("id")
      .single();

    if (error || !fila) {
      logger.error("severity_assessment_write_failed", {
        organization_id: organizationId,
        case_id: caso.id,
        error: error?.message,
      });
      continue;
    }
    resumen.assessments += 1;

    if (borrador.measurements.length > 0) {
      const { error: errorMedidas } = await supabase.from("impact_measurements").insert(
        borrador.measurements.map((m) => ({
          organization_id: organizationId,
          assessment_id: fila.id as string,
          ...m,
        })),
      );
      if (errorMedidas) {
        logger.error("impact_measurements_write_failed", {
          organization_id: organizationId,
          case_id: caso.id,
          error: errorMedidas.message,
        });
      }
    }

    if (borrador.exposures.length > 0) {
      const { error: errorExposicion } = await supabase.from("impact_exposures").insert(
        borrador.exposures.map((e) => ({
          organization_id: organizationId,
          assessment_id: fila.id as string,
          ...e,
        })),
      );
      if (errorExposicion) {
        logger.error("impact_exposures_write_failed", {
          organization_id: organizationId,
          case_id: caso.id,
          error: errorExposicion.message,
        });
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron).
 *
 * Va **detras de `D05` y `D06`**: mide el impacto de lo que ellos detectaron. Si
 * corre antes, los casos abiertos no tienen senal en su ventana y la evaluacion
 * sale sin nada que cuantificar -- cierto en ese instante, pero inutil.
 */
export async function runSeverityEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) throw new Error(`organizations_load_failed: ${error.message}`);

  const summary = {
    organizations: 0,
    succeeded: 0,
    failed: 0,
    assessments: 0,
    without_signal: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runSeverityEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += result.assessments;
      summary.without_signal += result.without_signal;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("severity_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
