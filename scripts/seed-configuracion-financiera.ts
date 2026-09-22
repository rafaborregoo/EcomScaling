/**
 * Carga la configuracion financiera manual de una organizacion de pruebas:
 * ajustes (comisiones, IVA, envio), gastos fijos, reglas de envio, objetivos y
 * el coste unitario de cada inventory item.
 *
 * Sin esto, `shopify_financial_summary` y `shopify_margin_summary` no tienen
 * con que calcular: el beneficio neto sale como estimacion y el dashboard
 * avisa de "datos incompletos". No inventa ventas -- eso lo hace el sync o
 * seed-shopify-store.ts; esto solo pone el lado de los costes.
 *
 * Idempotente: reescribe exactamente las filas que siembra (identificadas por
 * nombre o por `valid_from`) y no toca nada que hayas anadido a mano.
 *
 * Uso (PowerShell):
 *   $env:ALLOW_FINANZAS_SEED="true"; npm run seed:finanzas
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ALLOW_FINANZAS_SEED: z.literal("true"),
  SUPABASE_PRODUCTION_PROJECT_REF: z.string().regex(/^[a-z0-9]{10,30}$/),
  SEED_ORG_SLUG: z.string().default("prueba-borrego"),
  // Margen bruto objetivo: el coste unitario sale de aplicar esto al precio de
  // la variante. 0.42 = 58% de margen bruto, tipico de marca propia.
  SEED_COGS_RATIO: z.coerce.number().min(0.05).max(0.95).default(0.42),
});

const env = envSchema.parse(process.env);
const targetProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error(
    "FINANZAS_SEED_PRODUCTION_PROJECT_REFUSED: este seed requiere un proyecto Supabase distinto de produccion",
  );
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as any },
});

// Fecha de inicio comun. Anterior a cualquier pedido que pueda existir, para
// que ningun coste quede fuera de vigencia y `items_without_cost` sea 0.
const VALID_FROM = "2024-01-01";

const GASTOS_FIJOS = [
  { name: "Shopify + apps", category: "software", amount: 289 },
  {
    name: "Suscripciones marketing (Klaviyo, Meta)",
    category: "software",
    amount: 412,
  },
  { name: "Agencia creatividades", category: "servicios", amount: 1500 },
  { name: "Almacen y logistica (fijo)", category: "logistica", amount: 950 },
  { name: "Nominas equipo", category: "personal", amount: 6800 },
  { name: "Gestoria y asesoria", category: "servicios", amount: 320 },
];

const REGLAS_ENVIO = [
  {
    name: "Peninsula",
    country_code: "ES",
    cost_per_order: 3.9,
    min_order_total: 0,
    max_order_total: null,
  },
  {
    name: "Peninsula - pedido grande",
    country_code: "ES",
    cost_per_order: 5.4,
    min_order_total: 80,
    max_order_total: null,
  },
  {
    name: "Resto UE",
    country_code: null,
    cost_per_order: 8.5,
    min_order_total: 0,
    max_order_total: null,
  },
];

const OBJETIVOS = [
  { metric_key: "net_revenue_ex_tax", target_value: 120000 },
  { metric_key: "net_profit", target_value: 24000 },
  { metric_key: "net_margin_pct", target_value: 20 },
  { metric_key: "aov_ex_tax", target_value: 62 },
  { metric_key: "orders_count", target_value: 1900 },
  { metric_key: "roas", target_value: 3.2 },
];

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, display_name, currency_code")
    .eq("slug", env.SEED_ORG_SLUG)
    .single();
  if (orgError || !org) {
    throw new Error(
      `No existe la organizacion "${env.SEED_ORG_SLUG}": ${orgError?.message ?? "not found"}`,
    );
  }
  const organizationId = org.id as string;
  const currency = (org.currency_code as string) ?? "EUR";

  // 1. Ajustes financieros (uno por organizacion).
  const { error: settingsError } = await supabase
    .from("organization_financial_settings")
    .upsert(
      {
        organization_id: organizationId,
        currency_code: currency,
        payment_fee_pct: 1.4,
        payment_fee_fixed: 0.25,
        default_shipping_cost: 4.5,
        vat_pct: 21,
        notes: "Configuracion de pruebas (seed-configuracion-financiera.ts).",
      },
      { onConflict: "organization_id" },
    );
  if (settingsError) {
    throw new Error(`Ajustes financieros: ${settingsError.message}`);
  }

  // 2. Gastos fijos. Se borran por nombre y se reinsertan, para no duplicar en
  //    cada ejecucion ni pisar lo que hayas anadido tu.
  const { error: deleteExpensesError } = await supabase
    .from("fixed_expenses")
    .delete()
    .eq("organization_id", organizationId)
    .in(
      "name",
      GASTOS_FIJOS.map((gasto) => gasto.name),
    );
  if (deleteExpensesError) {
    throw new Error(`Limpieza gastos fijos: ${deleteExpensesError.message}`);
  }

  const { error: expensesError } = await supabase.from("fixed_expenses").insert(
    GASTOS_FIJOS.map((gasto) => ({
      organization_id: organizationId,
      name: gasto.name,
      category: gasto.category,
      amount: gasto.amount,
      currency_code: currency,
      billing_period: "monthly",
      valid_from: VALID_FROM,
      is_active: true,
    })),
  );
  if (expensesError) {
    throw new Error(`Gastos fijos: ${expensesError.message}`);
  }

  // 3. Reglas de envio, mismo criterio.
  const { error: deleteRulesError } = await supabase
    .from("shipping_cost_rules")
    .delete()
    .eq("organization_id", organizationId)
    .in(
      "name",
      REGLAS_ENVIO.map((regla) => regla.name),
    );
  if (deleteRulesError) {
    throw new Error(`Limpieza reglas de envio: ${deleteRulesError.message}`);
  }

  const { error: rulesError } = await supabase
    .from("shipping_cost_rules")
    .insert(
      REGLAS_ENVIO.map((regla) => ({
        organization_id: organizationId,
        name: regla.name,
        country_code: regla.country_code,
        cost_per_order: regla.cost_per_order,
        currency_code: currency,
        min_order_total: regla.min_order_total,
        max_order_total: regla.max_order_total,
        valid_from: VALID_FROM,
        is_active: true,
      })),
    );
  if (rulesError) {
    throw new Error(`Reglas de envio: ${rulesError.message}`);
  }

  // 4. Objetivos por metrica. Sin `upsert`: la unicidad de esta tabla la da
  //    `organization_metric_targets_unique_scope`, un indice sobre una
  //    EXPRESION (coalesce(store_id, '000...')), y Postgres no puede inferirlo
  //    desde una lista de columnas -- `onConflict` devuelve 42P10. La API hace
  //    insert + captura del 23505 por lo mismo (financial-config.ts); aqui,
  //    que es un seed, basta con borrar las filas que siembra y reinsertarlas.
  const { error: deleteTargetsError } = await supabase
    .from("organization_metric_targets")
    .delete()
    .eq("organization_id", organizationId)
    .eq("valid_from", VALID_FROM)
    .in(
      "metric_key",
      OBJETIVOS.map((objetivo) => objetivo.metric_key),
    );
  if (deleteTargetsError) {
    throw new Error(`Limpieza objetivos: ${deleteTargetsError.message}`);
  }

  const { error: targetsError } = await supabase
    .from("organization_metric_targets")
    .insert(
      OBJETIVOS.map((objetivo) => ({
        organization_id: organizationId,
        metric_key: objetivo.metric_key,
        target_value: objetivo.target_value,
        period: "monthly",
        valid_from: VALID_FROM,
      })),
    );
  if (targetsError) {
    throw new Error(`Objetivos: ${targetsError.message}`);
  }

  // 5. Coste unitario de cada inventory item, derivado del precio de su
  //    variante. Sin esto `items_without_cost` > 0 y el margen sale incompleto.
  const { data: items, error: itemsError } = await supabase
    .from("shopify_inventory_items")
    .select("id, sku, variant_id")
    .eq("organization_id", organizationId);
  if (itemsError) {
    throw new Error(`Inventory items: ${itemsError.message}`);
  }

  const variantIds = (items ?? [])
    .map((item) => item.variant_id)
    .filter(Boolean) as string[];
  const { data: variants, error: variantsError } = variantIds.length
    ? await supabase
        .from("shopify_variants")
        .select("id, current_price")
        .in("id", variantIds)
    : { data: [], error: null };
  if (variantsError) {
    throw new Error(`Variantes: ${variantsError.message}`);
  }

  const priceByVariant = new Map(
    (variants ?? []).map((variant) => [
      variant.id as string,
      Number(variant.current_price ?? 0),
    ]),
  );

  const { error: deleteCostsError } = await supabase
    .from("product_costs")
    .delete()
    .eq("organization_id", organizationId)
    .eq("valid_from", VALID_FROM);
  if (deleteCostsError) {
    throw new Error(`Limpieza costes: ${deleteCostsError.message}`);
  }

  const costRows = (items ?? []).map((item) => {
    const price = priceByVariant.get(item.variant_id as string) ?? 0;
    // Sin precio conocido no se inventa un coste proporcional: 12 es un valor
    // plano y declarado, preferible a un 0 que fingiria margen del 100%.
    const unitCost =
      price > 0 ? Number((price * env.SEED_COGS_RATIO).toFixed(2)) : 12;
    return {
      organization_id: organizationId,
      inventory_item_id: item.id,
      unit_cost: unitCost,
      currency_code: currency,
      source: "manual",
      is_override: false,
      valid_from: VALID_FROM,
    };
  });

  if (costRows.length) {
    const { error: costsError } = await supabase
      .from("product_costs")
      .insert(costRows);
    if (costsError) {
      throw new Error(`Costes de producto: ${costsError.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        organizacion: org.display_name,
        moneda: currency,
        gastos_fijos: GASTOS_FIJOS.length,
        gasto_fijo_mensual: GASTOS_FIJOS.reduce(
          (total, gasto) => total + gasto.amount,
          0,
        ),
        reglas_envio: REGLAS_ENVIO.length,
        objetivos: OBJETIVOS.length,
        costes_cargados: costRows.length,
        costes_sin_precio_de_referencia: costRows.filter(
          (row) => row.unit_cost === 12,
        ).length,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
