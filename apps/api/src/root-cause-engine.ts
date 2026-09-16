/**
 * FASE 3 / D09 -- El motor de causa raiz y constraint, conectado a datos reales.
 *
 * `generateRootCauses` y `generateConstraintCandidates` (en
 * `@ecomscaling/contracts`) son puros. Este fichero es su unica parte sucia,
 * como los de D01 a D08 y D10-D11.
 *
 * DOS PIPELINES INDEPENDIENTES, COMO EN EL CONTRATO. Causa raiz lee las
 * hipotesis vivas de D08 y su cadena en el grafo de D07. Constraint lee la
 * salud por capacidad de D04. Ninguna referencia a la otra -- el apartado 23
 * exige que las cuatro combinaciones (causa resuelta + constraint activo,
 * constraint resuelto + driver estructural activo, etc.) sean representables, y
 * eso exige que no haya ninguna clave ajena entre ellas.
 *
 * POR QUE CASI TODO SALE `unresolved` O `latent`. No es un techo del motor: es
 * el estado real de los datos que hoy existen. La evidencia de D07-D08 es
 * siempre co-movimiento, y el guardrail 15 prohibe cerrar una causa con eso. La
 * plataforma no mide capacidad ni demanda de ninguna capacidad, y los
 * guardrails 29 y 31 prohiben declarar un cuello vinculante sin las dos. Cuando
 * esos datos existan, el motor cerrara mas; hasta entonces, cerrar mas seria
 * mentir.
 */
import { createClient } from "@supabase/supabase-js";
import {
  generateRootCauses,
  generateConstraintCandidates,
  type ChainNodeInput,
  type ConstraintCandidateInput,
  type ConstraintEngineInput,
  type RootCauseCandidateInput,
  type RootCauseEngineInput,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("root-cause-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * El alcance del caso, igual que en D08. Ver la nota en
 * `hypothesis-engine.ts`: tres bloques le dan tres nombres a lo mismo.
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

/** Una pasada de causa raiz y constraint para una organizacion. */
export async function runRootCauseEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const resumen = {
    cases: 0,
    root_causes: 0,
    partial_root_cause: 0,
    unresolved: 0,
    constraints: 0,
  };

  const { data: casos, error: errorCasos } = await supabase
    .from("diagnostic_cases")
    .select("id, target_metric, scope")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);

  if (errorCasos) throw new Error(`diagnostic_cases_load_failed: ${errorCasos.message}`);
  if ((casos ?? []).length === 0) return resumen;

  const { data: nodos } = await supabase
    .from("causal_nodes")
    .select("id, code, label, capability");
  const { data: aristas } = await supabase
    .from("causal_edges")
    .select("id, from_node_id, to_node_id");

  const nodoPorId = new Map((nodos ?? []).map((n) => [n.id as string, n]));
  const aristaPorId = new Map((aristas ?? []).map((a) => [a.id as string, a]));

  // La vigente de cada capacidad: append-only, ordenada por fecha, primera
  // aparicion gana. Mismo patron que `listConsultantCapabilityHealth`.
  const { data: lecturasSalud } = await supabase
    .from("capability_health")
    .select("capability, health_state, confidence, assessed_at")
    .eq("organization_id", organizationId)
    .order("assessed_at", { ascending: false });

  const saludVigentePorCapacidad = new Map<
    string,
    { health_state: string; confidence: string }
  >();
  for (const fila of lecturasSalud ?? []) {
    const capacidad = fila.capability as string;
    if (saludVigentePorCapacidad.has(capacidad)) continue;
    saludVigentePorCapacidad.set(capacidad, {
      health_state: fila.health_state as string,
      confidence: fila.confidence as string,
    });
  }

  for (const caso of casos ?? []) {
    resumen.cases += 1;
    const { scope, scope_detail } = alcanceDelCaso(caso.scope as string);

    // -----------------------------------------------------------------------
    // Pipeline 1: causa raiz, desde las hipotesis vivas de D08
    // -----------------------------------------------------------------------

    const { data: hipotesis } = await supabase
      .from("diagnostic_hypotheses")
      .select(
        "id, source_path_id, hypothesis_type, relative_role, confidence, explanatory_coverage, limitations, target_node_id, status",
      )
      .eq("case_id", caso.id as string)
      .neq("status", "contradicted");

    const candidatas: RootCauseCandidateInput[] = [];

    for (const h of hipotesis ?? []) {
      const nodoOrigen = h.target_node_id
        ? nodoPorId.get(h.target_node_id as string)
        : undefined;

      let chain: ChainNodeInput[] = [];
      if (h.source_path_id) {
        const { data: pasos } = await supabase
          .from("causal_path_steps")
          .select("edge_id, step_order, case_support")
          .eq("path_id", h.source_path_id as string)
          .order("step_order", { ascending: true });

        chain = (pasos ?? [])
          .map((p) => {
            const arista = aristaPorId.get(p.edge_id as string);
            const origen = arista ? nodoPorId.get(arista.from_node_id as string) : undefined;
            if (!origen) return null;
            return {
              node_id: origen.id as string,
              label: origen.label as string,
              case_support: p.case_support as ChainNodeInput["case_support"],
            };
          })
          .filter((n): n is ChainNodeInput => n != null);
      }

      candidatas.push({
        hypothesis_id: h.id as string,
        source_path_id: (h.source_path_id as string | null) ?? null,
        hypothesis_type: h.hypothesis_type as string,
        relative_role: (h.relative_role as string | null) ?? null,
        confidence: h.confidence as RootCauseCandidateInput["confidence"],
        explanatory_coverage:
          h.explanatory_coverage as RootCauseCandidateInput["explanatory_coverage"],
        capability: (nodoOrigen?.capability as string | null) ?? null,
        limitations: (h.limitations as string | null) ?? null,
        chain,
      });
    }

    if (candidatas.length > 0) {
      const { data: casoCompleto } = await supabase
        .from("diagnostic_cases")
        .select("target_metric")
        .eq("id", caso.id as string)
        .maybeSingle();

      const nodoTarget = [...nodoPorId.values()].find(
        (n) => n.code === (casoCompleto?.target_metric ?? caso.target_metric),
      );

      const entrada: RootCauseEngineInput = {
        targetNodeId: (nodoTarget?.id as string) ?? "",
        targetLabel: (nodoTarget?.label as string) ?? (caso.target_metric as string),
        scope,
        scopeDetail: scope_detail,
        candidates: candidatas,
      };

      const conclusiones = generateRootCauses(entrada);

      // Fuera la lectura anterior. El cascade se lleva la cadena.
      await supabase.from("root_causes").delete().eq("case_id", caso.id as string);

      for (const rc of conclusiones) {
        const { data: fila, error } = await supabase
          .from("root_causes")
          .insert({
            organization_id: organizationId,
            case_id: caso.id as string,
            hypothesis_id: rc.hypothesis_id,
            causal_path_id: rc.causal_path_id,
            code: rc.code,
            statement: rc.statement,
            family: rc.family,
            cause_type: rc.cause_type,
            role: rc.role,
            scope: rc.scope,
            scope_detail: rc.scope_detail,
            status: rc.status,
            confidence: rc.confidence,
            explanatory_coverage: rc.explanatory_coverage,
            residual_material: rc.residual_material,
            residual_note: rc.residual_note,
            controllability: rc.controllability,
            reversibility: rc.reversibility,
            recurrence: "unknown",
            affects_observability_only: rc.affects_observability_only,
            limitations: rc.limitations,
            first_identified_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error || !fila) {
          logger.error("root_cause_write_failed", {
            organization_id: organizationId,
            case_id: caso.id,
            code: rc.code,
            error: error?.message,
          });
          continue;
        }

        resumen.root_causes += 1;
        if (rc.status === "partial_root_cause") resumen.partial_root_cause += 1;
        if (rc.status === "unresolved") resumen.unresolved += 1;

        const { error: errorCadena } = await supabase.from("root_cause_chain").insert(
          rc.chain.map((paso) => ({
            organization_id: organizationId,
            root_cause_id: fila.id as string,
            step_order: paso.step_order,
            chain_role: paso.chain_role,
            statement: paso.statement,
            supported: paso.supported,
            node_id: paso.node_id,
          })),
        );
        if (errorCadena) {
          logger.error("root_cause_chain_write_failed", {
            case_id: caso.id,
            code: rc.code,
            error: errorCadena.message,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Pipeline 2: constraint, desde la salud por capacidad de D04
    // -----------------------------------------------------------------------
    //
    // Independiente del anterior a proposito (apartado 23): no cruza con las
    // hipotesis de arriba.

    const capacidadesRelevantes =
      scope === "capability" && scope_detail.capability
        ? [scope_detail.capability]
        : [...saludVigentePorCapacidad.keys()];

    const candidatasConstraint: ConstraintCandidateInput[] = capacidadesRelevantes
      .map((capacidad) => {
        const salud = saludVigentePorCapacidad.get(capacidad);
        if (!salud || !["bad", "critical"].includes(salud.health_state)) return null;
        return { capability: capacidad, ...salud };
      })
      .filter((c): c is ConstraintCandidateInput => c != null);

    // Se reescribe siempre, incluso a vacio: si la ultima pasada tenia
    // candidatas y esta ya no, dejarlas era mentir sobre el estado actual.
    await supabase.from("business_constraints").delete().eq("case_id", caso.id as string);

    if (candidatasConstraint.length > 0) {
      const entradaK: ConstraintEngineInput = {
        targetMetric: caso.target_metric as string,
        scope,
        scopeDetail: scope_detail,
        candidates: candidatasConstraint,
      };

      const candidatasDraft = generateConstraintCandidates(entradaK);

      for (const k of candidatasDraft) {
        const { data: fila, error } = await supabase
          .from("business_constraints")
          .insert({
            organization_id: organizationId,
            case_id: caso.id as string,
            code: k.code,
            statement: k.statement,
            constraint_type: k.constraint_type,
            target: k.target,
            scope: k.scope,
            scope_detail: k.scope_detail,
            binding_status: k.binding_status,
            nature: k.nature,
            timing: k.timing,
            arrangement: k.arrangement,
            confidence: k.confidence,
            counterfactual_question: k.counterfactual_question,
            limits_target: k.limits_target,
            exposure: k.exposure,
            status: "active",
          })
          .select("id")
          .single();

        if (error || !fila) {
          logger.error("business_constraint_write_failed", {
            organization_id: organizationId,
            case_id: caso.id,
            code: k.code,
            error: error?.message,
          });
          continue;
        }

        resumen.constraints += 1;

        const { error: errorTest } = await supabase.from("constraint_tests").insert({
          organization_id: organizationId,
          constraint_id: fila.id as string,
          target: k.target,
          counterfactual_question: k.counterfactual_question,
          expected_if_binding: k.test.expected_if_binding,
          expected_if_not_binding: k.test.expected_if_not_binding,
          result: "pending",
        });
        if (errorTest) {
          logger.error("constraint_test_write_failed", {
            case_id: caso.id,
            code: k.code,
            error: errorTest.message,
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
 * Va **detras de D04 y D08**: sin salud por capacidad no hay candidatas a
 * cuello, y sin hipotesis no hay candidatas a causa. Y **delante de D11**, que
 * es quien lee si alguna causa quedo en pie.
 */
export async function runRootCauseEngineForAllOrganizations(env: LoadedApiEnv) {
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
    root_causes: 0,
    constraints: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runRootCauseEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.root_causes += result.root_causes;
      summary.constraints += result.constraints;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("root_cause_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
