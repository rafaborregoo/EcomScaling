/**
 * FASE 3 / D02 — El motor de contextualizacion, conectado a datos reales.
 *
 * `assessContext` (en `@ecomscaling/contracts`) es puro. Este fichero es su
 * unica parte sucia, igual que `data-quality-engine.ts` lo es de `assessSource`
 * y `signal-engine.ts` de `detectSignals`.
 *
 * LO QUE APORTA, en una frase: la misma caida del AOV es un problema si cada
 * canal vende peor y **no lo es** si todos venden igual y solo cambio el peso
 * de cada uno. Sin descomponer, los dos casos se leen igual y llevan a
 * diagnosticos opuestos.
 *
 * DE DONDE ARRANCA. De las senales de `D05`: el runtime dice que D2 consume
 * "la senal o metrica observada", y una senal es exactamente eso. Sin senales
 * no escribe nada, que es el comportamiento correcto -- no hay nada que
 * contextualizar.
 *
 * QUIEN ABRE EL CASO, y por que es provisional. `context_assessments.case_id`
 * es obligatorio y **hoy no hay nadie que abra casos diagnosticos**: `D00`
 * define que es un caso pero no quien lo crea, y `D06` (sintomas), que seria su
 * sitio natural, no existe todavia. Mientras tanto lo abre este motor a partir
 * de la senal, con la huella de `20260927090000` para no abrir dos veces el
 * mismo. Cuando exista `D06` la apertura se mueve alli; esta anotado en
 * `conocimiento/TAREAS_PENDIENTES.md` para que no se quede.
 *
 * QUE NO HACE: no cierra causalidad, y la garantia es estructural -- la tabla
 * de salida no tiene `root_cause` ni nada parecido, y hay un test que falla si
 * aparece. Tampoco mira contexto de negocio, trade-offs, promociones ni
 * contexto externo: eso es criterio y vive en el RAG.
 */
import { createClient } from "@supabase/supabase-js";
import {
  assessContext,
  findContextContradictions,
  observedMainChannel,
  selectBaseline,
  type SegmentObservation,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("context-engine");

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * La ventana que se contextualiza: la ultima semana de la senal contra la
 * anterior.
 *
 * Siete dias y no otra cifra porque es la unica longitud que cancela el efecto
 * del dia de la semana, que es el ruido mas grande y mas facil de confundir con
 * un cambio del negocio en un ecommerce.
 */
const VENTANA_DIAS = 7;

/** Cuantos dias hacia atras se miran senales. */
const SENALES_RECIENTES_DIAS = 14;

/**
 * De la capacidad de `D05` al alcance de `D00`.
 *
 * Son dos catalogos distintos escritos en bloques distintos, y traducir entre
 * ellos aqui es preferible a tocar cualquiera de los dos: el de `diagnostic_
 * cases` es el alcance de una investigacion y el de las senales es el area del
 * negocio. Lo que no encaje cae en `business_global`, que es cierto.
 */
const ALCANCE_POR_CAPACIDAD: Record<string, string> = {
  conversion: "conversion",
  unit_economics: "finance",
  acquisition: "acquisition",
  retention: "retention",
  inventory: "inventory",
  operations: "operations",
  product: "product",
};

/** Dimensiones que el artefacto pide y `shopify_order_facts` no sostiene. */
const DIMENSIONES_CIEGAS = ["device", "market", "product"];

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type MixRow = { dimension: string; segment: string; orders: number; net_sales: number };

/**
 * Pasa el motor sobre una organizacion. Devuelve lo que quedo escrito, no lo
 * que se calculo: mismo criterio que los otros dos motores.
 */
export async function runContextEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const desde = new Date(Date.now() - SENALES_RECIENTES_DIAS * DIA_MS).toISOString();

  const { data: senales, error } = await supabase
    .from("signals")
    .select("id, store_id, metric, capability, scope, window_end, business_relevance")
    .eq("organization_id", organizationId)
    .gte("window_end", desde.slice(0, 10))
    .order("window_end", { ascending: false });

  if (error) throw new Error(`signals_load_failed: ${error.message}`);

  const resumen = { signals: 0, cases: 0, assessments: 0, segments: 0 };
  if ((senales ?? []).length === 0) return resumen;

  // La lectura de D01 sobre las fuentes de esta organizacion. El paso 1 del
  // runtime es explicito: "si D1 degrada una fuente, D2 debe conservar esa
  // incertidumbre". Aqui es donde se conserva.
  const { data: calidad } = await supabase
    .from("data_quality_assessments")
    .select("source, reliability, period_settlement, assessed_at")
    .eq("organization_id", organizationId)
    .order("assessed_at", { ascending: false })
    .limit(50);

  const calidadPorFuente = new Map<string, { source: string; reliability: string; period_settlement: string }>();
  for (const fila of calidad ?? []) {
    if (!calidadPorFuente.has(fila.source as string)) {
      calidadPorFuente.set(fila.source as string, {
        source: fila.source as string,
        reliability: fila.reliability as string,
        period_settlement: fila.period_settlement as string,
      });
    }
  }

  const { data: rupturas } = await supabase
    .from("context_comparability_breaks")
    .select("effective_from, description")
    .eq("organization_id", organizationId);

  const { data: cambios } = await supabase
    .from("context_change_events")
    .select("occurred_at, description")
    .eq("organization_id", organizationId)
    .gte("occurred_at", new Date(Date.now() - 60 * DIA_MS).toISOString());

  // Paso 13 -- declarado contra observado. El unico hecho de contexto que el
  // dato de pedidos sostiene hoy es el canal principal: se observa sobre los
  // ultimos 30 dias de toda la organizacion y se compara con lo declarado.
  const contradicciones = await contrastarContextoDeclarado(supabase, organizationId);

  for (const senal of senales ?? []) {
    resumen.signals += 1;

    const finAnalisis = new Date(`${String(senal.window_end).slice(0, 10)}T00:00:00.000Z`);
    const analysis = {
      start: new Date(finAnalisis.getTime() - VENTANA_DIAS * DIA_MS).toISOString(),
      end: finAnalisis.toISOString(),
    };
    const baseline = selectBaseline(analysis);
    const storeId = (senal.store_id as string | null) ?? null;

    const mixAnalisis = await leerMix(supabase, organizationId, storeId, analysis.start, analysis.end);
    const mixBaseline = await leerMix(
      supabase,
      organizationId,
      storeId,
      baseline.baseline_period_start,
      baseline.baseline_period_end,
    );

    const salida = assessContext({
      metric: senal.metric as string,
      scope: ALCANCE_POR_CAPACIDAD[senal.capability as string] ?? "business_global",
      analysis,
      segmentsBefore: mixBaseline,
      segmentsAfter: mixAnalisis,
      breaks: (rupturas ?? []).map((r) => ({
        effective_from: r.effective_from as string,
        description: r.description as string,
      })),
      dataQuality: [...calidadPorFuente.values()],
      declaredChanges: (cambios ?? []).map((c) => ({
        occurred_at: c.occurred_at as string,
        description: c.description as string,
      })),
      blindDimensions: DIMENSIONES_CIEGAS,
      contradictions: contradicciones,
    });

    const caseId = await abrirCaso(supabase, organizationId, storeId, senal, analysis, baseline);
    if (!caseId) continue;
    resumen.cases += 1;

    const { data: fila, error: errorAssessment } = await supabase
      .from("context_assessments")
      .upsert(
        {
          case_id: caseId,
          scope: salida.assessment.scope,
          baseline_type: salida.assessment.baseline_type,
          baseline_period_start: salida.assessment.baseline_period_start,
          baseline_period_end: salida.assessment.baseline_period_end,
          baseline_rationale: salida.assessment.baseline_rationale,
          comparability: salida.assessment.comparability,
          comparability_reasons: salida.assessment.comparability_reasons,
          aggregate_interpretation: salida.assessment.aggregate_interpretation,
          context_depth: salida.assessment.context_depth,
          context_sufficient: salida.assessment.context_sufficient,
          missing_context: salida.assessment.missing_context,
          critical_unknowns: salida.assessment.critical_unknowns,
          primary_factors: salida.assessment.primary_factors,
          declared_contradictions: salida.assessment.declared_contradictions,
          uncertainty_notes: salida.assessment.uncertainty_notes,
          assessed_at: new Date().toISOString(),
        },
        { onConflict: "case_id,scope" },
      )
      .select("id")
      .single();

    if (errorAssessment || !fila) {
      logger.error("context_assessment_write_failed", {
        organization_id: organizationId,
        metric: senal.metric,
        error: errorAssessment?.message,
      });
      continue;
    }
    resumen.assessments += 1;

    if (salida.mix.length > 0) {
      const { error: errorMix } = await supabase.from("context_mix_segments").upsert(
        salida.mix.map((m) => ({
          assessment_id: fila.id as string,
          dimension: m.dimension,
          segment: m.segment,
          weight_before: m.weight_before,
          weight_after: m.weight_after,
          performance_before: m.performance_before ?? null,
          performance_after: m.performance_after ?? null,
        })),
        { onConflict: "assessment_id,dimension,segment" },
      );
      if (errorMix) {
        logger.error("context_mix_write_failed", {
          organization_id: organizationId,
          error: errorMix.message,
        });
      } else {
        resumen.segments += salida.mix.length;
      }
    }
  }

  return resumen;
}

/** Paso 6: las dos fotos por segmento, agregadas en SQL (ADR-0006 punto 6). */
/**
 * Escribe el canal principal observado (si el dato lo sostiene) y devuelve las
 * contradicciones con el contexto declarado. Un fallo aqui no tumba la pasada:
 * sin contraste, la lectura sigue sin contradicciones, que es lo que habia.
 */
async function contrastarContextoDeclarado(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
) {
  const fin = new Date();
  const inicio = new Date(fin.getTime() - 30 * DIA_MS);
  const canal = observedMainChannel(
    await leerMix(supabase, organizationId, null, inicio.toISOString(), fin.toISOString()),
  );

  if (canal) {
    const { data: vigente } = await supabase
      .from("tenant_context_facts")
      .select("id, value")
      .eq("organization_id", organizationId)
      .is("store_id", null)
      .eq("dimension", "main_channel")
      .eq("source", "observed")
      .is("effective_to", null)
      .maybeSingle();
    if (vigente?.value !== canal) {
      // Historico, no sobrescritura: el canal de ayer queda cerrado con fecha.
      if (vigente) {
        await supabase
          .from("tenant_context_facts")
          .update({ effective_to: fin.toISOString() })
          .eq("id", vigente.id as string);
      }
      const { error } = await supabase.from("tenant_context_facts").insert({
        organization_id: organizationId,
        store_id: null,
        dimension: "main_channel",
        value: canal,
        source: "observed",
        origin: "shopify",
        effective_from: fin.toISOString(),
      });
      if (error) {
        logger.error("context_observed_fact_write_failed", {
          organization_id: organizationId,
          error: error.message,
        });
      }
    }
  }

  const { data: hechos, error } = await supabase
    .from("tenant_context_facts")
    .select("dimension, value, source, effective_to")
    .eq("organization_id", organizationId)
    .is("effective_to", null);
  if (error) {
    logger.error("context_facts_load_failed", { organization_id: organizationId, error: error.message });
    return [];
  }
  return findContextContradictions(
    (hechos ?? []).map((h) => ({
      dimension: h.dimension as string,
      value: h.value as string,
      source: h.source as string,
      effective_to: (h.effective_to as string | null) ?? null,
    })),
  );
}

async function leerMix(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  storeId: string | null,
  periodStart: string,
  periodEnd: string,
): Promise<SegmentObservation[]> {
  const { data, error } = await supabase.rpc("context_order_mix", {
    target_organization_id: organizationId,
    period_start: periodStart,
    period_end: periodEnd,
    target_store_id: storeId,
  });

  if (error) {
    logger.error("context_order_mix_failed", {
      organization_id: organizationId,
      error: error.message,
    });
    return [];
  }

  return ((data ?? []) as MixRow[]).map((row) => ({
    dimension: row.dimension,
    segment: row.segment,
    volume: Number(row.orders),
    // El rendimiento del segmento es su AOV. Sin pedidos no hay AOV: `null`, y
    // el contrato ya obliga a anular tambien el del otro periodo.
    performance: Number(row.orders) > 0 ? Number(row.net_sales) / Number(row.orders) : null,
  }));
}

/**
 * Abre el caso o recupera el que ya habia.
 *
 * Provisional por lo dicho arriba: esto es trabajo de `D06` cuando exista. El
 * caso nace en `open` y sin conclusion ninguna, que es lo unico que `D02` puede
 * afirmar -- contextualizar no es diagnosticar.
 */
async function abrirCaso(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  storeId: string | null,
  senal: { metric: unknown; capability: unknown },
  analysis: { start: string; end: string },
  baseline: { baseline_type: string; baseline_period_start: string; baseline_period_end: string },
): Promise<string | null> {
  const scope = ALCANCE_POR_CAPACIDAD[senal.capability as string] ?? "business_global";

  const { data, error } = await supabase
    .from("diagnostic_cases")
    .upsert(
      {
        organization_id: organizationId,
        store_id: storeId,
        target_metric: senal.metric as string,
        target_question: `Que explica el movimiento de ${senal.metric} en la ultima semana?`,
        scope,
        analysis_period_start: analysis.start,
        analysis_period_end: analysis.end,
        comparison_period_start: baseline.baseline_period_start,
        comparison_period_end: baseline.baseline_period_end,
        baseline_type: baseline.baseline_type,
        status: "open",
      },
      { onConflict: "organization_id,fingerprint" },
    )
    .select("id")
    .single();

  if (error || !data) {
    logger.error("diagnostic_case_open_failed", {
      organization_id: organizationId,
      metric: senal.metric,
      error: error?.message,
    });
    return null;
  }
  return data.id as string;
}

/**
 * Pasada global (cron). Va **despues** del motor de calidad de datos y despues
 * del de senales: sin senales no hay nada que contextualizar, y sin la lectura
 * de D01 la comparabilidad se declararia mas limpia de lo que es.
 */
export async function runContextEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) throw new Error(`organizations_load_failed: ${error.message}`);

  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments_written: 0 };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runContextEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments_written += result.assessments;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("context_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
