/**
 * FASE 3 / D08 -- El motor de hipotesis, conectado a datos reales.
 *
 * `generateHypotheses` (en `@e-nora/contracts`) es puro. Este fichero es su
 * unica parte sucia, como los de D01 a D07, D10 y D11.
 *
 * QUE HACE, en una frase: convierte cada ruta candidata de D07 en una hipotesis
 * **explicita**, con su estado, lo que la falsaria y el siguiente dato que la
 * despejaria.
 *
 * LO QUE APORTA QUE NO APORTABA D07. Dos cosas. La primera: **las descartadas se
 * guardan con su motivo**, asi que dentro de un mes nadie vuelve a mirar los
 * pedidos porque se le olvido que ya se habian mirado. La segunda: **se escribe
 * sola la hipotesis de que no haya pasado nada** cuando alguna ruta pasa por una
 * metrica de tracking. Esa explicacion no sale de ninguna ruta causal --no la
 * hay-- y es la unica que puede tumbar a todas las demas de golpe.
 *
 * LO QUE NO HACE. No elige. El guardrail 1 dice que la primera causa plausible
 * no es un diagnostico y el 12 que el challenger vive mientras haya
 * incertidumbre material; un motor que devolviera "la explicacion es X" rompe
 * los dos. Ninguna hipotesis sale afirmada, y ninguna es candidata a raiz: eso
 * es D09.
 *
 * SE REESCRIBE ENTERO. Igual que D07 y D11. Al borrar las hipotesis de un caso,
 * el `on delete cascade` se lleva sus tests, su historial y sus enlaces a
 * evidencia.
 */
import { createClient } from "@supabase/supabase-js";
import {
  generateHypotheses,
  type HypothesisEngineInput,
  type PathForHypothesis,
} from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { type LoadedApiEnv } from "@e-nora/config";

import { METRICAS_VIGILADAS } from "./signal-engine.js";

const logger = createLogger("hypothesis-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * El alcance del caso, traducido al vocabulario del grafo.
 *
 * Tres bloques le dan tres nombres a lo mismo: `D00` lo llama
 * `business_global`, `D07` lo llama `business` y las senales de `D05` lo llaman
 * `global`. No es una incoherencia que merezca una migracion --cada esquema es
 * coherente consigo mismo-- pero si hay que traducir al cruzarlos, y hacerlo en
 * un sitio con nombre es mejor que descubrirlo en un check tres veces.
 *
 * Lo demas (`acquisition`, `conversion`...) **son capacidades**, y el check
 * `diagnostic_hypotheses_localizada` exige entonces decir cual: una hipotesis
 * que no es del negocio entero tiene que decir de donde es.
 */
function alcanceDelCaso(scopeDelCaso: string): {
  scope: string;
  scope_detail: Record<string, string>;
} {
  if (scopeDelCaso === "business_global" || scopeDelCaso === "global") {
    return { scope: "business", scope_detail: {} };
  }
  return { scope: "capability", scope_detail: { capability: scopeDelCaso } };
}

/** Una pasada de hipotesis para una organizacion. */
export async function runHypothesisEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const resumen = { cases: 0, hypotheses: 0, rejected: 0, tests: 0, challengers: 0 };

  const { data: casos, error: errorCasos } = await supabase
    .from("diagnostic_cases")
    .select("id, target_metric, scope")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);

  if (errorCasos) throw new Error(`diagnostic_cases_load_failed: ${errorCasos.message}`);
  if ((casos ?? []).length === 0) return resumen;

  const { data: nodos } = await supabase
    .from("causal_nodes")
    .select("id, code, label, capability, measurement_layer");

  const { data: aristas } = await supabase
    .from("causal_edges")
    .select("id, from_node_id, to_node_id, relation_type, evidence_level");

  const nodoPorId = new Map((nodos ?? []).map((n) => [n.id as string, n]));
  const aristaPorId = new Map((aristas ?? []).map((a) => [a.id as string, a]));
  const vigiladas = new Set(METRICAS_VIGILADAS);

  for (const caso of casos ?? []) {
    resumen.cases += 1;

    const { data: rutas } = await supabase
      .from("causal_paths")
      .select("id, target_node_id, status, missing_evidence, next_evidence")
      .eq("case_id", caso.id as string);

    if ((rutas ?? []).length === 0) continue;

    const rutaIds = (rutas ?? []).map((r) => r.id as string);

    const { data: pasos } = await supabase
      .from("causal_path_steps")
      .select("id, path_id, edge_id, step_order, temporal_fit, scope_fit, magnitude_fit")
      .in("path_id", rutaIds)
      .order("step_order", { ascending: true });

    const { data: evidencia } = await supabase
      .from("causal_case_evidence")
      .select("path_id, stance, observation")
      .in("path_id", rutaIds);

    const aplanadas: PathForHypothesis[] = [];

    for (const ruta of rutas ?? []) {
      const sus = (pasos ?? []).filter((p) => p.path_id === ruta.id);
      // El paso 1 es el mas rio arriba: es de el de quien habla la hipotesis.
      const primero = sus[0];
      if (!primero) continue;

      const aristaOrigen = aristaPorId.get(primero.edge_id as string);
      const nodoOrigen = aristaOrigen
        ? nodoPorId.get(aristaOrigen.from_node_id as string)
        : undefined;
      const nodoTarget = nodoPorId.get(ruta.target_node_id as string);
      if (!aristaOrigen || !nodoOrigen) continue;

      aplanadas.push({
        path_id: ruta.id as string,
        target_node_id: ruta.target_node_id as string,
        target_label: (nodoTarget?.label as string) ?? (caso.target_metric as string),
        status: ruta.status as PathForHypothesis["status"],
        missing_evidence: (ruta.missing_evidence as string[] | null) ?? [],
        next_evidence: (ruta.next_evidence as string | null) ?? null,
        origin_node_id: nodoOrigen.id as string,
        origin_code: nodoOrigen.code as string,
        origin_label: nodoOrigen.label as string,
        origin_measured: vigiladas.has(nodoOrigen.code as string),
        origin_is_observed_metric: nodoOrigen.measurement_layer === "observed_metric",
        capability: (nodoOrigen.capability as string | null) ?? null,
        // Los destinos de todos los pasos menos el ultimo: lo que hay entre el
        // origen y el target. Sin ellos la frase aplana la cadena y miente.
        mediator_labels: sus
          .slice(0, -1)
          .map((p) => {
            const arista = aristaPorId.get(p.edge_id as string);
            return arista
              ? ((nodoPorId.get(arista.to_node_id as string)?.label as string) ?? null)
              : null;
          })
          .filter((l): l is string => l != null),
        temporal_fit: primero.temporal_fit as string,
        scope_fit: primero.scope_fit as string,
        magnitude_fit: primero.magnitude_fit as string,
        relation_type: aristaOrigen.relation_type as string,
        edge_evidence_level: aristaOrigen.evidence_level as string,
        all_mathematical: sus.every(
          (p) => aristaPorId.get(p.edge_id as string)?.relation_type === "mathematical",
        ),
        evidence: (evidencia ?? [])
          .filter((e) => e.path_id === ruta.id)
          .map((e) => ({ stance: e.stance as string, observation: e.observation as string })),
      });
    }

    if (aplanadas.length === 0) continue;

    const entrada: HypothesisEngineInput = {
      caseId: caso.id as string,
      targetMetric: caso.target_metric as string,
      scope: caso.scope as string,
      paths: aplanadas,
    };

    const hipotesis = generateHypotheses(entrada);

    // Fuera la lectura anterior. El cascade se lleva tests, historial y enlaces.
    await supabase.from("diagnostic_hypotheses").delete().eq("case_id", caso.id as string);
    await supabase.from("diagnostic_evidence").delete().eq("case_id", caso.id as string);

    for (const h of hipotesis) {
      const { data: fila, error } = await supabase
        .from("diagnostic_hypotheses")
        .insert({
          organization_id: organizationId,
          case_id: caso.id as string,
          code: h.code,
          statement: h.statement,
          hypothesis_type: h.hypothesis_type,
          source_path_id: h.source_path_id,
          target_node_id: h.target_node_id,
          family: h.family,
          ...alcanceDelCaso(caso.scope as string),
          status: h.status,
          rejection_reason: h.rejection_reason,
          confidence: h.confidence,
          prior_plausibility: h.prior_plausibility,
          explanatory_coverage: h.explanatory_coverage,
          unexplained_residual_material: h.unexplained_residual_material,
          residual_note: h.residual_note,
          root_cause_candidate: h.root_cause_candidate,
          relative_role: h.relative_role,
          separation: h.separation,
          uncertainty_kinds: h.uncertainty_kinds,
          temporal_fit: h.temporal_fit,
          scope_fit: h.scope_fit,
          magnitude_fit: h.magnitude_fit,
          mechanism_fit: h.mechanism_fit,
          falsification_condition: h.falsification_condition,
          limitations: h.limitations,
          evidence_reviewed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !fila) {
        logger.error("hypothesis_write_failed", {
          organization_id: organizationId,
          case_id: caso.id,
          code: h.code,
          error: error?.message,
        });
        continue;
      }

      resumen.hypotheses += 1;
      if (h.status === "contradicted") resumen.rejected += 1;
      if (h.relative_role === "challenger") resumen.challengers += 1;

      for (const [i, e] of h.evidence.entries()) {
        const { data: filaEvidencia, error: errorEv } = await supabase
          .from("diagnostic_evidence")
          .insert({
            case_id: caso.id as string,
            code: `${h.code}-E${i + 1}`,
            source: e.source_system,
            source_system: e.source_system,
            metric: caso.target_metric as string,
            observation: e.observation,
            observation_kind: e.observation_kind,
            directness: e.directness,
            specificity: e.specificity,
            freshness: e.freshness,
            // Guardrail 21: dos lecturas del mismo sitio no son dos fuentes, y
            // aqui todo sale de la misma. Marcarlo independiente exigiria decir
            // por que, y no habria por que que decir.
            independent: false,
            observed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (errorEv || !filaEvidencia) {
          logger.error("diagnostic_evidence_write_failed", {
            case_id: caso.id,
            code: h.code,
            error: errorEv?.message,
          });
          continue;
        }

        const { error: errorEnlace } = await supabase
          .from("diagnostic_hypothesis_evidence")
          .insert({
            hypothesis_id: fila.id as string,
            evidence_id: filaEvidencia.id as string,
            relation: e.relation,
          });
        if (errorEnlace) {
          logger.error("hypothesis_evidence_link_failed", {
            case_id: caso.id,
            error: errorEnlace.message,
          });
        }
      }

      if (h.test) {
        const { error: errorTest } = await supabase.from("hypothesis_tests").insert({
          organization_id: organizationId,
          hypothesis_id: fila.id as string,
          diagnostic_question: h.test.diagnostic_question,
          required_data: h.test.required_data,
          expected_if_true: h.test.expected_if_true,
          expected_if_false: h.test.expected_if_false,
          information_gain: h.test.information_gain,
          cost: h.test.cost,
          latency: h.test.latency,
          availability: h.test.availability,
          intrusiveness: h.test.intrusiveness,
          mode: h.test.mode,
          status: "proposed",
        });
        if (errorTest) {
          logger.error("hypothesis_test_write_failed", {
            case_id: caso.id,
            code: h.code,
            error: errorTest.message,
          });
        } else {
          resumen.tests += 1;
        }
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron).
 *
 * Va **detras de D07**: sin rutas que traducir no hay hipotesis que escribir. Y
 * delante de D09, que es quien decide si alguna de estas llega a causa raiz.
 */
export async function runHypothesisEngineForAllOrganizations(env: LoadedApiEnv) {
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
    hypotheses: 0,
    rejected: 0,
    tests: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runHypothesisEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.hypotheses += result.hypotheses;
      summary.rejected += result.rejected;
      summary.tests += result.tests;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("hypothesis_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
