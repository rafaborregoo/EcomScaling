/**
 * AI-06 (P0): primera version real del dataset de evaluacion de A02 (monitor
 * de negocio), el agente con mas impacto comercial y menos control segun
 * AI-06-evaluaciones-calidad.md. No sustituye el dataset completo de 30-50
 * casos que pide el documento, pero es la primera vez que A02 se ejecuta de
 * verdad (LLM real, no mock) contra escenarios controlados con checks
 * automatizados en vez de revisión manual.
 *
 * Escenarios cubiertos (5, ampliado 2026-07-22 con los 2 casos que pedia
 * explicitamente AI-06-evaluaciones-calidad.md: "stock roto" y "falsos
 * positivos deliberados"):
 *  1. Organizacion recien conectada sin ningun dato (Shopify sin sincronizar
 *     todavia) -- el agente no deberia inventar cifras.
 *  2. Tienda con ventas reales pero sin configuracion financiera --
 *     `has_settings=false`; el agente no deberia afirmar un margen neto
 *     concreto como hecho sin avisar del hueco de datos.
 *  3. Tienda sana con ventas y configuracion financiera completas -- caso
 *     base, findings deben venir con sources.
 *  4. Stock roto: un producto con demanda alta y stock casi agotado
 *     (`shopify_stock_risk_products` real, no mock) -- el agente deberia
 *     detectar y priorizar el riesgo de quiebre.
 *  5. Falso positivo deliberado: un producto con stock amplio y ventas bajas
 *     -- el agente NO deberia inventar una alerta urgente de stock para el.
 *
 * Los checks se dividen en dos tipos:
 *  - "hard" (deterministicos, sobre el evidence pack o el schema validado
 *    por runAgentTurn, no dependen del LLM): fallan el eval si no se
 *    cumplen.
 *  - "soft" (heuristicas sobre el texto libre del LLM, ej. si menciona la
 *    falta de configuracion): se reportan pero no hacen fallar el eval solo
 *    ellas -- el proceso de "regresion obligatoria" que pide AI-06 (dataset
 *    -> shadow -> canary) es el sitio para endurecerlas con mas casos, no
 *    esto.
 *
 * Cuesta llamadas reales a Anthropic (dinero) -- no correr en cada PR.
 * Ejecutar manualmente con `npm run eval:a02 -w @ecomscaling/api`.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runMonitorAgent } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-a02-monitor");

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

// Forma minima que necesitamos leer del output validado por runAgentTurn
// (ya paso agentOutputSchema + checkOutputSanity antes de llegar aqui).
type AgentOutputShape = {
  answer: string;
  findings: Array<{ title: string; severity: string; evidence: string }>;
  recommendations: unknown[];
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  warnings: string[];
  confidence: string;
};

// agent_runs.actor_user_id tiene FK real a public.profiles (que a su vez
// exige auth.users) -- no basta con un UUID inventado como en un mock,
// necesitamos un usuario efimero real (mismo patron que
// rls-tenant-isolation.test.ts).
async function createEvalUser() {
  const email = `eval-a02-${RUN_TAG}@ecomscaling.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Eval-A02-${RUN_TAG}!`,
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
      display_name: `Eval A02 ${label} ${RUN_TAG}`,
      slug: `eval-a02-${label}-${RUN_TAG}`,
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
      myshopify_domain: `eval-a02-${label}-${RUN_TAG}.myshopify.com`,
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

async function seedOrders(
  organizationId: string,
  storeId: string,
  orders: Array<{ grossSales: number; discounts: number; netSales: number }>,
) {
  const now = new Date();
  const rows = orders.map((order, index) => ({
    organization_id: organizationId,
    store_id: storeId,
    external_order_id: `eval-order-${RUN_TAG}-${index}`,
    order_name: `#EVAL-${index}`,
    financial_status: "paid",
    currency_code: "EUR",
    gross_sales: order.grossSales,
    discounts: order.discounts,
    refunds: 0,
    net_sales: order.netSales,
    current_total_price: order.netSales,
    total_items: 1,
    is_test_order: false,
    processed_at: new Date(now.getTime() - index * 60 * 60 * 1000).toISOString(),
    external_created_at: new Date(now.getTime() - index * 60 * 60 * 1000).toISOString(),
  }));

  const { error } = await admin.from("shopify_order_facts").insert(rows);
  if (error) {
    throw new Error(`No se pudieron sembrar pedidos de eval: ${error.message}`);
  }
}

function hasKeyword(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

/**
 * Siembra un producto con su stock disponible y N unidades vendidas en los
 * ultimos 30 dias, para que `shopify_stock_risk_products` (contexto real de
 * A02/A06) lo cruce. Necesita el arbol completo Shopify (location, product,
 * variant, inventory_item, inventory_current_state) + pedidos/order_items
 * reales -- no un mock, la funcion SQL hace joins reales sobre estas tablas.
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
    description: "Organizacion recien conectada, Shopify sin sincronizar todavia (sin pedidos, sin config financiera).",
    setup: async () => {
      const organizationId = await createEvalOrg("sin-datos");
      await createShopifyStore(organizationId, "sin-datos");
      return { organizationId };
    },
    checks: (output) => {
      const allText = [output.answer, ...output.warnings, ...output.findings.map((f) => f.evidence)].join(" ");
      return [
        {
          name: "no reporta ventas concretas sin datos",
          type: "hard",
          pass: !/\d+[.,]\d{2}\s*(€|eur)/i.test(allText) && !/\d{2,}\s*(pedidos|ordenes)/i.test(allText),
          detail: "El answer/evidence no deberia citar cifras de ventas/pedidos concretas cuando no hay datos.",
        },
        {
          name: "menciona falta de datos o necesidad de sincronizar",
          type: "soft",
          pass: hasKeyword(allText, ["sin datos", "no hay datos", "sincroniz", "conectar", "no se ha", "sin ventas", "sin pedidos"]),
          detail: "Heuristica de texto libre -- util para detectar regresiones, no un contrato estricto.",
        },
        {
          name: "confidence baja o media (no alta) sin datos",
          type: "soft",
          pass: output.confidence !== "high",
          detail: `confidence reportada: ${output.confidence}`,
        },
      ];
    },
  },
  {
    name: "sin_configuracion_financiera",
    description: "Tienda con ventas reales (5 pedidos, ~450 EUR) pero sin organization_financial_settings.",
    setup: async () => {
      const organizationId = await createEvalOrg("sin-config-fin");
      const storeId = await createShopifyStore(organizationId, "sin-config-fin");
      await seedOrders(
        organizationId,
        storeId,
        Array.from({ length: 5 }, () => ({ grossSales: 100, discounts: 10, netSales: 90 })),
      );
      return { organizationId };
    },
    checks: (output) => {
      const allText = [output.answer, ...output.warnings, ...output.findings.map((f) => f.evidence)].join(" ");
      return [
        {
          name: "no afirma un margen neto o beneficio neto concreto sin avisar",
          type: "soft",
          pass:
            !/margen\s+net[oa]\s+(es|de)\s+\d/i.test(allText) && !/beneficio\s+net[oa]\s+(es|de)\s+\d/i.test(allText) ||
            hasKeyword(allText, ["sin configurar", "falta config", "configuracion financiera", "no hay costes", "sin costes"]),
          detail: "Si afirma un margen/beneficio concreto, deberia venir acompañado de un aviso de que falta configuracion.",
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
  {
    name: "tienda_sana",
    description: "Tienda con ventas, config financiera y gastos fijos completos.",
    setup: async () => {
      const organizationId = await createEvalOrg("sana");
      const storeId = await createShopifyStore(organizationId, "sana");
      await seedOrders(
        organizationId,
        storeId,
        Array.from({ length: 10 }, () => ({ grossSales: 120, discounts: 10, netSales: 110 })),
      );
      const { error: financialError } = await admin
        .from("organization_financial_settings")
        .insert({ organization_id: organizationId, currency_code: "EUR", payment_fee_pct: 2, vat_pct: 21 });
      if (financialError) {
        throw new Error(`No se pudo crear configuracion financiera de eval: ${financialError.message}`);
      }
      const { error: expenseError } = await admin
        .from("fixed_expenses")
        .insert({ organization_id: organizationId, name: "Software", amount: 50 });
      if (expenseError) {
        throw new Error(`No se pudo crear gasto fijo de eval: ${expenseError.message}`);
      }
      return { organizationId };
    },
    checks: (output) => [
      {
        name: "sources no vacio si hay findings",
        type: "hard",
        pass: output.findings.length === 0 || output.sources.length > 0,
        detail: `findings=${output.findings.length}, sources=${output.sources.length}`,
      },
      {
        name: "evidence de cada finding no esta vacia",
        type: "hard",
        pass: output.findings.every((f) => f.evidence.trim().length > 0),
        detail: "Cada finding debe traer una cifra/periodo concreto, no texto vacio.",
      },
      {
        name: "respuesta no esta vacia",
        type: "hard",
        pass: output.answer.trim().length > 0,
        detail: "answer vacio ya lo bloquea checkOutputSanity, esto es una doble confirmacion aqui.",
      },
    ],
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
          name: "menciona el riesgo de quiebre de stock",
          type: "soft",
          pass: hasKeyword(allText, ["quiebre", "stock", "agotar", "sin stock", "riesgo de rotura", "reponer", "reabastec"]),
          detail: "Heuristica de texto libre -- deberia mencionar el riesgo de quiebre del producto sembrado.",
        },
        {
          name: "algun finding tiene severidad alta o critica",
          type: "soft",
          pass: output.findings.some((f) => ["high", "critical"].includes(f.severity)),
          detail: `severidades reportadas: ${output.findings.map((f) => f.severity).join(", ") || "ninguna"}`,
        },
      ];
    },
  },
  {
    name: "falso_positivo_stock_sano",
    description:
      "Producto con stock amplio (500 unidades) y ventas muy bajas (3 unidades en 30 dias) -- no hay riesgo real de quiebre; el agente NO deberia inventar una alerta urgente de stock para este producto.",
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
    const result = await runMonitorAgent(env, context, organizationId, null, 30);

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

// AI-06 (P0, "Presupuesto maximo de coste y latencia" en Entregables): los
// primeros 2 quality gates deterministicos del dataset. No sustituyen el
// proceso completo dataset->shadow->canary que pide el documento, pero son
// umbrales explicitos y accionables, no heuristica de texto -- si una
// version de prompt dispara el coste/latencia de un diagnostico, el eval
// falla igual que un check de groundedness. Umbrales fijados con margen
// generoso sobre la primera corrida real (max visto: ~$0.037, ~20s).
const MAX_COST_PER_SCENARIO_USD = 0.15;
const MAX_LATENCY_PER_SCENARIO_MS = 45_000;
// Umbral de calidad sobre los checks "soft" (heuristicas de texto): no
// bloquea el eval por si solo (siguen siendo heuristica, no contrato), pero
// si mas de un tercio de los checks soft fallan en una corrida, es una señal
// real de regresion de calidad que merece revision antes de promover la
// version de prompt -- se reporta como advertencia explicita, no en silencio.
const SOFT_FAILURE_RATE_WARNING_THRESHOLD = 1 / 3;

async function main() {
  logger.info("Starting AI-06 eval: A02 monitor de negocio", { scenarios: SCENARIOS.map((s) => s.name) });

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
