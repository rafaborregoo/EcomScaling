/**
 * FASE 3 / D06 — El motor de sintomas, conectado a datos reales.
 *
 * `buildSymptoms` (en `@ecomscaling/contracts`) es puro. Este fichero es su
 * unica parte sucia, igual que `data-quality-engine.ts` lo es de `assessSource`,
 * `signal-engine.ts` de `detectSignals` y `context-engine.ts` de `assessContext`.
 *
 * LO QUE APORTA, en una frase: D05 puede decir "las ventas netas caen un 18%" y
 * nada mas. **D06 es el bloque que cruza esa linea y solo esa**: convierte
 * senales coherentes entre si en un patron empresarial con nombre, alcance y
 * jerarquia. Sigue sin poder decir por que pasa (D07-D09) ni que hacer (F5+).
 *
 * DE DONDE SALE LA COHERENCIA, que es lo unico dificil del bloque. **De una
 * tabla, no de la forma de las series.** El guardrail 9 prohibe crear un
 * sintoma porque varias senales ocurran a la vez, y el 10 exige una relacion
 * declarada. Esa relacion se lee de `metric_dependencies`, donde la migracion
 * `20260928090000` declara que `net_sales` se compone de `orders_count` y por
 * que. Lo que coincide sin relacion declarada no se junta: sale como dos
 * sintomas independientes y una relacion candidata `often_cooccurs`.
 *
 * UN SINTOMA ES UN EPISODIO, NO UNA FOTO. Si la caida sigue ahi manana es el
 * mismo sintoma un dia mas viejo, y por eso este motor **actualiza y resuelve**
 * en vez de insertar siempre: la huella parcial de la migracion solo cubre los
 * activos, y los resueltos se quedan como historia. Sin esa historia el paso 19
 * del runtime --agudo, recurrente o cronico-- no se puede contestar.
 *
 * QUE NO HACE: no toca evidencia cualitativa (paso 18) porque no hay resenas ni
 * tickets ingeridos, no compone sintomas superiores entre familias (paso 16) y
 * no manda nada a D07/D08 (paso 24) porque no existen. Anotado en
 * `conocimiento/TAREAS_PENDIENTES.md`.
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildSymptoms,
  type ContextReading,
  type MetricDependency,
  type SignalForSymptom,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("symptom-engine");

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Cuantos dias hacia atras se miran senales.
 *
 * Las mismas dos semanas que usa D02, para que los dos motores hablen del mismo
 * tramo de tiempo. Si D06 mirase mas atras que D02, habria sintomas para los
 * que la lectura contextual no existiria y saldrian sin revisar sin que eso
 * significara nada.
 */
const SENALES_RECIENTES_DIAS = 14;

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type FilaSintoma = {
  id: string;
  canonical_type: string;
  status: string;
  first_seen_at: string;
  recurrence_count: number;
  store_id: string | null;
};

/** Pasa el motor sobre una organizacion. Devuelve lo que quedo escrito. */
export async function runSymptomEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const ahora = new Date().toISOString();
  const desde = new Date(Date.now() - SENALES_RECIENTES_DIAS * DIA_MS)
    .toISOString()
    .slice(0, 10);

  const resumen = { stores: 0, symptoms: 0, updated: 0, resolved: 0, skipped: 0, relations: 0 };

  const { data: tiendas, error: errorTiendas } = await supabase
    .from("shopify_stores")
    .select("id, myshopify_domain, shop_name")
    .eq("organization_id", organizationId);
  if (errorTiendas) throw new Error(`shopify_stores_load_failed: ${errorTiendas.message}`);

  const variasTiendas = (tiendas ?? []).length > 1;

  // Paso 3: la relacion entre metricas. Globales (aritmetica del ecommerce) y
  // las propias del tenant, si alguna vez las hay.
  const { data: dependencias } = await supabase
    .from("metric_dependencies")
    .select("metric, depends_on, relation, rationale, organization_id")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`);

  const deps: MetricDependency[] = (dependencias ?? []).map((d) => ({
    metric: d.metric as string,
    depends_on: d.depends_on as string,
    relation: d.relation as MetricDependency["relation"],
    ...(d.rationale ? { rationale: d.rationale as string } : {}),
  }));

  // Paso 7: la lectura de D02, por metrica. Se toma la mas reciente de cada
  // metrica; si D02 no ha pasado todavia, el sintoma sale sin revisar -- que es
  // lo correcto y lo que le impide declararse con confianza alta.
  const contexts = await leerContexto(supabase, organizationId);

  for (const tienda of tiendas ?? []) {
    resumen.stores += 1;
    const storeId = tienda.id as string;

    const { data: senales, error } = await supabase
      .from("signals")
      .select(
        "id, metric, capability, scope, direction, window_start, window_end, persistence, business_relevance, data_confidence, signal_confidence, low_sample",
      )
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .gte("window_end", desde)
      .order("window_end", { ascending: false });

    if (error) throw new Error(`signals_load_failed: ${error.message}`);
    if ((senales ?? []).length === 0) continue;

    const signals: SignalForSymptom[] = (senales ?? []).map((s) => ({
      signal_id: s.id as string,
      metric: s.metric as string,
      ...(s.capability ? { capability: s.capability as string } : {}),
      scope: s.scope as string,
      direction: s.direction as SignalForSymptom["direction"],
      window_start: s.window_start as string,
      window_end: s.window_end as string,
      persistence: s.persistence as string,
      business_relevance: s.business_relevance as string,
      data_confidence: s.data_confidence as string,
      signal_confidence: s.signal_confidence as string,
      low_sample: Boolean(s.low_sample),
    }));

    // Pasos 19 y 21: los episodios anteriores del mismo tipo en esta tienda.
    const { data: historicos } = await supabase
      .from("symptoms")
      .select("id, canonical_type, status, first_seen_at, recurrence_count, store_id")
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .order("last_seen_at", { ascending: false });

    const previos = (historicos ?? []) as FilaSintoma[];
    // El mas reciente por tipo: el `order` de arriba ya los trajo ordenados.
    const ultimoPorTipo = new Map<string, FilaSintoma>();
    for (const p of previos) {
      if (!ultimoPorTipo.has(p.canonical_type)) ultimoPorTipo.set(p.canonical_type, p);
    }

    const salida = buildSymptoms({
      signals,
      dependencies: deps,
      contexts,
      // Guardrail 23: una tienda de varias no es "el negocio". Con una sola,
      // decir `segment` seria especificidad inventada (guardrail 26).
      scope: variasTiendas ? "segment" : "business",
      ...(variasTiendas
        ? { scopeDetail: { store_id: storeId, store: tienda.shop_name ?? tienda.myshopify_domain } }
        : {}),
      previous: [...ultimoPorTipo.values()].map((p) => ({
        symptom_id: p.id,
        canonical_type: p.canonical_type,
        status: p.status,
        first_seen_at: p.first_seen_at,
        recurrence_count: p.recurrence_count,
      })),
      now: ahora,
    });

    resumen.skipped += salida.skipped.length;
    for (const s of salida.skipped) {
      // Las senales descartadas se registran: lo que no se ve no se revisa.
      logger.info("symptom_signal_skipped", {
        organization_id: organizationId,
        metric: s.metric,
        reason: s.reason,
      });
    }

    // Los padres primero: el hijo necesita el uuid real de su padre, y el motor
    // puro solo conoce identificadores suyos (`tipo:fecha`).
    const porClave = new Map<string, string>();
    const ordenados = [...salida.symptoms].sort((a, b) =>
      (a.parent_symptom_id ? 1 : 0) - (b.parent_symptom_id ? 1 : 0),
    );
    const activosEscritos = new Set<string>();

    for (const s of ordenados) {
      const anterior = ultimoPorTipo.get(s.canonical_type);
      const mismoEpisodio = anterior?.status === "active" ? anterior : null;

      const fila = {
        organization_id: organizationId,
        store_id: storeId,
        symptom_family: s.symptom_family,
        canonical_type: s.canonical_type,
        label: s.label,
        valence: s.valence,
        capability: s.capability ?? null,
        scope: s.scope,
        scope_detail: s.scope_detail,
        diagnostic_depth: s.diagnostic_depth,
        process_position: s.process_position ?? null,
        time_role: s.time_role ?? null,
        persistence: s.persistence,
        recurrence_count: s.recurrence_count,
        same_time_window: s.same_time_window,
        compatible_scope: s.compatible_scope,
        compatible_direction: s.compatible_direction,
        known_relationship: s.known_relationship,
        sufficient_signal_quality: s.sufficient_signal_quality,
        coherence_relationship: s.coherence_relationship ?? null,
        confidence: s.confidence,
        data_confidence: s.data_confidence,
        context_reviewed: s.context_reviewed,
        parent_symptom_id: s.parent_symptom_id
          ? (porClave.get(s.parent_symptom_id) ?? null)
          : null,
        previous_symptom_id: s.previous_symptom_id ?? null,
        last_seen_at: ahora,
        status: "active" as const,
      };

      let id: string | null = null;
      if (mismoEpisodio) {
        // `first_seen_at` NO se toca: es cuando empezo, y es lo que decide si
        // esto es cronico. Tampoco `context_snapshot`, que ademas es inmutable
        // por trigger.
        const { error: errorUpdate } = await supabase
          .from("symptoms")
          .update(fila)
          .eq("id", mismoEpisodio.id);
        if (errorUpdate) {
          logger.error("symptom_update_failed", {
            organization_id: organizationId,
            canonical_type: s.canonical_type,
            error: errorUpdate.message,
          });
          continue;
        }
        id = mismoEpisodio.id;
        resumen.updated += 1;
      } else {
        const { data, error: errorInsert } = await supabase
          .from("symptoms")
          .insert({ ...fila, first_seen_at: ahora, onset_at: ahora })
          .select("id")
          .single();
        if (errorInsert || !data) {
          logger.error("symptom_write_failed", {
            organization_id: organizationId,
            canonical_type: s.canonical_type,
            error: errorInsert?.message,
          });
          continue;
        }
        id = data.id as string;
        resumen.symptoms += 1;
      }

      porClave.set(s.symptom_id, id);
      activosEscritos.add(id);
    }

    // Paso 5: las senales que lo sostienen, con su papel.
    const enlaces = salida.links
      .filter((l) => porClave.has(l.symptom_id))
      .map((l) => ({
        organization_id: organizationId,
        symptom_id: porClave.get(l.symptom_id)!,
        signal_id: l.signal_id,
        role: l.role,
      }));
    if (enlaces.length > 0) {
      const { error: errorLinks } = await supabase
        .from("symptom_signals")
        .upsert(enlaces, { onConflict: "symptom_id,signal_id" });
      if (errorLinks) {
        logger.error("symptom_signals_write_failed", {
          organization_id: organizationId,
          error: errorLinks.message,
        });
      }
    }

    // Guardrail 13: lo que contradice se guarda como evidencia, no se tira.
    const evidencias = salida.evidence
      .filter((e) => porClave.has(e.symptom_id))
      .map((e) => ({
        organization_id: organizationId,
        symptom_id: porClave.get(e.symptom_id)!,
        source_kind: e.source_kind,
        stance: e.stance,
        observation: e.observation,
      }));
    if (evidencias.length > 0) {
      const { error: errorEvidencia } = await supabase
        .from("symptom_evidence")
        .upsert(evidencias, { onConflict: "symptom_id,source_kind,observation_hash" });
      if (errorEvidencia) {
        logger.error("symptom_evidence_write_failed", {
          organization_id: organizationId,
          error: errorEvidencia.message,
        });
      }
    }

    // Paso 20: relaciones candidatas. `often_cooccurs`, nunca `causes`.
    const relaciones = salida.relations
      .filter((r) => porClave.has(r.from_symptom_id) && porClave.has(r.to_symptom_id))
      .map((r) => ({
        organization_id: organizationId,
        from_symptom_id: porClave.get(r.from_symptom_id)!,
        to_symptom_id: porClave.get(r.to_symptom_id)!,
        relation: r.relation,
        rationale: r.rationale ?? null,
      }));
    if (relaciones.length > 0) {
      const { error: errorRel } = await supabase
        .from("symptom_relations")
        .upsert(relaciones, { onConflict: "from_symptom_id,to_symptom_id,relation" });
      if (errorRel) {
        logger.error("symptom_relations_write_failed", {
          organization_id: organizationId,
          error: errorRel.message,
        });
      } else {
        resumen.relations += relaciones.length;
      }
    }

    // Lo que ya no aparece se resuelve. Es lo que convierte la tabla en una
    // historia de episodios en vez de un monton de filas activas para siempre
    // -- y sin episodios cerrados, "recurrente" no se puede distinguir de
    // "cronico".
    for (const p of previos) {
      if (p.status !== "active" || activosEscritos.has(p.id)) continue;
      const { error: errorResolve } = await supabase
        .from("symptoms")
        .update({ status: "resolved", resolved_at: ahora })
        .eq("id", p.id);
      if (!errorResolve) resumen.resolved += 1;
    }
  }

  return resumen;
}

/**
 * La lectura de D02 por metrica, a traves del caso que la sostiene.
 *
 * `context_assessments` cuelga de `diagnostic_cases`, y es el caso el que sabe
 * de que metrica se hablaba. Dos consultas en vez de un join porque PostgREST
 * no deja filtrar por columna de la tabla embebida sin `!inner`, y la lista de
 * casos recientes de una organizacion cabe de sobra en memoria.
 */
async function leerContexto(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
): Promise<Record<string, ContextReading>> {
  const { data: casos } = await supabase
    .from("diagnostic_cases")
    .select("id, target_metric, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!casos || casos.length === 0) return {};

  const metricaPorCaso = new Map(casos.map((c) => [c.id as string, c.target_metric as string]));

  const { data: lecturas } = await supabase
    .from("context_assessments")
    .select("id, case_id, aggregate_interpretation, comparability, assessed_at")
    .in("case_id", [...metricaPorCaso.keys()])
    .order("assessed_at", { ascending: false });

  const contexts: Record<string, ContextReading> = {};
  for (const l of lecturas ?? []) {
    const metrica = metricaPorCaso.get(l.case_id as string);
    if (!metrica || contexts[metrica]) continue;
    contexts[metrica] = {
      aggregate_interpretation: l.aggregate_interpretation as string,
      comparability: l.comparability as string,
      context_assessment_id: l.id as string,
    };
  }
  return contexts;
}

/**
 * Pasada global (cron). Va **la ultima** de la cadena: necesita las senales de
 * D05, la fiabilidad de D01 que esas senales ya llevan dentro y la lectura de
 * D02. Ejecutarlo antes que D02 solo produce sintomas sin revisar.
 */
export async function runSymptomEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) throw new Error(`organizations_load_failed: ${error.message}`);

  const summary = { organizations: 0, succeeded: 0, failed: 0, symptoms_written: 0 };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runSymptomEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.symptoms_written += result.symptoms;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("symptom_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
