import crypto from "node:crypto";

export const ENORA_SCENARIO_ID = "enora_12m_v1";
export const ENORA_SOURCE = "synthetic";
export const ENORA_NORMALIZED_CURRENCY = "EUR";
export const ENORA_NORMALIZED_TIMEZONE = "Europe/Madrid";
export const ENORA_PROVIDER_SHOP_TIMEZONE = "EDT";
export const ENORA_PROVIDER_SHOP_DOMAIN = "e-nora-demo.myshopify.com";
export const ENORA_META_AD_ACCOUNT_ID = "946548861093802";
export const ENORA_SEED_START = "2025-10-04";
export const ENORA_SEED_END = "2026-10-03";

export type EnoraProduct = {
  externalProductId: string;
  externalVariantId: string;
  title: string;
  handle: string;
  productType: string;
  sku: string;
  price: number;
  syntheticUnitCost: number;
  weight: number;
};

export const ENORA_PRODUCTS: readonly EnoraProduct[] = [
  {
    externalProductId: "gid://shopify/Product/15838521557369",
    externalVariantId: "gid://shopify/ProductVariant/64771681059193",
    title: "Sudadera Oversize Arena",
    handle: "en-demo-sudadera-oversize-arena",
    productType: "Sudaderas",
    sku: "EN-DEMO-SUD-001",
    price: 58,
    syntheticUnitCost: 20.3,
    weight: 18,
  },
  {
    externalProductId: "gid://shopify/Product/15838521590137",
    externalVariantId: "gid://shopify/ProductVariant/64771681091961",
    title: "Camiseta Básica Niebla",
    handle: "en-demo-camiseta-basica-niebla",
    productType: "Camisetas",
    sku: "EN-DEMO-CAM-002",
    price: 29,
    syntheticUnitCost: 8.7,
    weight: 22,
  },
  {
    externalProductId: "gid://shopify/Product/15838521622905",
    externalVariantId: "gid://shopify/ProductVariant/64771681124729",
    title: "Pantalón Cargo Oliva",
    handle: "en-demo-pantalon-cargo-oliva",
    productType: "Pantalones",
    sku: "EN-DEMO-PAN-003",
    price: 64,
    syntheticUnitCost: 23.7,
    weight: 16,
  },
  {
    externalProductId: "gid://shopify/Product/15838521655673",
    externalVariantId: "gid://shopify/ProductVariant/64771681157497",
    title: "Chaqueta Boreal Negra",
    handle: "en-demo-chaqueta-boreal-negra",
    productType: "Chaquetas",
    sku: "EN-DEMO-CHA-004",
    price: 119,
    syntheticUnitCost: 47.6,
    weight: 10,
  },
  {
    externalProductId: "gid://shopify/Product/15838521721209",
    externalVariantId: "gid://shopify/ProductVariant/64771681223033",
    title: "Gorra Costa Cruda",
    handle: "en-demo-gorra-costa-cruda",
    productType: "Accesorios",
    sku: "EN-DEMO-GOR-005",
    price: 24,
    syntheticUnitCost: 6,
    weight: 12,
  },
  {
    externalProductId: "gid://shopify/Product/15838521753977",
    externalVariantId: "gid://shopify/ProductVariant/64771681255801",
    title: "Bolso Mini Bruma",
    handle: "en-demo-bolso-mini-bruma",
    productType: "Accesorios",
    sku: "EN-DEMO-BOL-006",
    price: 39,
    syntheticUnitCost: 12.5,
    weight: 9,
  },
  {
    externalProductId: "gid://shopify/Product/15838521786745",
    externalVariantId: "gid://shopify/ProductVariant/64771681288569",
    title: "Sudadera Capucha Arcilla",
    handle: "en-demo-sudadera-capucha-arcilla",
    productType: "Sudaderas",
    sku: "EN-DEMO-SUD-007",
    price: 68,
    syntheticUnitCost: 24.5,
    weight: 8,
  },
  {
    externalProductId: "gid://shopify/Product/15838521819513",
    externalVariantId: "gid://shopify/ProductVariant/64771681321337",
    title: "Calcetín Rib Menta",
    handle: "en-demo-calcetin-rib-menta",
    productType: "Accesorios",
    sku: "EN-DEMO-CAL-008",
    price: 12,
    syntheticUnitCost: 2.6,
    weight: 5,
  },
] as const;

export const META_CAMPAIGNS = [
  { key: "prospecting", name: "E-NORA · Prospecting · Sales", weight: 0.55 },
  { key: "retargeting", name: "E-NORA · Retargeting · Sales", weight: 0.3 },
  { key: "creative_test", name: "E-NORA · Creative Test · Sales", weight: 0.15 },
] as const;

export type ScenarioKind =
  | "baseline"
  | "black_friday"
  | "creative_fatigue"
  | "checkout_friction"
  | "email_recovery"
  | "tracking_anomaly"
  | "scaling"
  | "stockout"
  | "deliverability_issue"
  | "recovery";

export type SeedOrder = {
  externalOrderId: string;
  orderName: string;
  customerKey: string;
  channel: "meta" | "klaviyo" | "organic";
  metaCampaignKey?: string;
  klaviyoCampaignKey?: string;
  product: EnoraProduct;
  quantity: number;
  grossSales: number;
  discount: number;
  netSales: number;
  processedAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
};

export type MetaDaily = {
  campaignKey: string;
  impressions: number;
  reach: number;
  spend: number;
  clicks: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  attributedRevenue: number;
  frequency: number;
  ctr: number;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
};

export type KlaviyoDaily = {
  campaignKey: string;
  recipients: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  purchases: number;
  attributedRevenue: number;
};

export type EnoraDay = {
  date: string;
  scenario: ScenarioKind;
  shopify: {
    sessions: number;
    visitors: number;
    cartAdditions: number;
    reachedCheckout: number;
    completedCheckout: number;
    orders: number;
    revenue: number;
  };
  meta: MetaDaily[];
  klaviyo: KlaviyoDaily;
  orders: SeedOrder[];
};

function seedFromText(value: string) {
  return crypto.createHash("sha256").update(value).digest().readUInt32BE(0);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(start: string, end: string) {
  const out: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) out.push(date);
  return out;
}

export function scenarioForDate(date: string): ScenarioKind {
  if (date >= "2025-11-15" && date <= "2025-12-02") return "black_friday";
  if (date >= "2026-01-16" && date <= "2026-02-15") return "creative_fatigue";
  if (date >= "2026-02-16" && date <= "2026-03-15") return "checkout_friction";
  if (date >= "2026-03-16" && date <= "2026-04-15") return "email_recovery";
  if (date >= "2026-04-16" && date <= "2026-05-10") return "tracking_anomaly";
  if (date >= "2026-05-11" && date <= "2026-06-30") return "scaling";
  if (date >= "2026-07-01" && date <= "2026-07-20") return "stockout";
  if (date >= "2026-09-01" && date <= "2026-09-15") return "deliverability_issue";
  if (date >= "2026-09-16") return "recovery";
  return "baseline";
}

function pickWeightedProduct(rand: () => number, scenario: ScenarioKind) {
  const weights = ENORA_PRODUCTS.map((p) => {
    if (scenario === "stockout" && p.sku === "EN-DEMO-CHA-004") return 0.2;
    if (scenario === "black_friday" && p.sku === "EN-DEMO-SUD-001") return p.weight * 1.7;
    return p.weight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let target = rand() * total;
  for (let i = 0; i < ENORA_PRODUCTS.length; i += 1) {
    target -= weights[i] ?? 0;
    if (target <= 0) return ENORA_PRODUCTS[i]!;
  }
  return ENORA_PRODUCTS[0]!;
}

function campaignForMonth(date: string) {
  const month = date.slice(0, 7).replace("-", "");
  return `enora_email_${month}_promo`;
}

function orderTimestamp(date: string, index: number) {
  const hour = 9 + (index * 7) % 13;
  const minute = (index * 17) % 60;
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+02:00`;
}

function makeOrders(
  date: string,
  scenario: ScenarioKind,
  channel: SeedOrder["channel"],
  count: number,
  rand: () => number,
  startIndex: number,
  channelKey?: string,
) {
  const orders: SeedOrder[] = [];
  for (let i = 0; i < count; i += 1) {
    const orderIndex = startIndex + i;
    const product = pickWeightedProduct(rand, scenario);
    const quantity = rand() < 0.12 ? 2 : 1;
    const discountRate =
      scenario === "black_friday" ? 0.18 : rand() < 0.08 ? 0.1 : 0;
    const grossSales = round2(product.price * quantity);
    const discount = round2(grossSales * discountRate);
    const netSales = round2(grossSales - discount);
    const customerNumber = 1 + Math.floor(rand() * 240);
    const customerKey = `syn_customer_${String(customerNumber).padStart(4, "0")}`;
    const externalOrderId = `syn_order_${date.replaceAll("-", "")}_${String(orderIndex).padStart(4, "0")}`;
    const meta = channel === "meta";
    const email = channel === "klaviyo";
    const utmCampaign = meta
      ? `enora_meta_${channelKey}`
      : email
        ? channelKey ?? campaignForMonth(date)
        : null;
    orders.push({
      externalOrderId,
      orderName: `#SYN-${date.replaceAll("-", "")}-${String(orderIndex).padStart(4, "0")}`,
      customerKey,
      channel,
      metaCampaignKey: meta ? channelKey : undefined,
      klaviyoCampaignKey: email ? channelKey : undefined,
      product,
      quantity,
      grossSales,
      discount,
      netSales,
      processedAt: orderTimestamp(date, orderIndex),
      utmSource: meta ? "facebook" : email ? "klaviyo" : null,
      utmMedium: meta ? "paid_social" : email ? "email" : null,
      utmCampaign,
      utmContent: meta ? `${channelKey}_creative_a` : email ? "primary_cta" : null,
    });
  }
  return orders;
}

function sumRevenue(orders: SeedOrder[]) {
  return round2(orders.reduce((sum, order) => sum + order.netSales, 0));
}

export function generateEnoraScenario(
  start = ENORA_SEED_START,
  end = ENORA_SEED_END,
): EnoraDay[] {
  const rand = mulberry32(seedFromText(`${ENORA_SCENARIO_ID}:${start}:${end}`));
  const days: EnoraDay[] = [];

  for (const date of daysInclusive(start, end)) {
    const scenario = scenarioForDate(date);
    const dow = new Date(date + "T12:00:00Z").getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.88 : 1.04;
    const progress = daysInclusive(start, date).length / Math.max(1, daysInclusive(start, end).length);

    let trafficFactor = 0.9 + progress * 0.28;
    let cpm = 10.5;
    let ctr = 0.019;
    let lpvRate = 0.84;
    let atcRate = 0.105;
    let checkoutRate = 0.56;
    let purchaseRate = 0.61;
    let emailClickRate = 0.032;
    let emailPurchaseRate = 0.16;
    let emailBounceRate = 0.012;
    let emailUnsubRate = 0.0018;

    if (scenario === "black_friday") {
      trafficFactor *= 1.95;
      cpm = 17.5;
      ctr = 0.027;
      atcRate = 0.14;
      purchaseRate = 0.68;
      emailClickRate = 0.052;
      emailPurchaseRate = 0.21;
    } else if (scenario === "creative_fatigue") {
      cpm = 15.8;
      ctr = 0.011;
      lpvRate = 0.77;
    } else if (scenario === "checkout_friction") {
      checkoutRate = 0.37;
      purchaseRate = 0.33;
    } else if (scenario === "email_recovery") {
      emailClickRate = 0.048;
      emailPurchaseRate = 0.22;
    } else if (scenario === "tracking_anomaly") {
      lpvRate = 0.56;
    } else if (scenario === "scaling") {
      trafficFactor *= 1.35;
      cpm = 9.4;
      ctr = 0.024;
      purchaseRate = 0.67;
    } else if (scenario === "stockout") {
      purchaseRate = 0.43;
      atcRate = 0.13;
    } else if (scenario === "deliverability_issue") {
      emailBounceRate = 0.075;
      emailUnsubRate = 0.009;
      emailClickRate = 0.014;
      emailPurchaseRate = 0.09;
    } else if (scenario === "recovery") {
      cpm = 9.8;
      ctr = 0.023;
      emailClickRate = 0.039;
    }

    const metaRows: MetaDaily[] = [];
    let orderIndex = 1;
    const orders: SeedOrder[] = [];

    for (const campaign of META_CAMPAIGNS) {
      const campaignQuality =
        campaign.key === "retargeting" ? 1.22 : campaign.key === "creative_test" ? 0.86 : 1;
      const impressions = Math.max(
        800,
        Math.round((11_500 * trafficFactor * weekend * campaign.weight) * (0.92 + rand() * 0.16)),
      );
      const campaignCpm = cpm * (campaign.key === "retargeting" ? 0.92 : 1) * (0.92 + rand() * 0.16);
      const spend = round2((impressions / 1000) * campaignCpm);
      const campaignCtr = clamp(ctr * campaignQuality * (0.88 + rand() * 0.24), 0.004, 0.08);
      const clicks = Math.max(1, Math.round(impressions * campaignCtr));
      const linkClicks = Math.max(1, Math.round(clicks * 0.84));
      const outboundClicks = Math.max(1, Math.round(linkClicks * 0.92));
      const landingPageViews = Math.max(0, Math.round(outboundClicks * lpvRate * (0.95 + rand() * 0.08)));
      const addToCarts = Math.max(0, Math.round(landingPageViews * atcRate * campaignQuality));
      const checkouts = Math.max(0, Math.min(addToCarts, Math.round(addToCarts * checkoutRate)));
      const purchases = Math.max(0, Math.min(checkouts, Math.round(checkouts * purchaseRate * campaignQuality)));
      const campaignOrders = makeOrders(
        date,
        scenario,
        "meta",
        purchases,
        rand,
        orderIndex,
        campaign.key,
      );
      orderIndex += campaignOrders.length;
      orders.push(...campaignOrders);
      const attributedRevenue = sumRevenue(campaignOrders);
      const reach = Math.max(1, Math.round(impressions / clamp(1.35 + rand() * 0.55, 1, 4)));
      metaRows.push({
        campaignKey: campaign.key,
        impressions,
        reach,
        spend,
        clicks,
        linkClicks,
        outboundClicks,
        landingPageViews,
        addToCarts,
        checkouts,
        purchases,
        attributedRevenue,
        frequency: round6(impressions / reach),
        ctr: round6((clicks / impressions) * 100),
        cpc: clicks > 0 ? round6(spend / clicks) : null,
        cpm: impressions > 0 ? round6((spend / impressions) * 1000) : null,
        cpa: purchases > 0 ? round6(spend / purchases) : null,
        roas: spend > 0 ? round6(attributedRevenue / spend) : null,
      });
    }

    const recipients = Math.max(400, Math.round(1650 * trafficFactor * (0.94 + rand() * 0.12)));
    const bounces = Math.max(0, Math.round(recipients * emailBounceRate));
    const delivered = Math.max(0, recipients - bounces);
    const opens = Math.max(0, Math.round(delivered * (0.39 + rand() * 0.08)));
    const emailClicks = Math.max(0, Math.round(delivered * emailClickRate * (0.9 + rand() * 0.2)));
    const emailPurchases = Math.max(0, Math.round(emailClicks * emailPurchaseRate));
    const emailCampaignKey = campaignForMonth(date);
    const emailOrders = makeOrders(
      date,
      scenario,
      "klaviyo",
      emailPurchases,
      rand,
      orderIndex,
      emailCampaignKey,
    );
    orderIndex += emailOrders.length;
    orders.push(...emailOrders);
    const unsubscribes = Math.max(0, Math.round(delivered * emailUnsubRate));
    const emailRevenue = sumRevenue(emailOrders);

    const metaLpv = metaRows.reduce((sum, row) => sum + row.landingPageViews, 0);
    const metaAtc = metaRows.reduce((sum, row) => sum + row.addToCarts, 0);
    const metaCheckout = metaRows.reduce((sum, row) => sum + row.checkouts, 0);
    const organicSessions = Math.max(90, Math.round(220 * trafficFactor * weekend * (0.9 + rand() * 0.2)));
    const organicPurchases = Math.max(1, Math.round(organicSessions * (scenario === "checkout_friction" ? 0.014 : 0.027)));
    const organicOrders = makeOrders(date, scenario, "organic", organicPurchases, rand, orderIndex);
    orders.push(...organicOrders);

    const sessions = metaLpv + emailClicks + organicSessions;
    const visitors = Math.max(1, Math.round(sessions * 0.83));
    const cartAdditions = metaAtc + Math.round(emailClicks * 0.12) + Math.round(organicSessions * 0.09);
    const reachedCheckout = metaCheckout + Math.round(emailClicks * 0.07) + Math.round(organicSessions * 0.05);
    const completedCheckout = orders.length;

    days.push({
      date,
      scenario,
      shopify: {
        sessions,
        visitors,
        cartAdditions,
        reachedCheckout: Math.max(completedCheckout, reachedCheckout),
        completedCheckout,
        orders: orders.length,
        revenue: sumRevenue(orders),
      },
      meta: metaRows,
      klaviyo: {
        campaignKey: emailCampaignKey,
        recipients,
        delivered,
        opens,
        clicks: emailClicks,
        unsubscribes,
        bounces,
        purchases: emailOrders.length,
        attributedRevenue: emailRevenue,
      },
      orders,
    });
  }

  return days;
}

export const META_DERIVED_FORMULAS = {
  frequency: "impressions / reach",
  ctr: "(clicks / impressions) * 100",
  cpc: "spend / clicks",
  cpm: "(spend / impressions) * 1000",
  cpa: "spend / purchases",
  roas: "attributed_revenue / spend",
} as const;
