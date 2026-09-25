/**
 * FASE 3 / D01 — El motor de calidad de datos, conectado a la ingesta real.
 *
 * `assessSource` (en `@e-nora/contracts`) es puro: entran hechos de
 * ingesta y sale una evaluacion con sus issues. Este fichero es su unica parte
 * sucia -- leer Supabase, escribir `data_quality_assessments` y
 * `data_quality_issues` -- igual que `signal-engine.ts` lo es de `detectSignals`.
 *
 * POR QUE ESTE ES EL PRIMER MOTOR Y NO EL SEGUNDO. D01 es la puerta que hay
 * antes de todo lo demas: sin el, "las ventas han caido" y "la credencial de
 * Shopify caduco el martes" producen el mismo diagnostico. El motor de senales
 * de D05 ya existe y hoy escribe `data_confidence: "low"` a mano, porque no
 * habia nadie que evaluara el dato. Esto es ese alguien.
 *
 * QUE LEE. `integration_connections` (estado y ultima sincronizacion),
 * `integration_sync_runs` (ejecuciones recientes), `private.integration_creden
 * tials` (caducidad) y `private.webhook_events` (entregas fallidas). Para
 * Shopify, ademas, el rango realmente ingerido de `shopify_order_facts`.
 *
 * QUE NO HACE, anotado en vez de fingido: no reconcilia fuentes entre si
 * (pasos 4 a 6 y 17 del runtime) porque hace falta una segunda fuente
 * comparable sobre el mismo fenomeno y hoy solo Shopify tiene serie diaria; no
 * mira schema drift ni checks matematicos (pasos 7 y 8), que exigen el evento
 * crudo; no propaga por lineage (paso 12) ni evalua atribucion (paso 13).
 * `data_source_reconciliations` tiene tabla y contrato desde el primer dia y
 * sigue vacia a proposito: se llenara cuando Meta y Klaviyo tengan su serie.
 *
 * IDEMPOTENTE POR DISENO. La migracion `20260926090000` anadio la huella:
 * misma fuente, scope y ventana son la misma evaluacion, y solo puede haber un
 * issue ABIERTO por tipo y fuente. Reejecutar el motor corrige, no acumula.
 */
import { createClient } from "@supabase/supabase-js";
import { assessSource, type IngestionFacts } from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { type LoadedApiEnv } from "@e-nora/config";

const logger = createLogger("data-quality-engine");

/**
 * La ventana que se evalua. Cuatro semanas: suficiente para que faltar historia
 * se note y corto para que la evaluacion siga hablando del presente.
 */
const VENTANA_DIAS = 28;

/** Cuantas ejecuciones recientes se miran por conexion. */
const RUNS_RECIENTES = 20;

const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;

/**
 * Las fuentes que se evaluan, con su cadencia esperada **por defecto**.
 *
 * Estos numeros son el ultimo recurso: si existe una fila en
 * `data_source_expectations` para la organizacion, manda esa. Estan aqui
 * porque sin cadencia esperada no existe la obsolescencia (`classifyFreshness`
 * devuelve `unknown` y la fiabilidad se queda topada en `medium` para siempre),
 * y dejar todas las fuentes en `unknown` no es prudencia, es no evaluar.
 *
 * `coverage` solo se calcula donde se puede medir de verdad. Ver `diasCubiertos`.
 */
const FUENTES = [
  {
    source: "shopify",
    dataset: "orders",
    phenomenon: "sales",
    expected_cadence_minutes: 60,
    delay_tolerance_minutes: 120,
    porTienda: true,
  },
  {
    source: "meta_ads",
    dataset: "insights",
    phenomenon: "ad_spend",
    // Meta reasienta atribucion durante dias: exigirle frescura horaria seria
    // inventarse un problema que la plataforma no tiene.
    expected_cadence_minutes: 1440,
    delay_tolerance_minutes: 360,
    porTienda: false,
  },
  {
    source: "klaviyo",
    dataset: "campaigns",
    phenomenon: "email_engagement",
    expected_cadence_minutes: 1440,
    delay_tolerance_minutes: 360,
    porTienda: false,
  },
] as const;

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const diaUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Los dias de la ventana que **estan realmente cubiertos** por lo ingerido.
 *
 * Esto es lo unico honesto que se puede decir de la cobertura de Shopify, y
 * merece la explicacion porque la alternativa obvia esta mal: `shopify_sales_
 * daily` devuelve una fila por cada dia del rango, rellenando con ceros los
 * dias sin pedidos. Contar sus filas daria 100% de cobertura siempre, incluso
 * en una tienda que se conecto ayer.
 *
 * Lo que si se puede afirmar: entre el primer y el ultimo pedido ingeridos, el
 * dato esta. Un dia a cero ahi dentro es un dia sin ventas -- un valor, no un
 * hueco, y tratarlo como hueco seria el guardrail 14 al reves. Fuera de ese
 * rango no es que no hubiera ventas: es que no las hemos traido.
 */
function diasCubiertos(
  primero: string | null,
  ultimo: string | null,
  desde: number,
  hasta: number,
): string[] {
  if (!primero || !ultimo) return [];
  const inicio = Math.max(Date.parse(primero), desde);
  const fin = Math.min(Date.parse(ultimo), hasta);
  const dias: string[] = [];
  for (let t = desde; t < hasta; t += DIA) {
    const finDelDia = t + DIA;
    // Un dia cuenta como cubierto si el rango ingerido lo toca.
    if (finDelDia > inicio && t <= fin) dias.push(diaUtc(t));
  }
  return dias;
}

type Conexion = {
  id: string;
  provider: string;
  status: string | null;
  last_sync_at: string | null;
  last_error_message: string | null;
};

/**
 * Pasa el motor sobre una organizacion.
 *
 * Devuelve lo que quedo escrito, no lo que se detecto: lo que no se persiste
 * no existe, que es el mismo criterio que el motor de senales.
 */
export async function runDataQualityEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const ahora = new Date();
  // La ventana son dias enteros UTC, no "hasta este segundo". Si terminara
  // ahora, el ultimo dia estaria siempre a medias y el periodo saldria `open`
  // en todas las pasadas: un aviso que se repite siempre deja de avisar. Con
  // dias cerrados, `partially_settled` y `open` vuelven a significar algo.
  const hasta = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  const desde = hasta - VENTANA_DIAS * DIA;
  const ventana = {
    periodStart: new Date(desde).toISOString(),
    periodEnd: new Date(hasta).toISOString(),
    now: ahora.toISOString(),
  };

  const { data: conexiones, error: errorConexiones } = await supabase
    .from("integration_connections")
    .select("id, provider, status, last_sync_at, last_error_message")
    .eq("organization_id", organizationId);

  if (errorConexiones) {
    throw new Error(`integration_connections_load_failed: ${errorConexiones.message}`);
  }

  // La expectativa del tenant manda sobre el defecto del codigo (D01 capa
  // `06-tenant-context`): cada negocio sabe cada cuanto necesita su dato.
  const { data: expectativas } = await supabase
    .from("data_source_expectations")
    .select("source, dataset, expected_cadence_minutes, delay_tolerance_minutes")
    .eq("organization_id", organizationId);

  const expectativaDe = new Map(
    (expectativas ?? []).map((e) => [`${e.source}|${e.dataset}`, e]),
  );

  const { data: tiendas } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId);

  const resumen = { sources: 0, assessments: 0, issues_opened: 0, issues_updated: 0, issues_resolved: 0 };
  const evaluadas: { id: string; issues: ReturnType<typeof assessSource>["issues"]; store_id: string | null }[] = [];

  for (const definicion of FUENTES) {
    const conexion = (conexiones ?? []).find((c) => c.provider === definicion.source) as
      | Conexion
      | undefined;
    // Una integracion que nunca se conecto no es una fuente degradada: no es
    // una fuente. Evaluarla produciria un `unusable` permanente que no dice
    // nada de la calidad del dato de este negocio.
    if (!conexion) continue;

    const hechosBase = await hechosDeIngesta(supabase, organizationId, conexion, definicion);
    const expectativa = expectativaDe.get(`${definicion.source}|${definicion.dataset}`) ?? {
      expected_cadence_minutes: definicion.expected_cadence_minutes,
      delay_tolerance_minutes: definicion.delay_tolerance_minutes,
    };

    const destinos: (string | null)[] = definicion.porTienda
      ? (tiendas ?? []).map((t) => t.id as string)
      : [null];

    for (const storeId of destinos) {
      const facts: IngestionFacts = { ...hechosBase };
      if (definicion.porTienda && storeId) {
        facts.observed_dates = await diasConDatoShopify(
          supabase,
          organizationId,
          storeId,
          desde,
          hasta,
        );
      }

      const evaluacion = assessSource(facts, ventana, expectativa);
      resumen.sources += 1;

      const { data: fila, error } = await supabase
        .from("data_quality_assessments")
        .upsert(
          {
            organization_id: organizationId,
            store_id: storeId,
            source: evaluacion.source,
            dataset: evaluacion.dataset,
            phenomenon: evaluacion.phenomenon,
            scope: evaluacion.scope,
            period_start: evaluacion.period_start,
            period_end: evaluacion.period_end,
            period_settlement: evaluacion.period_settlement,
            last_sync_at: evaluacion.last_sync_at,
            expected_cadence_minutes: evaluacion.expected_cadence_minutes,
            freshness: evaluacion.freshness,
            expected_observations: evaluacion.expected_observations,
            available_observations: evaluacion.available_observations,
            coverage: evaluacion.coverage,
            missingness: evaluacion.missingness,
            granularity_available: definicion.porTienda ? "daily" : null,
            reliability: evaluacion.reliability,
            degradation_reasons: evaluacion.degradation_reasons,
            assessed_at: ventana.now,
          },
          { onConflict: "organization_id,fingerprint" },
        )
        .select("id")
        .single();

      if (error || !fila) {
        logger.error("assessment_write_failed", {
          organization_id: organizationId,
          source: evaluacion.source,
          error: error?.message,
        });
        continue;
      }

      resumen.assessments += 1;
      evaluadas.push({ id: fila.id as string, issues: evaluacion.issues, store_id: storeId });
    }
  }

  const escritura = await sincronizarIssues(supabase, organizationId, evaluadas, ventana.now);
  resumen.issues_opened = escritura.abiertos;
  resumen.issues_updated = escritura.actualizados;
  resumen.issues_resolved = escritura.resueltos;

  return resumen;
}

/** Paso 11 del runtime: la salud de la tuberia, no el codigo HTTP de la ultima llamada. */
async function hechosDeIngesta(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  conexion: Conexion,
  definicion: (typeof FUENTES)[number],
): Promise<IngestionFacts> {
  const { data: runs } = await supabase
    .from("integration_sync_runs")
    .select("status, sync_type, records_written, records_failed, error_code, finished_at")
    .eq("organization_id", organizationId)
    .eq("connection_id", conexion.id)
    .order("created_at", { ascending: false })
    .limit(RUNS_RECIENTES);

  const { data: credencial } = await supabase
    .schema("private")
    .from("integration_credentials")
    .select("expires_at")
    .eq("connection_id", conexion.id)
    .order("expires_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { count: webhooksFallidos } = await supabase
    .schema("private")
    .from("webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", conexion.id)
    .eq("status", "failed");

  return {
    source: definicion.source,
    dataset: definicion.dataset,
    phenomenon: definicion.phenomenon,
    connection_status: conexion.status,
    last_sync_at: conexion.last_sync_at,
    last_error_message: conexion.last_error_message,
    credential_expires_at: credencial?.expires_at ?? null,
    recent_runs: (runs ?? []).map((r) => ({
      status: r.status as string,
      sync_type: r.sync_type as string | null,
      records_written: r.records_written as number | null,
      records_failed: r.records_failed as number | null,
      error_code: r.error_code as string | null,
      finished_at: r.finished_at as string | null,
    })),
    failed_webhooks: webhooksFallidos ?? 0,
  };
}

/** El rango realmente ingerido, que es lo unico que sostiene una cobertura. */
async function diasConDatoShopify(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  storeId: string,
  desde: number,
  hasta: number,
): Promise<string[]> {
  const extremo = async (ascendente: boolean) => {
    const { data } = await supabase
      .from("shopify_order_facts")
      .select("processed_at, external_created_at")
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .eq("is_test_order", false)
      .is("cancelled_at", null)
      .order("processed_at", { ascending: ascendente, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    return (data?.processed_at ?? data?.external_created_at ?? null) as string | null;
  };

  return diasCubiertos(await extremo(true), await extremo(false), desde, hasta);
}

/**
 * Escribe los issues respetando lo que ya habia.
 *
 * Tres reglas, y las tres son decisiones, no detalles:
 *
 * 1. Un fallo que sigue ahi **se actualiza**, no se duplica: el consultor
 *    quiere ver "esto lleva roto desde el martes", no doce filas iguales.
 * 2. Un fallo que alguien cerro **no se reabre en silencio**. Si la averia
 *    vuelve, entra una fila nueva con su fecha, y que aparezca dos veces en un
 *    mes es justo la informacion que hay que ver.
 * 3. Un fallo que ya no se observa **se cierra con su motivo**, porque el
 *    guardrail 4 prohibe cerrar sin decir por que -- y el motor puede decirlo:
 *    la condicion ya no esta. Dejarlos abiertos para siempre convierte el
 *    panel en ruido, que es la otra forma de no avisar de nada.
 */
async function sincronizarIssues(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  evaluadas: { id: string; issues: ReturnType<typeof assessSource>["issues"]; store_id: string | null }[],
  ahora: string,
) {
  const clave = (i: {
    source: string;
    dataset?: string | null | undefined;
    phenomenon?: string | null | undefined;
    scope?: string | null | undefined;
    store_id?: string | null | undefined;
    issue_type: string;
  }) =>
    [
      i.source,
      i.dataset ?? "-",
      i.phenomenon ?? "-",
      i.scope ?? "global",
      i.store_id ?? "-",
      i.issue_type,
    ].join("|");

  const { data: abiertosEnBase } = await supabase
    .from("data_quality_issues")
    .select("id, source, dataset, phenomenon, scope, store_id, issue_type")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);

  const existentes = new Map(
    (abiertosEnBase ?? []).map((i) => [
      clave({
        source: i.source as string,
        dataset: i.dataset as string | null,
        phenomenon: i.phenomenon as string | null,
        scope: i.scope as string | null,
        store_id: i.store_id as string | null,
        issue_type: i.issue_type as string,
      }),
      i.id as string,
    ]),
  );

  const detectados = new Set<string>();
  let abiertos = 0;
  let actualizados = 0;

  for (const evaluacion of evaluadas) {
    for (const issue of evaluacion.issues) {
      const k = clave({ ...issue, store_id: evaluacion.store_id });
      detectados.add(k);

      const fila = {
        organization_id: organizationId,
        store_id: evaluacion.store_id,
        assessment_id: evaluacion.id,
        issue_type: issue.issue_type,
        source: issue.source,
        dataset: issue.dataset,
        phenomenon: issue.phenomenon,
        scope: issue.scope,
        description: issue.description,
        severity: issue.severity,
        material: issue.material,
        downstream_effect: issue.downstream_effect,
        client_actionable: issue.client_actionable,
      };

      const existente = existentes.get(k);
      if (existente) {
        // `detected_at` NO se toca: es cuando empezo, y es la mitad del valor
        // de la fila. `status` tampoco, para no pisar a quien lo esta mirando.
        const { error } = await supabase
          .from("data_quality_issues")
          .update({
            description: fila.description,
            severity: fila.severity,
            material: fila.material,
            downstream_effect: fila.downstream_effect,
            assessment_id: fila.assessment_id,
          })
          .eq("id", existente);
        if (!error) actualizados += 1;
        continue;
      }

      const { error } = await supabase
        .from("data_quality_issues")
        .insert({ ...fila, status: "open", detected_at: ahora });
      if (error) {
        logger.error("issue_write_failed", {
          organization_id: organizationId,
          issue_type: issue.issue_type,
          error: error.message,
        });
        continue;
      }
      abiertos += 1;
    }
  }

  let resueltos = 0;
  for (const [k, id] of existentes) {
    if (detectados.has(k)) continue;
    const { error } = await supabase
      .from("data_quality_issues")
      .update({
        status: "resolved",
        resolved_at: ahora,
        downstream_effect: "none",
        explanation: `El motor de calidad de datos ya no observa esta condicion (comprobado el ${ahora.slice(0, 10)}).`,
      })
      .eq("id", id);
    if (!error) resueltos += 1;
  }

  return { abiertos, actualizados, resueltos };
}

/**
 * Pasada global (cron). Cada organizacion falla o triunfa por separado: que una
 * tenga la integracion rota no puede dejar sin evaluar a las demas -- y menos
 * en este motor, cuyo trabajo es precisamente detectar integraciones rotas.
 */
export async function runDataQualityEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) {
    throw new Error(`organizations_load_failed: ${error.message}`);
  }

  const summary = {
    organizations: 0,
    succeeded: 0,
    failed: 0,
    assessments_written: 0,
    issues_opened: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runDataQualityEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments_written += result.assessments;
      summary.issues_opened += result.issues_opened;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("data_quality_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
