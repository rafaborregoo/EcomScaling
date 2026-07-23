/**
 * AI-06: dataset de A06 (planificador de stock) era el ultimo hueco explicito
 * que pedia este documento ("falta todavia dataset de A06"). Mismo patron que
 * `eval-a02-monitor.ts`: LLM real (no mock), escenarios controlados con datos
 * Shopify reales sembrados (arbol completo location/product/variant/
 * inventory_item/inventory_current_state), checks "hard" (deterministicos)
 * y "soft" (heuristicas de texto), quality gates de coste/latencia.
 *
 * A06 corre en evidence-pack puro (sin `sql_select`, el cruce stock/venta ya
 * llega resuelto via `shopify_stock_risk_products`, ver comentario de
 * `runStockPlannerAgent` en ai-runtime.ts -- el mismo incidente que motivo el
 * mismo cambio en A02).
 *
 * Escenarios cubiertos (3, los mismos tipos de caso que motivaron el fix de
 * `shopify_stock_risk_products` en AI-05 y que ya se usan para A02):
 *  1. Sin datos: tienda conectada sin ningun producto/stock sembrado -- el
 *     agente no deberia inventar cifras de stock ni proponer reposicion de
 *     productos que no existen.
 *  2. Stock roto: producto con demanda alta (40 unidades vendidas/30d) y
 *     stock casi agotado (2 disponibles) -- riesgo real de quiebre que el
 *     agente deberia detectar y priorizar con severidad alta.
 *  3. Falso positivo deliberado: producto con stock amplio (500) y ventas
 *     bajas (3/30d) -- el agente NO deberia proponer una reposicion urgente
 *     para el.
 *
 * Cuesta llamadas reales a Anthropic/OpenAI (dinero) -- no correr en cada PR.
 * Ejecutar manualmente con `npm run eval:a06 -w @ecomscaling/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runStockPlannerAgent } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-a06-stock-planner");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;

type Check = { name: string; type: "hard" | "soft"; pass: boolean; detail: string };

type Scenario = {
  name: string;
  description: string;
  setup: () => Promise<{ organizationId: string }>;
  checks: (output: AgentOutputShape) => Check[];
};

type AgentOutputShape = {
  answer: string;
  findings: Array<{ title: string; severity: string; evidence: string }>;
  recommendations: unknown[];
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  warnings: string[];
  confidence: string;
};

async function createEvalUser() {
  const email = `eval-a06-${RUN_TAG}@ecomscaling.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Eval-A06-${RUN_TAG}!`,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de eval: ${error?.message}`);
  }
  const { error: roleError } = await admin
    .from("profiles")
    .update({ platform_role: "platform_admin" })
    .eq("id", data.user.id);
  if (roleError) {
    throw new Error(`No se pudo fijar el rol del usuario de eval: ${roleError.message}`);
  }
  return data.user.id as string;
}

function fakeAuthContext(organizationId: string, actorUserId: string): AuthContext {
  return {
    user: { id: actorUserId, email: "eval-harness@ecomscaling.internal" },
    profile: {
      id: actorUserId,
      full_name: "Eval Harness",
      avatar_url: null,
      platform_role: "platform_admin",
      is_active: true,
    },
    memberships: [{ organization_id: organizationId, role: "owner", organization: null }],
    subscriptions: [],
  };
}

async function createEvalOrg(label: string) {
  const { data, error } = await admin
    .from("organizations")
    .insert({
      display_name: `Eval A06 ${label} ${RUN_TAG}`,
      slug: `eval-a06-${label}-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`No se pudo crear la organizacion de eval (${label}): ${error?.message}`);
  }
  return data.id as string;
}

async function createShopifyStore(organizationId: string, label: string) {
  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({ organization_id: organizationId, provider: "shopify", status: "connected" })
    .select("id")
    .single();
  if (connectionError || !connection) {
    throw new Error(`No se pudo crear la conexion de eval (${label}): ${connectionError?.message}`);
  }

  const { data: store, error: storeError } = await admin
    .from("shopify_stores")
    .insert({
      organization_id: organizationId,
      connection_id: connection.id,
      external_shop_id: `eval-shop-${label}-${RUN_TAG}`,
      myshopify_domain: `eval-a06-${label}-${RUN_TAG}.myshopify.com`,
      shop_name: `Eval Shop ${label}`,
      currency_code: "EUR",
    })
    .select("id")
    .single();
  if (storeError || !store) {
    throw new Error(`No se pudo crear la tienda de eval (${label}): ${storeError?.message}`);
  }
  return store.id as string;
}

function hasKeyword(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

/**
 * Siembra un producto con su stock disponible y N unidades vendidas en los
 * ultimos 30 dias, para que `shopify_stock_risk_products` (contexto real de
 * A06) lo cruce. Arbol completo Shopify (location/product/variant/
 * inventory_item/inventory_current_state) + pedido/order_item reales -- no un
 * mock, la funcion SQL hace joins reales sobre estas tablas. Mismo helper que
 * `eval-a02-monitor.ts`, duplicado aqui porque cada eval script de esta ronda
 * es autocontenido (patron ya establecido, no hay modulo compartido de evals).
 */
async function seedProductWithStock(
  organizationId: string,
  storeId: string,
  label: string,
  params: { title: string; availableQuantity: number; unitsSold: number },
) {
  const { data: location, error: locationError } = await admin
    .from("shopify_locations")
    .insert({
      organization_id: organizationId,
      store_id: storeId,
      external_location_id: `eval-location-${label}-${RUN_TAG}`,
      name: `Eval Location ${label}`,
    })
    .select("id")
    .single();
  if (locationError || !location) {
    throw new Error(`No se pudo crear la ubicacion de eval (${label}): ${locationError?.message}`);
  }

  const { data: product, error: productError } = await admin
    .from("shopify_products")
    .insert({
      organization_id: organizationId,
      store_id: storeId,
      external_product_id: `eval-product-${label}-${RUN_TAG}`,
      title: params.title,
    })
    .select("id")
    .single();
  if (productError || !product) {
    throw new Error(`No se pudo crear el producto de eval (${label}): ${productError?.message}`);
  }

  const { data: variant, error: variantError } = await admin
    .from("shopify_variants")
    .insert({
      organization_id: organizationId,
      product_id: product.id,
      external_variant_id: `eval-variant-${label}-${RUN_TAG}`,
      title: "Default",
    })
    .select("id")
    .single();
  if (variantError || !variant) {
    throw new Error(`No se pudo crear la variante de eval (${label}): ${variantError?.message}`);
  }

  const { data: inventoryItem, error: inventoryItemError } = await admin
    .from("shopify_inventory_items")
    .insert({
      organization_id: organizationId,
      variant_id: variant.id,
      external_inventory_item_id: `eval-inventory-item-${label}-${RUN_TAG}`,
      tracked: true,
    })
    .select("id")
    .single();
  if (inventoryItemError || !inventoryItem) {
    throw new Error(`No se pudo crear el item de inventario de eval (${label}): ${inventoryItemError?.message}`);
  }

  const { error: stockError } = await admin.from("shopify_inventory_current_state").insert({
    organization_id: organizationId,
    inventory_item_id: inventoryItem.id,
    location_id: location.id,
    available_quantity: params.availableQuantity,
    is_active: true,
  });
  if (stockError) {
    throw new Error(`No se pudo crear el estado de inventario de eval (${label}): ${stockError.message}`);
  }

  if (params.unitsSold > 0) {
    const { data: order, error: orderError } = await admin
      .from("shopify_order_facts")
      .insert({
        organization_id: organizationId,
        store_id: storeId,
        external_order_id: `eval-stock-order-${label}-${RUN_TAG}`,
        order_name: `#EVAL-STOCK-${label}`,
        financial_status: "paid",
        currency_code: "EUR",
        gross_sales: params.unitsSold * 20,
        discounts: 0,
        refunds: 0,
        net_sales: params.unitsSold * 20,
        current_total_price: params.unitsSold * 20,
        total_items: params.unitsSold,
        is_test_order: false,
        processed_at: new Date().toISOString(),
        external_created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (orderError || !order) {
      throw new Error(`No se pudo crear el pedido de stock de eval (${label}): ${orderError?.message}`);
    }

    const { error: orderItemError } = await admin.from("shopify_order_items").insert({
      organization_id: organizationId,
      order_id: order.id,
      product_id: product.id,
      variant_id: variant.id,
      external_line_item_id: `eval-stock-line-${label}-${RUN_TAG}`,
      title: params.title,
      quantity_original: params.unitsSold,
      quantity_current: params.unitsSold,
      unit_price: 20,
      original_line_total: params.unitsSold * 20,
      current_line_total: params.unitsSold * 20,
    });
    if (orderItemError) {
      throw new Error(`No se pudo crear la linea de pedido de eval (${label}): ${orderItemError.message}`);
    }
  }
}

const SCENARIOS: Scenario[] = [
  {
    name: "sin_datos",
    description: "Tienda conectada sin ningun producto/stock sembrado -- el agente no deberia inventar cifras de stock.",
    setup: async () => {
      const organizationId = await createEvalOrg("sin-datos");
      await createShopifyStore(organizationId, "sin-datos");
      return { organizationId };
    },
    checks: (output) => {
      const allText = [output.answer, ...output.warnings, ...output.findings.map((f) => f.evidence)].join(" ");
      return [
        {
          name: "no reporta unidades de stock/venta concretas (mayores que cero) sin datos",
          type: "hard",
          // "0 unidades" es una afirmacion verdadera (no hay productos); solo
          // una cifra positiva inventada seria una alucinacion real.
          pass: !/[1-9]\d*\s*(unidades|uds\.?)\s+(disponibles|en stock|vendidas)/i.test(allText),
          detail: "El answer/evidence no deberia citar cifras de stock/ventas positivas cuando no hay productos sembrados.",
        },
        {
          name: "ninguna recomendacion propone una cantidad de reposicion inventada",
          type: "hard",
          // Una recomendacion operativa generica (ej. "verificar que el
          // tracking de inventario este activo") es un consejo razonable
          // ante la falta de datos, no una alucinacion -- lo que si seria
          // una alucinacion real es proponer reponer N unidades de un
          // producto que no existe.
          pass: !output.recommendations.some((r) => /\d+\s*(unidades|uds\.?)\s*(a pedir|de reposicion|a reponer|para reponer|de reorden)/i.test(JSON.stringify(r))),
          detail: `recommendations=${JSON.stringify(output.recommendations)}`,
        },
        {
          name: "menciona falta de datos o de productos",
          type: "soft",
          pass: hasKeyword(allText, ["sin datos", "no hay productos", "sin productos", "no se ha", "sin stock", "sin ventas", "sincroniz"]),
          detail: "Heuristica de texto libre -- util para detectar regresiones, no un contrato estricto.",
        },
      ];
    },
  },
  {
    name: "stock_roto",
    description:
      "Producto con demanda alta (40 unidades vendidas en 30 dias) y stock disponible casi agotado (2 unidades) -- riesgo real de quiebre que el agente deberia detectar y priorizar.",
    setup: async () => {
      const organizationId = await createEvalOrg("stock-roto");
      const storeId = await createShopifyStore(organizationId, "stock-roto");
      await seedProductWithStock(organizationId, storeId, "roto", {
        title: "Zapatilla Eval Alta Rotacion",
        availableQuantity: 2,
        unitsSold: 40,
      });
      return { organizationId };
    },
    checks: (output) => {
      const allText = [output.answer, ...output.findings.map((f) => f.evidence)].join(" ");
      return [
        {
          name: "sources no vacio si hay findings",
          type: "hard",
          pass: output.findings.length === 0 || output.sources.length > 0,
          detail: `findings=${output.findings.length}, sources=${output.sources.length}`,
        },
        {
          name: "menciona el riesgo de quiebre de stock del producto sembrado",
          type: "soft",
          pass: hasKeyword(allText, ["zapatilla", "quiebre", "agotar", "sin stock", "riesgo de rotura", "reponer", "reabastec"]),
          detail: "Heuristica de texto libre -- deberia mencionar el riesgo de quiebre del producto sembrado.",
        },
        {
          name: "algun finding tiene severidad alta o critica",
          type: "soft",
          pass: output.findings.some((f) => ["high", "critical"].includes(f.severity)),
          detail: `severidades reportadas: ${output.findings.map((f) => f.severity).join(", ") || "ninguna"}`,
        },
        {
          name: "propone al menos una recomendacion de reposicion",
          type: "soft",
          pass: output.recommendations.length > 0,
          detail: `recommendations=${output.recommendations.length}`,
        },
      ];
    },
  },
  {
    name: "falso_positivo_stock_sano",
    description:
      "Producto con stock amplio (500 unidades) y ventas muy bajas (3 unidades en 30 dias) -- no hay riesgo real de quiebre; el agente NO deberia proponer una reposicion urgente para este producto.",
    setup: async () => {
      const organizationId = await createEvalOrg("stock-sano");
      const storeId = await createShopifyStore(organizationId, "stock-sano");
      await seedProductWithStock(organizationId, storeId, "sano", {
        title: "Camiseta Eval Stock Sano",
        availableQuantity: 500,
        unitsSold: 3,
      });
      return { organizationId };
    },
    checks: (output) => {
      const stockFindings = output.findings.filter((f) =>
        hasKeyword(f.title + " " + f.evidence, ["camiseta eval stock sano", "quiebre", "agotar"]),
      );
      return [
        {
          name: "no reporta quiebre de stock urgente para un producto con stock sano",
          type: "soft",
          pass: !stockFindings.some((f) => ["high", "critical"].includes(f.severity)),
          detail: `findings relacionados con el producto sembrado: ${JSON.stringify(stockFindings)}`,
        },
        {
          name: "sources no vacio si hay findings",
          type: "hard",
          pass: output.findings.length === 0 || output.sources.length > 0,
          detail: `findings=${output.findings.length}, sources=${output.sources.length}`,
        },
      ];
    },
  },
];

async function runScenario(scenario: Scenario, actorUserId: string) {
  const { organizationId } = await scenario.setup();
  try {
    const context = fakeAuthContext(organizationId, actorUserId);
    const result = await runStockPlannerAgent(env, context, organizationId, null, 30);

    if (!result.ok) {
      return {
        scenario: scenario.name,
        error: result,
        checks: [] as Check[],
      };
    }

    const output = result.data.output as AgentOutputShape;
    const checks = scenario.checks(output);
    return { scenario: scenario.name, output, checks, usage: result.data.usage };
  } finally {
    await admin.from("organizations").delete().eq("id", organizationId);
  }
}

// Mismos umbrales que eval-a02-monitor.ts (AI-06, "Presupuesto maximo de
// coste y latencia") -- consistencia entre datasets de agentes del mismo tipo
// (diagnostico evidence-pack), no un ajuste especifico de A06.
const MAX_COST_PER_SCENARIO_USD = 0.15;
const MAX_LATENCY_PER_SCENARIO_MS = 45_000;
const SOFT_FAILURE_RATE_WARNING_THRESHOLD = 1 / 3;

async function main() {
  logger.info("Starting AI-06 eval: A06 planificador de stock", { scenarios: SCENARIOS.map((s) => s.name) });

  const actorUserId = await createEvalUser();
  let hardFailures = 0;
  let softFailures = 0;
  let totalSoftChecks = 0;
  let totalCostUsd = 0;
  const gateViolations: string[] = [];

  try {
    for (const scenario of SCENARIOS) {
      console.log(`\n=== ${scenario.name} ===`);
      console.log(scenario.description);

      const result = await runScenario(scenario, actorUserId);

      if ("error" in result) {
        console.log(`RUN FAILED: ${JSON.stringify(result.error)}`);
        hardFailures += 1;
        continue;
      }

      if (result.usage) {
        totalCostUsd += result.usage.estimated_cost_usd;
        console.log(`usage: ${JSON.stringify(result.usage)}`);

        if (result.usage.estimated_cost_usd > MAX_COST_PER_SCENARIO_USD) {
          const violation = `[GATE FAIL] ${scenario.name}: coste $${result.usage.estimated_cost_usd} supera el umbral $${MAX_COST_PER_SCENARIO_USD}`;
          console.log(violation);
          gateViolations.push(violation);
          hardFailures += 1;
        }

        if (result.usage.latency_ms > MAX_LATENCY_PER_SCENARIO_MS) {
          const violation = `[GATE FAIL] ${scenario.name}: latencia ${result.usage.latency_ms}ms supera el umbral ${MAX_LATENCY_PER_SCENARIO_MS}ms`;
          console.log(violation);
          gateViolations.push(violation);
          hardFailures += 1;
        }
      }

      for (const check of result.checks) {
        const marker = check.pass ? "PASS" : "FAIL";
        console.log(`[${check.type.toUpperCase()} ${marker}] ${check.name} -- ${check.detail}`);
        if (check.type === "soft") totalSoftChecks += 1;
        if (!check.pass) {
          if (check.type === "hard") hardFailures += 1;
          else softFailures += 1;
        }
      }
    }
  } finally {
    await admin.auth.admin.deleteUser(actorUserId);
  }

  const softFailureRate = totalSoftChecks > 0 ? softFailures / totalSoftChecks : 0;

  console.log(`\n=== Resumen ===`);
  console.log(`Coste total estimado: $${totalCostUsd.toFixed(4)}`);
  console.log(`Fallos hard (bloqueantes): ${hardFailures}`);
  console.log(`Fallos soft (heuristicas): ${softFailures}/${totalSoftChecks} (${(softFailureRate * 100).toFixed(0)}%)`);

  if (softFailureRate > SOFT_FAILURE_RATE_WARNING_THRESHOLD) {
    console.log(
      `ADVERTENCIA DE CALIDAD: tasa de fallos soft (${(softFailureRate * 100).toFixed(0)}%) supera el umbral de revision (${(SOFT_FAILURE_RATE_WARNING_THRESHOLD * 100).toFixed(0)}%). Revisar antes de promover esta version de prompt.`,
    );
  }

  if (gateViolations.length > 0) {
    console.log(`\nQuality gates deterministicos violados: ${gateViolations.length}`);
  }

  if (hardFailures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("AI-06 eval crashed", error);
  process.exit(1);
});
