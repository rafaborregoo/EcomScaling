import {
  validateRetentionCrmPlaybookTemplate,
  type PlaybookFrameworkInputLike,
  type PlaybookTemplate,
  type PlaybookTriState,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import {
  buildPlaybookContext,
  parseActivePlaybookTemplates,
  runPlaybookFrameworkEngine,
  runPlaybookFrameworkEngineForAllOrganizations,
} from "./playbook-engine.js";

const RETENTION_SOURCE_VERSION = "f5-p05.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type RetentionCrmEvidence = {
  customers?: {
    customer_count?: number | null;
    repeat_customers?: number | null;
    stateful_customers?: number | null;
  } | null;
  sales?: { orders_count?: number | null; refunds?: number | null } | null;
  margin?: { items_with_cost?: number | null; gross_margin?: number | null } | null;
  crm?: { account_count?: number | null; flows_count?: number | null; campaigns_count?: number | null } | null;
  consent?: { consent_events?: number | null } | null;
};

export function buildRetentionCrmPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "retention-crm-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p05"),
    source_versions: [...(base.source_versions ?? []), RETENTION_SOURCE_VERSION],
    facts: {
      ...base.facts,
      "retention.customer_base.available": UNKNOWN,
      "retention.repeat.observed": UNKNOWN,
      "retention.cohorts.observed": UNKNOWN,
      "retention.lifecycle.state_observed": UNKNOWN,
      "retention.economics.contribution.available": UNKNOWN,
      "retention.crm.capabilities.available": UNKNOWN,
      "retention.consent.observed": UNKNOWN,
      "retention.experience.refunds_available": UNKNOWN,
      "retention.ltv.observed": UNKNOWN,
      "retention.churn.threshold_defined": UNKNOWN,
      "retention.subscription.observed": UNKNOWN,
      "retention.incrementality.supported": UNKNOWN,
      "retention.customer_quality.available": UNKNOWN,
    },
  };
}

function observed(value: number | null | undefined): PlaybookTriState {
  return value === null || value === undefined ? UNKNOWN : value > 0 ? "TRUE" : "FALSE";
}

/** Declara cobertura real de datos; no deriva churn, LTV ni causalidad. */
export function applyRetentionCrmEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: RetentionCrmEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const customers = evidence.customers;
  const facts = {
    ...context.facts,
    "retention.customer_base.available": observed(customers?.customer_count),
    "retention.repeat.observed": customers?.customer_count && customers.repeat_customers !== null && customers.repeat_customers !== undefined
      ? "TRUE"
      : UNKNOWN,
    "retention.cohorts.observed": UNKNOWN,
    "retention.lifecycle.state_observed": observed(customers?.stateful_customers),
    "retention.economics.contribution.available": observed(evidence.margin?.items_with_cost),
    "retention.crm.capabilities.available": observed(evidence.crm?.account_count),
    "retention.consent.observed": observed(evidence.consent?.consent_events),
    "retention.experience.refunds_available": evidence.sales ? "TRUE" : UNKNOWN,
    "retention.ltv.observed": UNKNOWN,
    "retention.churn.threshold_defined": UNKNOWN,
    "retention.subscription.observed": UNKNOWN,
    "retention.incrementality.supported": UNKNOWN,
    "retention.customer_quality.available": UNKNOWN,
  } satisfies Record<string, PlaybookTriState>;
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts,
  };
}

async function enrichRetentionCrmContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const period = { gte: periodStart.toISOString(), lte: periodEnd.toISOString() };
  const salesArgs = {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    target_store_id: null,
  };
  const [customersResult, repeatResult, stateResult, salesResult, marginResult, accountResult, flowsResult, campaignsResult, consentResult] = await Promise.all([
    supabase.from("shopify_customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("shopify_customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true).gt("number_of_orders", 1),
    supabase.from("shopify_customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true).not("state", "is", null),
    supabase.rpc("shopify_sales_summary", salesArgs),
    supabase.rpc("shopify_margin_summary", salesArgs),
    supabase.from("klaviyo_accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("klaviyo_flows").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("klaviyo_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("send_time", "is", null),
    supabase.from("klaviyo_tracking_consents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("occurred_at", period.gte).lte("occurred_at", period.lte),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  return applyRetentionCrmEvidence(
    context,
    {
      customers: customersResult.error || repeatResult.error || stateResult.error
        ? null
        : { customer_count: customersResult.count, repeat_customers: repeatResult.count, stateful_customers: stateResult.count },
      sales: salesResult.error ? null : first(salesResult),
      margin: marginResult.error ? null : first(marginResult),
      crm: accountResult.error || flowsResult.error || campaignsResult.error
        ? null
        : { account_count: accountResult.count, flows_count: flowsResult.count, campaigns_count: campaignsResult.count },
      consent: consentResult.error ? null : { consent_events: consentResult.count },
    },
    [
      !customersResult.error && !repeatResult.error && !stateResult.error ? `shopify_customers:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !marginResult.error ? `shopify_margin_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !accountResult.error && !flowsResult.error && !campaignsResult.error ? `klaviyo_configuration:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !consentResult.error ? `klaviyo_tracking_consents:${organizationId}:${context.as_of.slice(0, 10)}` : "",
    ].filter(Boolean),
  );
}

function retentionCrmTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "RETENTION_CRM" && validateRetentionCrmPlaybookTemplate(template).valid;
}

const retentionCrmOptions = {
  domain: "RETENTION_CRM",
  contextBuilder: buildRetentionCrmPlaybookContext,
  contextEnricher: enrichRetentionCrmContext,
  templateFilter: retentionCrmTemplateFilter,
};

export function runRetentionCrmPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, retentionCrmOptions);
}

export function runRetentionCrmPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, retentionCrmOptions);
}

export { parseActivePlaybookTemplates };
