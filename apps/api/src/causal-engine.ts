/**
 * FASE 3 / D07 -- El motor causal, conectado a datos reales.
 *
 * `exploreCausalPaths` (en `@ecomscaling/contracts`) es puro. Este fichero es su
 * unica parte sucia, como los de D01 a D06, D10 y D11.
 *
 * QUE HACE, en una frase: parte del target de un caso, recorre hacia atras el
 * grafo declarado y deja escritas **todas** las rutas candidatas con lo que las
 * apoya, lo que las contradice y lo que falta por comprobar.
 *
 * POR QUE NO CIERRA NADA. D07 no decide la causa raiz (guardrail 46), no
 * prescribe (47) y no prioriza (48). Produce el terreno sobre el que D08 y D09
 * pueden trabajar, y hoy ninguna ruta llega a `supported`: el guardrail 50 dice
 * que una ruta con huecos declarados no lo esta, y siempre quedan huecos --
 * nadie ha revisado los confusores de D02 contra ninguna ruta.
 *
 * Que eso sea asi **no es un defecto del motor**. Es el estado real de la
 * cadena, y escribirlo es lo que impide que un caso descrito se lea como un caso
 * explicado.
 *
 * SE REESCRIBE ENTERO, NO SE HACE UPSERT. Igual que D11, y por el mismo motivo:
 * la foto de hoy es la foto de hoy. Al borrar las rutas de un caso, el
 * `on delete cascade` se lleva sus pasos y su evidencia, que es justo lo que se
 * quiere.
 */
import { createClient } from "@supabase/supabase-js";
import {
  exploreCausalPaths,
  type CausalEngineInput,
  type CausalGraphEdge,
  type CausalGraphNode,
  type SignalForCausal,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

import { METRICAS_VIGILADAS } from "./signal-engine.js";

const logger = createLogger("causal-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * El grafo visible para una organizacion: el global mas el suyo.
 *
 * El suyo va **despues** a proposito. Una arista de tenant entre los mismos dos
 * nodos y con la misma relacion es una correccion de la global, y ganar la
 * ultima es lo que hace que declarar algo desde la pantalla sirva de algo
 * (apartado 33 y guardrail 44).
 */
async function leerGrafo(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
): Promise<{ nodes: CausalGraphNode[]; edges: CausalGraphEdge[] }> {
  const { data: nodos, error: errorNodos } = await supabase
    .from("causal_nodes")
    .select("id, code, label, observability, measurement_layer, organization_id")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`);

  if (errorNodos) throw new Error(`causal_nodes_load_failed: ${errorNodos.message}`);

  const nodes: CausalGraphNode[] = (nodos ?? []).map((n) => ({
    node_id: n.id as string,
    code: n.code as string,
    label: n.label as string,
    observability: n.observability as CausalGraphNode["observability"],
    measurement_layer: n.measurement_layer as CausalGraphNode["measurement_layer"],
  }));

  const { data: aristas, error: errorAristas } = await supabase
    .from("causal_edges")
    .select(
      "id, from_node_id, to_node_id, relation_type, expected_sign, expected_lag_days, edge_kind, organization_id",
    )
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    // Las globales primero; la del tenant las pisa por clave (origen, destino,
    // relacion), que es la misma con la que el esquema las separa.
    .order("organization_id", { ascending: true, nullsFirst: true });

  if (errorAristas) throw new Error(`causal_edges_load_failed: ${errorAristas.message}`);

  const porClave = new Map<string, CausalGraphEdge>();
  for (const a of aristas ?? []) {
    const clave = `${a.from_node_id}|${a.to_node_id}|${a.relation_type}`;
    porClave.set(clave, {
      edge_id: a.id as string,
      from_node_id: a.from_node_id as string,
      to_node_id: a.to_node_id as string,
      relation_type: a.relation_type as CausalGraphEdge["relation_type"],
      expected_sign: a.expected_sign as CausalGraphEdge["expected_sign"],
      expected_lag_days: (a.expected_lag_days as number | null) ?? null,
      edge_kind: a.edge_kind as CausalGraphEdge["edge_kind"],
    });
  }

  return { nodes, edges: [...porClave.values()] };
}

/** Una pasada causal para una organizacion. */
/**
 * Las metricas de los sintomas que D06 marco como `often_cooccurs` con el del
 * caso. D06 las escribia y nadie las leia; aqui entran como rivales sin
 * modelar, nunca como aristas.
 */
async function leerCoocurrencias(
  supabase: ReturnType<typeof createServiceClient>,
  symptomId: string,
): Promise<string[]> {
  const { data: relaciones, error } = await supabase
    .from("symptom_relations")
    .select("from_symptom_id, to_symptom_id")
    .eq("relation", "often_cooccurs")
    .or(`from_symptom_id.eq.${symptomId},to_symptom_id.eq.${symptomId}`);
  if (error) {
    logger.error("symptom_relations_load_failed", { symptom_id: symptomId, error: error.message });
    return [];
  }
  const otros = [
    ...new Set(
      (relaciones ?? []).map((r) =>
        (r.from_symptom_id as string) === symptomId ? (r.to_symptom_id as string) : (r.from_symptom_id as string),
      ),
    ),
  ];
  if (otros.length === 0) return [];

  const { data: enlaces } = await supabase
    .from("symptom_signals")
    .select("signal_id")
    .in("symptom_id", otros);
  const signalIds = (enlaces ?? []).map((e) => e.signal_id as string);
  if (signalIds.length === 0) return [];

  const { data: senales } = await supabase.from("signals").select("metric").in("id", signalIds);
  return [...new Set((senales ?? []).map((s) => s.metric as string))];
}

export async function runCausalEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const resumen = { cases: 0, paths: 0, contradicted: 0, untested: 0, steps: 0 };

  const { data: casos, error: errorCasos } = await supabase
    .from("diagnostic_cases")
    .select("id, target_metric, scope, analysis_period_start, analysis_period_end")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);

  if (errorCasos) throw new Error(`diagnostic_cases_load_failed: ${errorCasos.message}`);
  if ((casos ?? []).length === 0) return resumen;

  const { nodes, edges } = await leerGrafo(supabase, organizationId);
  if (nodes.length === 0 || edges.length === 0) {
    logger.info("causal_graph_empty", { organization_id: organizationId });
    return resumen;
  }

  for (const caso of casos ?? []) {
    resumen.cases += 1;

    // Todas las senales que solapan la ventana del caso, no solo la del target:
    // el recorrido pregunta por cada padre candidato si se movio.
    const { data: senales } = await supabase
      .from("signals")
      .select("id, metric, direction, scope, window_start, window_end, magnitude_relative")
      .eq("organization_id", organizationId)
      .lte("window_start", caso.analysis_period_end as string)
      .gte("window_end", caso.analysis_period_start as string)
      .order("window_end", { ascending: false });

    // Una por metrica, la mas reciente: el recorrido pregunta "¿se movio?", no
    // "¿cuantas veces?".
    const porMetrica = new Map<string, SignalForCausal>();
    for (const s of senales ?? []) {
      const metric = s.metric as string;
      if (porMetrica.has(metric)) continue;
      porMetrica.set(metric, {
        metric,
        direction: s.direction as SignalForCausal["direction"],
        scope: s.scope as string,
        window_start: s.window_start as string,
        window_end: s.window_end as string,
        magnitude_relative:
          s.magnitude_relative == null ? null : Number(s.magnitude_relative),
      });
    }

    // El sintoma de D06 del que parte el caso, si lo hay: lo pide el esquema
    // para poder volver de una ruta al patron que la origino.
    const senalDelTarget = porMetrica.get(caso.target_metric as string);
    let symptomId: string | null = null;
    if (senalDelTarget) {
      const { data: filaSenal } = await supabase
        .from("signals")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("metric", caso.target_metric as string)
        .eq("window_end", senalDelTarget.window_end)
        .limit(1);
      const signalId = filaSenal?.[0]?.id as string | undefined;
      if (signalId) {
        const { data: enlace } = await supabase
          .from("symptom_signals")
          .select("symptom_id")
          .eq("signal_id", signalId)
          .limit(1);
        symptomId = (enlace?.[0]?.symptom_id as string | undefined) ?? null;
      }
    }

    const cooccurringMetrics = symptomId
      ? await leerCoocurrencias(supabase, symptomId)
      : [];

    const entrada: CausalEngineInput = {
      caseId: caso.id as string,
      cooccurringMetrics,
      symptomId,
      targetCode: caso.target_metric as string,
      targetScope: caso.scope as string,
      nodes,
      edges,
      signals: [...porMetrica.values()],
      measuredMetrics: METRICAS_VIGILADAS,
    };

    const rutas = exploreCausalPaths(entrada);

    // Fuera la lectura anterior; el cascade se lleva pasos y evidencia.
    await supabase.from("causal_paths").delete().eq("case_id", caso.id as string);

    for (const ruta of rutas) {
      const { data: filaRuta, error: errorRuta } = await supabase
        .from("causal_paths")
        .insert({
          organization_id: organizationId,
          case_id: caso.id as string,
          symptom_id: symptomId,
          target_node_id: ruta.target_node_id,
          status: ruta.status,
          path_confidence: ruta.path_confidence,
          missing_evidence: ruta.missing_evidence,
          confounders_reviewed: ruta.confounders_reviewed,
          measurement_validated: ruta.measurement_validated,
          next_evidence: ruta.next_evidence,
        })
        .select("id")
        .single();

      if (errorRuta || !filaRuta) {
        logger.error("causal_path_write_failed", {
          organization_id: organizationId,
          case_id: caso.id,
          error: errorRuta?.message,
        });
        continue;
      }

      resumen.paths += 1;
      if (ruta.status === "contradicted") resumen.contradicted += 1;
      if (ruta.status === "untested") resumen.untested += 1;

      const { data: filasPaso, error: errorPasos } = await supabase
        .from("causal_path_steps")
        .insert(
          ruta.steps.map((paso) => ({
            organization_id: organizationId,
            path_id: filaRuta.id as string,
            edge_id: paso.edge_id,
            step_order: paso.step_order,
            case_support: paso.case_support,
            cause_onset: paso.cause_onset,
            effect_onset: paso.effect_onset,
            observed_lag_days: paso.observed_lag_days,
            temporal_fit: paso.temporal_fit,
            scope_fit: paso.scope_fit,
            magnitude_fit: paso.magnitude_fit,
            cause_role: paso.cause_role,
            contribution_note: paso.contribution_note,
            is_mediator: paso.is_mediator,
          })),
        )
        .select("id, step_order");

      if (errorPasos) {
        logger.error("causal_path_steps_write_failed", {
          case_id: caso.id,
          error: errorPasos.message,
        });
        continue;
      }

      resumen.steps += (filasPaso ?? []).length;

      const idPorOrden = new Map(
        (filasPaso ?? []).map((f) => [f.step_order as number, f.id as string]),
      );

      if (ruta.evidence.length > 0) {
        const { error: errorEvidencia } = await supabase
          .from("causal_case_evidence")
          .insert(
            ruta.evidence.map((e) => ({
              organization_id: organizationId,
              path_id: filaRuta.id as string,
              step_id: idPorOrden.get(e.step_index + 1) ?? null,
              evidence_level: e.evidence_level,
              stance: e.stance,
              observation: e.observation,
            })),
          );
        if (errorEvidencia) {
          logger.error("causal_case_evidence_write_failed", {
            case_id: caso.id,
            error: errorEvidencia.message,
          });
        }
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron).
 *
 * Va **detras de D05 y D06**: sin senales no hay nada que recorrer, y sin
 * sintoma la ruta no sabe de que patron nacio. Y **delante de D11**, que es
 * quien lee si alguna causa quedo en pie.
 */
export async function runCausalEngineForAllOrganizations(env: LoadedApiEnv) {
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
    paths: 0,
    contradicted: 0,
    untested: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runCausalEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.paths += result.paths;
      summary.contradicted += result.contradicted;
      summary.untested += result.untested;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("causal_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
