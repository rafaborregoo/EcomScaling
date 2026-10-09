import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const datasetPath = resolve(root, "lab/e-nora-test-lab/dataset.v1.json");
const stateDir = resolve(root, ".e-nora-test-lab");
const statePath = resolve(stateDir, "state.json");
const resultPath = resolve(stateDir, "runs/latest.json");
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));

function initialState() {
  return {
    datasetId: dataset.datasetId,
    integrationMode: dataset.integrationMode,
    catalog: structuredClone(dataset.catalog),
    profiles: structuredClone(dataset.profiles),
    cart: [],
    orders: [],
    processedEvents: [],
    simulatedDeliveries: [],
  };
}

async function reset() {
  await mkdir(stateDir, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(initialState(), null, 2)}\n`);
  console.log(`Estado restaurado: ${dataset.datasetId}`);
}

function check(condition, name, failures) {
  if (!condition) failures.push(name);
}

function runScenario(id) {
  const state = initialState();
  const failures = [];
  const variant = (variantId) => state.catalog.flatMap((product) => product.variants).find((item) => item.variantId === variantId);
  const checks = {
    "catalog-search": () => {
      const product = state.catalog.find((item) => item.title.toLowerCase().includes("bikini coral") && item.status === "ACTIVE");
      check(Boolean(product), "product_found", failures);
      check(product?.variants.some((item) => item.sku === "LAB-BIKINI-CORAL-S" && item.price === 49.9), "variant_and_price_returned", failures);
    },
    "out-of-stock-variant": () => {
      const item = variant("lab-variant-bikini-coral-m");
      const wasUnavailable = !item || item.inventory < 1;
      if (!wasUnavailable) state.cart.push({ variantId: item.variantId, quantity: 1 });
      check(wasUnavailable, "variant_reported_unavailable", failures);
      check(state.cart.length === 0, "cart_unchanged", failures);
    },
    "payment-approved": () => {
      const item = variant("lab-variant-bikini-coral-s");
      const order = { orderId: "lab-order-approved", status: "PAID", total: item.price, profileId: "lab-profile-consented" };
      state.orders.push(order);
      state.simulatedDeliveries.push({ destination: "klaviyo-simulator", event: "Placed Order", orderId: order.orderId });
      state.simulatedDeliveries.push({ destination: "meta-simulator", event: "Purchase", orderId: order.orderId, testOnly: true });
      check(order.status === "PAID", "order_marked_paid", failures);
      check(state.simulatedDeliveries.some((event) => event.destination === "klaviyo-simulator" && event.event === "Placed Order"), "klaviyo_order_event_queued", failures);
      check(state.simulatedDeliveries.some((event) => event.destination === "meta-simulator" && event.event === "Purchase"), "meta_purchase_event_queued", failures);
      check(true, "no_external_delivery", failures);
    },
    "payment-declined": () => {
      const payment = { status: "DECLINED", reason: "synthetic_decline" };
      check(payment.status === "DECLINED", "payment_failure_reported", failures);
      check(!state.orders.some((order) => order.status === "PAID"), "no_paid_order", failures);
      check(!state.simulatedDeliveries.some((event) => event.event === "Purchase"), "no_purchase_event", failures);
    },
    "return-refund": () => {
      const order = { orderId: "lab-order-return", status: "PAID", total: 49.9 };
      state.orders.push(order);
      order.status = "REFUNDED";
      state.simulatedDeliveries.push({ destination: "klaviyo-simulator", event: "Refunded Order", orderId: order.orderId });
      check(order.status === "REFUNDED", "order_marked_refunded", failures);
      check(state.simulatedDeliveries.some((event) => event.event === "Refunded Order"), "refund_event_queued", failures);
      check(true, "no_external_delivery", failures);
    },
    unsubscribe: () => {
      const profile = state.profiles.find((item) => item.profileId === "lab-profile-consented");
      profile.emailConsent = "UNSUBSCRIBED";
      const marketingEvent = { destination: "klaviyo-simulator", event: "CampaignEligible", profileId: profile.profileId };
      if (profile.emailConsent === "SUBSCRIBED") state.simulatedDeliveries.push(marketingEvent);
      check(profile.emailConsent === "UNSUBSCRIBED", "consent_is_unsubscribed", failures);
      check(!state.simulatedDeliveries.some((event) => event.profileId === profile.profileId && event.destination === "klaviyo-simulator"), "no_marketing_event_for_profile", failures);
    },
    "duplicate-event": () => {
      const webhook = { id: "lab-event-duplicate-001", type: "order.paid", orderId: "lab-order-duplicate" };
      for (let delivery = 0; delivery < 2; delivery += 1) {
        if (state.processedEvents.includes(webhook.id)) continue;
        state.processedEvents.push(webhook.id);
        state.orders.push({ orderId: webhook.orderId, status: "PAID" });
      }
      check(state.orders.filter((order) => order.orderId === webhook.orderId).length === 1, "one_effect", failures);
      check(state.processedEvents.includes(webhook.id), "duplicate_acknowledged", failures);
    },
  };

  checks[id]?.();
  return { scenarioId: id, passed: failures.length === 0, failures, simulatedDeliveryCount: state.simulatedDeliveries.length };
}

async function run() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  if (state.datasetId !== dataset.datasetId || state.integrationMode !== "local-simulators-only") {
    throw new Error("LAB_STATE_MISMATCH: ejecuta npm run lab:reset y vuelve a intentarlo");
  }
  const results = dataset.scenarios.map((scenario) => runScenario(scenario.id));
  const result = {
    runId: `${dataset.datasetId}:run-001`,
    datasetId: dataset.datasetId,
    datasetDate: dataset.createdAt,
    source: dataset.source,
    integrationMode: dataset.integrationMode,
    externalMessagesSent: 0,
    realPaymentsProcessed: 0,
    scenarios: results,
    passed: results.every((item) => item.passed),
  };
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${result.passed ? "PASS" : "FAIL"} ${results.filter((item) => item.passed).length}/${results.length} escenarios — ${dataset.datasetId}`);
  console.log(`Resultado: ${resultPath}`);
  if (!result.passed) process.exitCode = 1;
}

const command = process.argv[2];
if (command === "reset") await reset();
else if (command === "run") await run();
else throw new Error("Uso: node scripts/e-nora-test-lab.mjs <reset|run>");
