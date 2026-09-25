/**
 * FASE 3 / D04 — El motor de salud, conectado a datos reales.
 *
 * `assessHealth` (en `@e-nora/contracts`) es puro. Este fichero es su unica
 * parte sucia, como los de `D01`, `D02`, `D03`, `D05` y `D06`.
 *
 * QUE CIERRA. El paso 29 del runtime de D05 dejo el lazo
 * `METRICS -> SIGNALS -> HEALTH` abierto: las senales no escribian en ningun
 * sitio que dijera como esta cada capacidad. Esto lo cierra.
 *
 * LO QUE APORTA, en una frase: `D03` dice de que es capaz el negocio y `D05` que
 * se ha movido; esto dice **como esta cada capacidad hoy** -- y, cuando no se
 * puede saber, exactamente que falta declarar para poder saberlo.
 *
 * LA DECISION DEL BLOQUE, y conviene leerla antes de tocar nada: **el motor no
 * tiene un solo umbral propio**. El guardrail 11 prohibe clasificar CAC, CVR o
 * refund rate por umbral global; el 13 prohibe depender de benchmarks externos;
 * el 39 dice que un CAC alto puede ser sano si cabe en la economia y el 40 que
 * uno bajo puede ser critico si destruye contribucion. Contra que se juzga cada
 * metrica lo declara el tenant en `health_references`, y `D05` ya evaluo las
 * senales contra esa misma referencia en `guardrail_status`. Aqui solo se
 * traduce.
 *
 * POR ESO HOY TODO SALE `not_assessable`. `health_references` esta vacia en test
 * y en produccion. **Ese es el resultado correcto, no un fallo**: cada fila dice
 * que declaracion falta para que esa capacidad se pueda juzgar, que es
 * justamente lo que un consultor necesita saber antes de opinar.
 *
 * APPEND-ONLY. `capability_health` guarda el historico con `assessed_at`: una
 * lectura de hoy no pisa la de ayer, porque la trayectoria de una capacidad solo
 * se ve teniendo las dos.
 */
import { createClient } from "@supabase/supabase-js";
import {
  assessHealth,
  type HealthReferenceRow,
  type SignalForHealth,
  type SymptomForHealth,
} from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { type LoadedApiEnv } from "@e-nora/config";

const logger = createLogger("health-engine");

/**
 * Cuantos dias de senales entran en la lectura.
 *
 * El mismo numero que usa `D06` para formar sintomas, y a proposito: si la salud
 * mirase una ventana distinta de la que forma los patrones, una capacidad podria
 * salir sana mientras el mapa de sintomas ensena un patron activo sobre las
 * mismas senales. Dos ventanas distintas sobre el mismo hecho es como se
 * contradicen dos pantallas sin que nadie sepa cual mirar.
 */
export const SENALES_RECIENTES_DIAS = 14;

const DIA_MS = 24 * 60 * 60 * 1000;

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Supabase = ReturnType<typeof createServiceClient>;

/**
 * Las metricas que produjeron serie en la ventana.
 *
 * Es lo que separa "medido y dentro de rango" de "no mirado", y sin ello
 * `healthy` seria una suposicion -- el guardrail 9 en una linea. Se saca de las
 * senales emitidas y de las metricas que el motor de senales sabe leer hoy.
 */
async function leerMetricasMedidas(
  supabase: Supabase,
  organizationId: string,
  desde: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("signals")
    .select("metric")
    .eq("organization_id", organizationId)
    .gte("window_end", desde);

  return [...new Set((data ?? []).map((s) => s.metric as string))];
}

/**
 * Una pasada de salud para una organizacion.
 *
 * No borra ni actualiza lecturas anteriores: inserta la de hoy. El historico es
 * el bloque entero -- `chronicity` y los patrones de recuperacion se derivan de
 * el cuando alguien los implemente (F9, segun el propio artefacto).
 */
export async function runHealthEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - SENALES_RECIENTES_DIAS * DIA_MS).toISOString();

  const { data: referencias, error: errorReferencias } = await supabase
    .from("health_references")
    .select("capability, metric, reference_type")
    .eq("organization_id", organizationId)
    .is("effective_to", null);

  if (errorReferencias) {
    throw new Error(`health_references_load_failed: ${errorReferencias.message}`);
  }

  const { data: senales, error: errorSenales } = await supabase
    .from("signals")
    .select(
      "id, capability, metric, direction, trajectory, guardrail_status, business_relevance, business_exposure, is_leading_indicator, data_confidence, window_start, window_end, description",
    )
    .eq("organization_id", organizationId)
    .gte("window_end", desde)
    .eq("suppression", "none");

  if (errorSenales) throw new Error(`signals_load_failed: ${errorSenales.message}`);

  const { data: sintomas, error: errorSintomas } = await supabase
    .from("symptoms")
    .select("id, capability, label, valence, confidence, persistence")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (errorSintomas) throw new Error(`symptoms_load_failed: ${errorSintomas.message}`);

  // El perfil de madurez vigente, para **enlazarlo**. Apartado 16 de D03 y
  // guardrail 16 de aqui: madurez y salud conviven, nunca se funden.
  const { data: perfil } = await supabase
    .from("maturity_profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .is("superseded_at", null)
    .maybeSingle();

  // Solo se evaluan las capacidades sobre las que hay algo que decir: una
  // referencia declarada, una senal o un sintoma. Escribir las quince siempre
  // llenaria la tabla de filas identicas que no informan de nada.
  const capabilities = [
    ...new Set(
      [
        ...(referencias ?? []).map((r) => r.capability),
        ...(senales ?? []).map((s) => s.capability),
        ...(sintomas ?? []).map((s) => s.capability),
      ].filter((c): c is string => typeof c === "string" && c.length > 0),
    ),
  ];

  const resumen = { capabilities: 0, findings: 0, not_assessable: 0 };
  if (capabilities.length === 0) return resumen;

  const lecturas = assessHealth({
    capabilities,
    references: (referencias ?? []) as HealthReferenceRow[],
    signals: (senales ?? []).map(
      (s): SignalForHealth => ({
        signal_id: s.id as string,
        capability: (s.capability as string | null) ?? null,
        metric: s.metric as string,
        direction: s.direction as string,
        trajectory: (s.trajectory as string | null) ?? null,
        guardrail_status: (s.guardrail_status as string | null) ?? null,
        business_relevance: s.business_relevance as string,
        business_exposure: (s.business_exposure as string | null) ?? null,
        is_leading_indicator: Boolean(s.is_leading_indicator),
        data_confidence: s.data_confidence as string,
        window_start: s.window_start as string,
        window_end: s.window_end as string,
        description: s.description as string,
      }),
    ),
    symptoms: (sintomas ?? []).map(
      (s): SymptomForHealth => ({
        symptom_id: s.id as string,
        capability: (s.capability as string | null) ?? null,
        label: s.label as string,
        valence: s.valence as string,
        confidence: s.confidence as string,
        persistence: s.persistence as string,
      }),
    ),
    measuredMetrics: await leerMetricasMedidas(supabase, organizationId, desde),
    maturityProfileId: (perfil?.id as string | undefined) ?? null,
  });

  for (const lectura of lecturas) {
    const { data: fila, error } = await supabase
      .from("capability_health")
      .insert({
        organization_id: organizationId,
        capability: lectura.capability,
        health_state: lectura.health_state,
        trajectory: lectura.trajectory,
        near_term_risk: lectura.near_term_risk,
        risk_horizon: lectura.risk_horizon,
        has_leading_signals: lectura.has_leading_signals,
        structural_risk: lectura.structural_risk,
        impact_vector: lectura.impact_vector,
        current_failure: lectura.current_failure,
        maturity_profile_id: lectura.maturity_profile_id,
        confidence: lectura.confidence,
        assessment_blocker: lectura.assessment_blocker,
        state_justification: lectura.state_justification,
        assessed_at: ahora.toISOString(),
      })
      .select("id")
      .single();

    if (error || !fila) {
      logger.error("capability_health_write_failed", {
        organization_id: organizationId,
        capability: lectura.capability,
        error: error?.message,
      });
      continue;
    }

    resumen.capabilities += 1;
    if (lectura.health_state === "not_assessable") resumen.not_assessable += 1;

    if (lectura.findings.length > 0) {
      const { error: errorHallazgos } = await supabase.from("health_findings").insert(
        lectura.findings.map((f) => ({
          capability_health_id: fila.id as string,
          kind: f.kind,
          description: f.description,
          severity: f.severity,
          trajectory: f.trajectory,
          confidence: f.confidence,
        })),
      );
      if (errorHallazgos) {
        logger.error("health_findings_write_failed", {
          organization_id: organizationId,
          capability: lectura.capability,
          error: errorHallazgos.message,
        });
      } else {
        resumen.findings += lectura.findings.length;
      }
    }

    if (lectura.evidence.length > 0) {
      // Guardrail 2: un estado de salud sin la evidencia que lo sostiene es una
      // opinion con formato de dato.
      const { error: errorEvidencia } = await supabase.from("health_evidence").insert(
        lectura.evidence.map((e) => ({
          capability_health_id: fila.id as string,
          relation: e.relation,
          metric: e.metric,
          observation: e.observation,
          indicator_type: e.indicator_type,
          window_start: e.window_start,
          window_end: e.window_end,
          source: e.source,
          confidence: e.confidence,
        })),
      );
      if (errorEvidencia) {
        logger.error("health_evidence_write_failed", {
          organization_id: organizationId,
          capability: lectura.capability,
          error: errorEvidencia.message,
        });
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron).
 *
 * Corre **despues** de `D05` y `D06`: lee lo que ellos escriben. Si se lanza
 * antes, no falla -- sale `not_assessable` por falta de senales, que es cierto
 * en ese instante pero no es lo que se queria medir.
 */
export async function runHealthEngineForAllOrganizations(env: LoadedApiEnv) {
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
    capabilities: 0,
    not_assessable: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runHealthEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.capabilities += result.capabilities;
      summary.not_assessable += result.not_assessable;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("health_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
