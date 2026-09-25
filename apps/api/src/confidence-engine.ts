/**
 * FASE 3 / D11 — El motor de confianza, conectado a datos reales.
 *
 * `assessConfidence` (en `@ecomscaling/contracts`) es puro. Este fichero es su
 * unica parte sucia, como los de `D01` a `D10`.
 *
 * QUE HACE, en una frase: recorre lo que los otros nueve motores han escrito
 * sobre un caso y dice, **capa por capa**, cuanto se puede afirmar de cada cosa
 * y que falta para afirmar mas.
 *
 * POR QUE IMPORTA MAS DE LO QUE PARECE. Hoy un caso puede tener senal, sintoma,
 * ruta causal e impacto medido, y leerse como un diagnostico cerrado. Este
 * motor escribe la confianza de cada capa y conserva el residuo que aun falta.
 *
 * LO QUE NO HACE. No promedia. No hay media ponderada de dimensiones ni de
 * capas, porque la fuente no da formula. La unica derivacion es el techo
 * (`capped_at`), y sale de una regla declarada: **una afirmacion no puede ser
 * mas firme que aquello en lo que se apoya**.
 *
 * SE REESCRIBE ENTERO, NO SE HACE UPSERT. La constraint unica del esquema es
 * (caso, capa, sujeto, **texto del claim**), y `subject_id` va nulo aqui -- en
 * Postgres dos nulos no colisionan, asi que un upsert sobre esa clave insertaria
 * una fila nueva en cada pasada. Y aunque colisionara, cambiar la redaccion del
 * claim ya crearia otra fila. Asi que la lectura de un caso se borra y se vuelve
 * a escribir: es la foto de hoy, y media foto vieja mezclada con media nueva no
 * la sostiene nadie. Lo que cambia de un dia para otro va en
 * `confidence_history`, que todavia no se escribe.
 */
import { createClient } from "@supabase/supabase-js";
import {
  assessConfidence,
  type ConfidenceEngineInput,
  type DataQualityForConfidence,
  type SeverityForConfidence,
  type SignalForConfidence,
  type SymptomForConfidence,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("confidence-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Una pasada de confianza para una organizacion. */
export async function runConfidenceEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const resumen = { cases: 0, claims: 0, uncertainties: 0, unresolved_causes: 0 };

  const { data: casos, error: errorCasos } = await supabase
    .from("diagnostic_cases")
    .select("id, target_metric, target_question, scope, analysis_period_start, analysis_period_end")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);

  if (errorCasos) throw new Error(`diagnostic_cases_load_failed: ${errorCasos.message}`);
  if ((casos ?? []).length === 0) return resumen;

  // D01, una vez por organizacion: es el suelo de todo lo demas.
  const { data: calidad } = await supabase
    .from("data_quality_assessments")
    .select("reliability, coverage")
    .eq("organization_id", organizationId)
    // Antes filtraba por `role` (columna de diagnostic_case_data_quality): la
    // consulta fallaba y D11 decia siempre que D01 no habia evaluado la fuente.
    .eq("source", "shopify")
    .eq("dataset", "orders")
    .order("assessed_at", { ascending: false })
    .limit(1);

  const dataQuality: DataQualityForConfidence | null = calidad?.[0]
    ? {
        reliability: calidad[0].reliability as string,
        coverage: (calidad[0].coverage as string | null) ?? null,
      }
    : null;

  for (const caso of casos ?? []) {
    resumen.cases += 1;

    const { data: senales } = await supabase
      .from("signals")
      .select(
        "id, metric, direction, scope, signal_confidence, data_confidence, low_sample, window_start, window_end",
      )
      .eq("organization_id", organizationId)
      .eq("metric", caso.target_metric as string)
      .lte("window_start", caso.analysis_period_end as string)
      .gte("window_end", caso.analysis_period_start as string)
      .order("window_end", { ascending: false })
      .limit(1);

    const senal = senales?.[0] ?? null;

    // El sintoma que esa senal sostiene, no el que comparta metrica: es el
    // enlace real y evita colgarle a un caso la historia de otro.
    let sintoma: SymptomForConfidence | null = null;
    if (senal) {
      const { data: enlaces } = await supabase
        .from("symptom_signals")
        .select("symptom_id")
        .eq("signal_id", senal.id as string)
        .limit(1);

      const symptomId = enlaces?.[0]?.symptom_id as string | undefined;
      if (symptomId) {
        const { data: fila } = await supabase
          .from("symptoms")
          .select("label, confidence, context_reviewed, compatible_direction, known_relationship")
          .eq("id", symptomId)
          .maybeSingle();
        if (fila) {
          sintoma = {
            label: fila.label as string,
            confidence: fila.confidence as string,
            context_reviewed: Boolean(fila.context_reviewed),
            compatible_direction: Boolean(fila.compatible_direction),
            known_relationship: Boolean(fila.known_relationship),
          };
        }
      }
    }

    const { data: evaluacion } = await supabase
      .from("severity_assessments")
      .select("id, impact_confidence, severity_confidence, measurement_compromised")
      .eq("case_id", caso.id as string)
      .eq("assessment_status", "current")
      .maybeSingle();

    let severity: SeverityForConfidence | null = null;
    if (evaluacion) {
      const { count } = await supabase
        .from("impact_measurements")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", evaluacion.id as string);

      severity = {
        impact_confidence: evaluacion.impact_confidence as string,
        severity_confidence: evaluacion.severity_confidence as string,
        measurement_compromised: Boolean(evaluacion.measurement_compromised),
        has_measurement: (count ?? 0) > 0,
      };
    }

    // D07-D09 son dependencias reales de D11: la confianza causal se calcula
    // sobre la fotografia vigente del caso, no sobre el texto de plantilla.
    const { data: rutas } = await supabase
      .from("causal_paths")
      .select("id, status, path_confidence, confounders_reviewed, measurement_validated")
      .eq("organization_id", organizationId)
      .eq("case_id", caso.id as string);
    const pathIds = (rutas ?? []).map((ruta) => ruta.id as string);
    const { data: evidenciasCausales } = pathIds.length > 0
      ? await supabase
          .from("causal_case_evidence")
          .select("path_id, stance, observation")
          .eq("organization_id", organizationId)
          .in("path_id", pathIds)
      : { data: [] as { path_id: string; stance: string; observation: string }[] };

    const { data: hipotesis } = await supabase
      .from("diagnostic_hypotheses")
      .select("status, confidence, explanatory_coverage, separation")
      .eq("organization_id", organizationId)
      .eq("case_id", caso.id as string)
      .neq("status", "contradicted");

    const { data: causasRaiz } = await supabase
      .from("root_causes")
      .select("status, confidence, statement, explanatory_coverage, residual_material, limitations")
      .eq("organization_id", organizationId)
      .eq("case_id", caso.id as string)
      .not("status", "in", "(resolved,superseded)");

    const { data: constraints } = await supabase
      .from("business_constraints")
      .select("binding_status, confidence, statement, limits_target")
      .eq("organization_id", organizationId)
      .eq("case_id", caso.id as string)
      .eq("status", "active");

    const entrada: ConfidenceEngineInput = {
      caseId: caso.id as string,
      targetMetric: caso.target_metric as string,
      targetQuestion: caso.target_question as string,
      scope: caso.scope as string,
      dataQuality,
      signal: senal
        ? ({
            metric: senal.metric as string,
            direction: senal.direction as string,
            scope: senal.scope as string,
            signal_confidence: senal.signal_confidence as string,
            data_confidence: senal.data_confidence as string,
            low_sample: Boolean(senal.low_sample),
            window_start: senal.window_start as string,
            window_end: senal.window_end as string,
          } satisfies SignalForConfidence)
        : null,
      symptom: sintoma,
      severity,
      causal: {
        paths: (rutas ?? []).map((ruta) => ({
          status: ruta.status as "supported" | "contradicted" | "untested" | "partial",
          path_confidence: ruta.path_confidence as "insufficient_data" | "low" | "medium" | "high",
          confounders_reviewed: Boolean(ruta.confounders_reviewed),
          measurement_validated: Boolean(ruta.measurement_validated),
          evidence: (evidenciasCausales ?? [])
            .filter((evidence) => evidence.path_id === ruta.id)
            .map((evidence) => ({
              stance: evidence.stance as "supporting" | "contradicting" | "inconclusive",
              observation: evidence.observation as string,
            })),
        })),
        hypotheses: (hipotesis ?? []).map((hypothesis) => ({
          status: hypothesis.status as string,
          confidence: hypothesis.confidence as "high" | "medium" | "low" | "insufficient",
          explanatory_coverage: hypothesis.explanatory_coverage as "full" | "partial" | "minimal" | "unknown",
          separation: hypothesis.separation as "high" | "low" | "unknown",
        })),
        rootCauses: (causasRaiz ?? []).map((rootCause) => ({
          status: rootCause.status as string,
          confidence: rootCause.confidence as "high" | "medium" | "low" | "insufficient",
          statement: rootCause.statement as string,
          explanatory_coverage: rootCause.explanatory_coverage as "full" | "partial" | "minimal" | "unknown",
          residual_material: Boolean(rootCause.residual_material),
          limitations: (rootCause.limitations as string | null) ?? null,
        })),
        constraints: (constraints ?? []).map((constraint) => ({
          binding_status: constraint.binding_status as "binding" | "secondary" | "latent" | "none",
          confidence: constraint.confidence as string,
          statement: constraint.statement as string,
          limits_target: Boolean(constraint.limits_target),
        })),
      },
    };

    // D12 corre antes en la cadena nocturna: su ultima revision pone techo.
    const { data: robustez } = await supabase
      .from("diagnostic_robustness")
      .select("survival_status, revision_state")
      .eq("case_id", caso.id as string)
      .eq("review_status", "current")
      .maybeSingle();

    const salida = assessConfidence({
      ...entrada,
      robustness: robustez
        ? {
            survival_status: robustez.survival_status as string,
            revision_state: (robustez.revision_state as string | null) ?? null,
          }
        : null,
    });

    // Fuera la lectura anterior. El `on delete cascade` se lleva con ella sus
    // dimensiones, sus techos y sus incertidumbres, que es justo lo que se
    // quiere: son la misma foto.
    await supabase.from("claim_confidence").delete().eq("case_id", caso.id as string);

    for (const claim of salida.claims) {
      const { data: fila, error } = await supabase
        .from("claim_confidence")
        .insert(
          {
            organization_id: organizationId,
            case_id: caso.id as string,
            claim_layer: claim.claim_layer,
            claim: claim.claim,
            target_question: claim.target_question,
            epistemic_state: claim.epistemic_state,
            confidence_level: claim.confidence_level,
            alternative_separation: claim.alternative_separation,
            contradiction_level: claim.contradiction_level,
            completeness: claim.completeness,
            explanatory_coverage: claim.explanatory_coverage,
            negative_claim_state: claim.negative_claim_state,
            coverage_declared: claim.coverage_declared,
            capped_at: claim.capped_at,
            cap_reason: claim.cap_reason,
            desired_level: claim.desired_level,
            missing_evidence: claim.missing_evidence,
            next_evidence_required: claim.next_evidence_required,
            error_cost: claim.error_cost,
            limitations: claim.limitations,
            assessed_at: new Date().toISOString(),
          },
        )
        .select("id")
        .single();

      if (error || !fila) {
        logger.error("claim_confidence_write_failed", {
          organization_id: organizationId,
          case_id: caso.id,
          layer: claim.claim_layer,
          error: error?.message,
        });
        continue;
      }

      resumen.claims += 1;
      if (["why", "root_cause", "constraint"].includes(claim.claim_layer)) {
        resumen.unresolved_causes += 1;
      }

      if (claim.dimensions.length > 0) {
        const { error: errorDim } = await supabase.from("confidence_dimensions").insert(
          claim.dimensions.map((d) => ({
            organization_id: organizationId,
            claim_id: fila.id as string,
            dimension: d.dimension,
            rating: d.rating,
            reason: d.reason,
          })),
        );
        if (errorDim) {
          logger.error("confidence_dimensions_write_failed", {
            case_id: caso.id,
            layer: claim.claim_layer,
            error: errorDim.message,
          });
        }
      }

      if (claim.caps.length > 0) {
        const { error: errorCap } = await supabase.from("confidence_caps").insert(
          claim.caps.map((c) => ({
            organization_id: organizationId,
            claim_id: fila.id as string,
            cap_source: c.cap_source,
            capped_level: c.capped_level,
            reason: c.reason,
          })),
        );
        if (errorCap) {
          logger.error("confidence_caps_write_failed", {
            case_id: caso.id,
            layer: claim.claim_layer,
            error: errorCap.message,
          });
        }
      }
    }

    // Las incertidumbres se enlazan a la capa que afectan, que el guardrail 33
    // exige para cualquiera marcada como critical unknown.
    const { data: capas } = await supabase
      .from("claim_confidence")
      .select("id, claim_layer")
      .eq("case_id", caso.id as string);

    const idPorCapa = new Map(
      (capas ?? []).map((c) => [c.claim_layer as string, c.id as string]),
    );

    if (salida.uncertainties.length > 0) {
      const { error: errorInc } = await supabase.from("diagnostic_uncertainties").insert(
        salida.uncertainties.map((u) => ({
          organization_id: organizationId,
          case_id: caso.id as string,
          claim_id: u.claim_layer ? (idPorCapa.get(u.claim_layer) ?? null) : null,
          uncertainty_type: u.uncertainty_type,
          description: u.description,
          materiality: u.materiality,
          is_known_unknown: u.is_known_unknown,
          resolvability: u.resolvability,
          required_evidence: u.required_evidence,
        })),
      );
      if (errorInc) {
        logger.error("diagnostic_uncertainties_write_failed", {
          case_id: caso.id,
          error: errorInc.message,
        });
      } else {
        resumen.uncertainties += salida.uncertainties.length;
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron).
 *
 * **El ultimo de la cadena**: lee lo que escribieron D01, D05, D06, D07, D08,
 * D09 y D10. Si corre antes que ellos, califica un caso vacio -- cierto en ese
 * instante, pero inutil.
 */
export async function runConfidenceEngineForAllOrganizations(env: LoadedApiEnv) {
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
    claims: 0,
    unresolved_causes: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runConfidenceEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.claims += result.claims;
      summary.unresolved_causes += result.unresolved_causes;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("confidence_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
