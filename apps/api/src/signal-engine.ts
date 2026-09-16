/**
 * FASE 3 / D05 — El motor de senales, conectado a datos reales.
 *
 * `detectSignals` (en `@ecomscaling/contracts`) es puro: entra una serie de
 * numeros y salen senales candidatas. Este fichero es su unica parte sucia --
 * leer de Supabase, escribir en `signals` -- y por eso es deliberadamente
 * corto: toda la decision esta en el detector, que se prueba sin montar nada.
 *
 * QUE LEE HOY. `shopify_sales_daily`, que devuelve ventas netas y numero de
 * pedidos por dia. Son las dos unicas metricas que existen ya como serie
 * temporal fiable. Meta y Klaviyo entran cuando sus funciones diarias tengan la
 * misma forma; ampliar esto es anadir una entrada a `METRICAS`, no reescribir.
 *
 * QUE NO HACE, y esta anotado en la bitacora en vez de fingido: no ajusta por
 * estacionalidad ni por dia de la semana (paso 4 del runtime), no busca change
 * points (paso 8), no baja a segmentos (pasos 14 a 17), no corrobora entre
 * fuentes (paso 19) ni agrupa en clusters (paso 22). Cada una de esas cosas
 * necesita datos que hoy no llegan hasta aqui.
 *
 * IDEMPOTENTE POR DISENO. `signal_id` del detector es determinista
 * (`metrica:tipo:fecha`), asi que reejecutar el motor el mismo dia no duplica
 * senales: se hace upsert sobre la misma huella.
 */
import { createClient } from "@supabase/supabase-js";
import { detectSignals, type SeriesPoint } from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("signal-engine");

/** Cuantos dias de historia mira el motor para construir el baseline propio. */
const VENTANA_DIAS = 60;

/**
 * Las metricas que hoy tienen serie diaria de verdad.
 *
 * `capability` las ata a las capacidades de D03/D04. `exposure` no esta aqui: el
 * guardrail 8 dice que la relevancia depende de cuanto pesa esa metrica en el
 * negocio, y eso es del tenant (`tenant_capability_config`), no una constante.
 */
const METRICAS = [
  { metric: "net_sales", capability: "unit_economics" as const, columna: "net_sales" },
  { metric: "orders_count", capability: "conversion" as const, columna: "orders_count" },
];

/**
 * Las metricas que alguien vigila de verdad, para quien necesite distinguir
 * "se miro y no se movio" de "nadie lo mira".
 *
 * D07 la necesita: sin ella, una rama sin senal se poda igual la mire alguien o
 * no, y eso convierte "no lo se" en "no lo hay".
 */
export const METRICAS_VIGILADAS = METRICAS.map((m) => m.metric);

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type FilaDiaria = { bucket_date: string; net_sales: number; orders_count: number };

/**
 * La fiabilidad de D01 traducida a la confianza del dato de una senal.
 *
 * Sin evaluacion se queda en `low`, que es lo que habia antes de que D01
 * tuviera motor: no haber mirado el dato no es lo mismo que haberlo aprobado.
 */
function confianzaDelDato(reliability: string | undefined): string {
  switch (reliability) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

/**
 * Pasa el motor sobre una organizacion. Devuelve cuantas senales quedaron
 * escritas, no cuantas se detectaron: lo que no se persiste no existe.
 */
export async function runSignalEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - VENTANA_DIAS * 24 * 60 * 60 * 1000);

  const { data: tiendas, error: errorTiendas } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId);

  if (errorTiendas) {
    throw new Error(`shopify_stores_load_failed: ${errorTiendas.message}`);
  }

  // La exposicion por capacidad la declara el consultor (D04). Sin ella, el
  // guardrail 8 impide que nada suba de `medium`, que es exactamente lo que
  // debe pasar: sin saber cuanto pesa una metrica, no se puede gritar.
  const { data: config } = await supabase
    .from("tenant_capability_config")
    .select("capability, business_exposure")
    .eq("organization_id", organizationId);

  const exposicionPor = new Map(
    (config ?? []).map((c) => [c.capability, c.business_exposure ?? undefined]),
  );

  // La confianza del dato la escribe D01. Hasta que existio su motor, esto era
  // un `low` fijo con una nota pidiendo perdon; ahora es la fiabilidad real de
  // la fuente que sostiene la serie -- que para estas dos metricas es Shopify.
  const { data: calidad } = await supabase
    .from("data_quality_assessments")
    .select("store_id, reliability, assessed_at")
    .eq("organization_id", organizationId)
    .eq("source", "shopify")
    .eq("dataset", "orders")
    .order("assessed_at", { ascending: false });

  // La primera que aparece por tienda es la mas reciente: el `order` de arriba
  // ya las trajo ordenadas.
  const fiabilidadPorTienda = new Map<string, string>();
  for (const fila of calidad ?? []) {
    const clave = (fila.store_id as string | null) ?? "-";
    if (!fiabilidadPorTienda.has(clave)) {
      fiabilidadPorTienda.set(clave, fila.reliability as string);
    }
  }

  const resumen = { stores: 0, detected: 0, written: 0 };

  for (const tienda of tiendas ?? []) {
    resumen.stores += 1;

    const { data, error } = await supabase.rpc("shopify_sales_daily", {
      target_organization_id: organizationId,
      period_start: desde.toISOString(),
      period_end: hasta.toISOString(),
      target_store_id: tienda.id,
    });

    if (error) {
      logger.error("shopify_sales_daily_failed", {
        organization_id: organizationId,
        store_id: tienda.id,
        error: error.message,
      });
      continue;
    }

    // El ultimo bucket es siempre el dia en curso, y un dia a medias no es un
    // dia bajo: a las nueve de la manana lleva un pedido y a las once de la
    // noche lleva veinte. El detector mira el ultimo punto de la serie, asi que
    // dejarlo dentro producia una caida de nivel falsa todos los dias, mayor
    // cuanto mas temprano corriera el cron. Se descarta por posicion y no por
    // fecha porque `shopify_sales_daily` agrupa en la zona horaria de la
    // tienda: comparar contra la medianoche UTC volveria a equivocarse en
    // cuanto la tienda no estuviera en Londres. Encontrado al encadenar D06,
    // que heredaba la senal falsa y formaba un sintoma con ella.
    const filas = ((data ?? []) as FilaDiaria[]).slice(0, -1);
    if (filas.length === 0) continue;

    for (const definicion of METRICAS) {
      const serie: SeriesPoint[] = filas.map((f) => ({
        date: f.bucket_date,
        value: Number(f[definicion.columna as keyof FilaDiaria] ?? 0),
        // El numero de pedidos ES el tamano de muestra de cualquier metrica
        // derivada de pedidos: de ahi sale el low_sample de los guardrails 21
        // y 22 sin inventarse nada.
        sample: Number(f.orders_count ?? 0),
      }));

      const exposure = exposicionPor.get(definicion.capability);
      const detectadas = detectSignals(definicion.metric, serie, {
        ...(exposure ? { exposure } : {}),
      });
      resumen.detected += detectadas.length;

      for (const s of detectadas) {
        const { error: errorInsert } = await supabase.from("signals").upsert(
          {
            organization_id: organizationId,
            store_id: tienda.id,
            signal_type: s.signal_type,
            anomaly_type: s.anomaly_type ?? null,
            capability: definicion.capability,
            metric: s.metric,
            scope: s.scope,
            direction: s.direction,
            observed_value: s.observed_value ?? null,
            baseline_value: s.baseline_value ?? null,
            magnitude_relative: s.magnitude_relative ?? null,
            expected_low: s.expected_low ?? null,
            expected_high: s.expected_high ?? null,
            window_start: serie[0]!.date,
            window_end: serie[serie.length - 1]!.date,
            persistence: s.persistence,
            regime: s.regime,
            baseline_kind: s.baseline_kind ?? null,
            sample_size: s.sample_size ?? null,
            low_sample: s.low_sample,
            statistical_method: s.statistical_method ?? null,
            statistical_strength: s.statistical_strength ?? null,
            business_relevance: s.business_relevance,
            business_exposure: s.business_exposure ?? null,
            // D01 ya evalua la fuente, asi que esto deja de ser una constante.
            // `unusable` no baja a `insufficient_data` porque la tabla solo lo
            // permite cuando la relevancia es baja: la senal existe, lo que no
            // aguanta es concluir sobre ella, y de eso se ocupa la puerta
            // `checkDataQualityGate` cuando llegue el diagnostico.
            data_confidence: confianzaDelDato(fiabilidadPorTienda.get(tienda.id)),
            // La del contexto es de D02, que sigue sin motor.
            context_confidence: "low",
            signal_confidence: s.low_sample ? "low" : "medium",
            description: s.description,
          },
          { onConflict: "organization_id,metric,scope,window_end,signal_type" },
        );

        if (errorInsert) {
          logger.error("signal_write_failed", {
            organization_id: organizationId,
            metric: s.metric,
            error: errorInsert.message,
          });
          continue;
        }
        resumen.written += 1;
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron). Cada organizacion falla o triunfa por separado: que una
 * tienda tenga la integracion rota no puede dejar sin senales a las demas.
 */
export async function runSignalEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) {
    throw new Error(`organizations_load_failed: ${error.message}`);
  }

  const summary = { organizations: 0, succeeded: 0, failed: 0, signals_written: 0 };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runSignalEngine(env, organization.id);
      summary.succeeded += 1;
      summary.signals_written += result.written;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("signal_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
