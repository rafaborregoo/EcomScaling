/**
 * FASE 3 / D03 — El motor de madurez, conectado a datos reales.
 *
 * `observeMaturity` (en `@ecomscaling/contracts`) es puro. Este fichero es su
 * unica parte sucia, como los de `D01`, `D02`, `D05` y `D06`.
 *
 * LO QUE APORTA, en una frase: convierte "no conozco a este cliente" en **"el
 * dato demuestra estas siete capacidades y no puede ver estas ocho, y aqui
 * tienes el numero de por que"**. Eso es lo que le dice a un consultor donde
 * preguntar en la primera llamada.
 *
 * LO QUE NO HACE, Y ES LA DECISION DEL BLOQUE. No calcula `required_level` ni
 * emite hallazgos de brecha. El apartado 19 del artefacto dice que el algoritmo
 * de scoring, los umbrales y las ponderaciones **no estan definidos**;
 * inventarlos seria fabricar la respuesta y presentarla como derivada del
 * documento. La brecha la pone una persona, y la pantalla se lo pide.
 *
 * LO QUE EL DATO NO VE, NO SE ESCRIBE. Ni siquiera como `absent`: eso seria
 * afirmar que no existe. Las no observables salen con su motivo y su numero.
 *
 * UN PERFIL NUEVO SOLO SI CAMBIO ALGO. Y diciendo **que** clase de cambio fue:
 * que suba un nivel es el negocio; que empecemos a ver una capacidad que antes
 * no veiamos somos nosotros. Guardrail 28, que existe para que el sistema no
 * felicite a nadie por un progreso que no hubo.
 */
import { createClient } from "@supabase/supabase-js";
import {
  applyMaturityDeclarations,
  classifyProfileChange,
  maturityDeclarationSchema,
  observeMaturity,
  type MaturityDeclaration,
  type BusinessFacts,
  type CapabilityMaturity,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("maturity-engine");

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * La ventana sobre la que se mide la complejidad.
 *
 * Un ano y no toda la historia: el paso 2 pide la complejidad **actual**, y lo
 * que el negocio manejaba hace dos anos no es lo que maneja hoy. Un ano ademas
 * cubre el ciclo estacional entero, asi que ni premia ni castiga por caer en
 * temporada alta.
 */
export const VENTANA_DIAS = 365;

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type FilaHechos = Record<string, number | string | null>;

/** Lee los hechos medidos de una tienda. Agregacion en SQL (ADR-0006 punto 6). */
export async function leerHechos(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  storeId: string,
  now = new Date(),
): Promise<BusinessFacts | null> {
  const hasta = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const desde = new Date(hasta.getTime() - VENTANA_DIAS * DIA_MS);

  const { data, error } = await supabase.rpc("maturity_business_facts", {
    target_organization_id: organizationId,
    target_store_id: storeId,
    period_start: desde.toISOString(),
    period_end: hasta.toISOString(),
  });

  if (error) {
    logger.error("maturity_business_facts_failed", {
      organization_id: organizationId,
      store_id: storeId,
      error: error.message,
    });
    return null;
  }

  const fila = ((data ?? []) as FilaHechos[])[0];
  if (!fila) return null;

  const n = (clave: string) => Number(fila[clave] ?? 0);
  return {
    window_days: n("window_days"),
    orders: n("orders"),
    net_sales: n("net_sales"),
    orders_with_attribution: n("orders_with_attribution"),
    channels: n("channels"),
    currencies: n("currencies"),
    repeat_orders: n("repeat_orders"),
    orders_with_repeat_flag: n("orders_with_repeat_flag"),
    customers: n("customers"),
    repeat_customers: n("repeat_customers"),
    products: n("products"),
    variants: n("variants"),
    session_days: n("session_days"),
    sessions: n("sessions"),
    fulfillments: n("fulfillments"),
    fulfilled_orders: n("fulfilled_orders"),
    inventory_items: n("inventory_items"),
    inventory_items_with_cost: n("inventory_items_with_cost"),
    inventory_snapshots: n("inventory_snapshots"),
    discounts: n("discounts"),
    discounts_used: n("discounts_used"),
    active_months: n("active_months"),
  };
}

/** Pasa el motor sobre una organizacion. Devuelve lo que quedo escrito. */
/** Lo que sale de una declaracion del consultor, no del dato. */
function camposDeclarados(c: CapabilityMaturity) {
  return {
    required_level: c.required_level ?? null,
    finding: c.finding ?? null,
    gap_interpretation: c.gap_interpretation ?? null,
    influences_decisions: c.influences_decisions,
    has_ownership: c.has_ownership,
    owner_role: c.owner_role ?? null,
  };
}

export async function runMaturityEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const ahora = new Date().toISOString();
  const resumen = { stores: 0, profiles: 0, unchanged: 0, capabilities: 0, unobserved: 0 };

  const { data: tiendas, error: errorTiendas } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId);
  if (errorTiendas) throw new Error(`shopify_stores_load_failed: ${errorTiendas.message}`);

  const { data: filasDeclaradas, error: errorDeclaraciones } = await supabase
    .from("capability_maturity_declarations")
    .select("capability, influences_decisions, has_ownership, owner_role, note, required_level")
    .eq("organization_id", organizationId);
  if (errorDeclaraciones) {
    throw new Error(`maturity_declarations_load_failed: ${errorDeclaraciones.message}`);
  }
  // Una fila que ya no encaja en el contrato se ignora, no tumba la pasada.
  const declaraciones: MaturityDeclaration[] = (filasDeclaradas ?? []).flatMap((fila) => {
    const parsed = maturityDeclarationSchema.safeParse(fila);
    return parsed.success ? [parsed.data] : [];
  });

  for (const tienda of tiendas ?? []) {
    resumen.stores += 1;
    const storeId = tienda.id as string;

    const hechos = await leerHechos(supabase, organizationId, storeId);
    if (!hechos) continue;

    // Sin pedidos no hay nada que observar, y escribir un perfil vacio seria
    // decir que el negocio no tiene capacidades cuando lo que pasa es que no ha
    // vendido todavia.
    if (hechos.orders === 0) continue;

    const observacion = observeMaturity(hechos);
    resumen.unobserved += observacion.unobserved.length;
    // Lo que el dato no ve y un consultor ha declarado (guardrail 20).
    const observadas = applyMaturityDeclarations(observacion.observed, declaraciones);

    // El perfil vigente, con sus capacidades, para poder comparar.
    const { data: vigente } = await supabase
      .from("maturity_profiles")
      .select("id, confidence")
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .is("superseded_at", null)
      .maybeSingle();

    let previo: { capabilities: CapabilityMaturity[] } | null = null;
    if (vigente) {
      const { data: capacidadesPrevias } = await supabase
        .from("capability_maturity")
        .select("capability, current_level, confidence")
        .eq("profile_id", vigente.id as string);
      previo = {
        capabilities: (capacidadesPrevias ?? []) as unknown as CapabilityMaturity[],
      };
    }

    const cambio = classifyProfileChange(previo, { capabilities: observadas });
    if (!cambio) {
      // Nada se movio. No se escribe un perfil nuevo para repetir lo de ayer:
      // eso convertiria el historico en ruido y la supersesion en una mentira.
      // Lo declarado (nivel requerido, brecha, responsable) si se refresca en
      // el perfil vigente: cambiar lo que el negocio necesita no es que el
      // negocio haya cambiado.
      if (vigente) {
        for (const c of observadas) {
          await supabase
            .from("capability_maturity")
            .update(camposDeclarados(c))
            .eq("profile_id", vigente.id as string)
            .eq("capability", c.capability);
        }
      }
      resumen.unchanged += 1;
      continue;
    }

    // La confianza del perfil es la mas baja de sus capacidades: un perfil no
    // puede ser mas fiable que la pieza peor sostenida que contiene.
    const confianza = observadas.some((c) => c.confidence === "medium")
      ? observadas.every((c) => c.confidence === "medium")
        ? "medium"
        : "low"
      : "low";

    if (vigente) {
      const { error: errorSupersede } = await supabase
        .from("maturity_profiles")
        .update({ superseded_at: ahora })
        .eq("id", vigente.id as string);
      if (errorSupersede) {
        logger.error("maturity_profile_supersede_failed", {
          organization_id: organizationId,
          error: errorSupersede.message,
        });
        continue;
      }
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from("maturity_profiles")
      .insert({
        organization_id: organizationId,
        store_id: storeId,
        change_type: cambio.change_type,
        change_summary: cambio.change_summary,
        supersedes_id: vigente?.id ?? null,
        confidence: confianza,
        assessed_at: ahora,
      })
      .select("id")
      .single();

    if (errorPerfil || !perfil) {
      logger.error("maturity_profile_write_failed", {
        organization_id: organizationId,
        error: errorPerfil?.message,
      });
      continue;
    }
    resumen.profiles += 1;

    for (const c of observadas) {
      const { data: fila, error: errorCapacidad } = await supabase
        .from("capability_maturity")
        .insert({
          profile_id: perfil.id as string,
          capability: c.capability,
          current_level: c.current_level,
          // `expectation_band` se queda nulo: el artefacto no lo define.
          // `required_level` y la brecha solo existen si un consultor declaro
          // lo que este negocio necesita (camposDeclarados).
          ...camposDeclarados(c),
          has_existence: c.has_existence,
          has_consistency: c.has_consistency,
          has_repeatability: c.has_repeatability,
          has_measurement: c.has_measurement,
          confidence: c.confidence,
        })
        .select("id")
        .single();

      if (errorCapacidad || !fila) {
        logger.error("capability_maturity_write_failed", {
          organization_id: organizationId,
          capability: c.capability,
          error: errorCapacidad?.message,
        });
        continue;
      }
      resumen.capabilities += 1;

      if (c.evidence.length > 0) {
        const { error: errorEvidencia } = await supabase.from("maturity_evidence").insert(
          c.evidence.map((e) => ({
            capability_maturity_id: fila.id as string,
            evidence_type: e.evidence_type,
            description: e.description,
            source: e.source ?? null,
            observed_at: ahora,
            supports: e.supports,
            persistent: e.persistent,
          })),
        );
        if (errorEvidencia) {
          logger.error("maturity_evidence_write_failed", {
            organization_id: organizationId,
            capability: c.capability,
            error: errorEvidencia.message,
          });
        }
      }
    }
  }

  return resumen;
}

/**
 * Pasada global (cron). Es el unico motor de la fase que **no depende de los
 * otros**: mide el negocio, no sus movimientos. Puede correr el primero o el
 * ultimo; da igual.
 */
export async function runMaturityEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) throw new Error(`organizations_load_failed: ${error.message}`);

  const summary = { organizations: 0, succeeded: 0, failed: 0, profiles_written: 0 };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runMaturityEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.profiles_written += result.profiles;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("maturity_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }

  return summary;
}
