import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MEASUREMENT_EXPERIMENTATION_SOURCE_VERSION,
  measurementObservationFacts,
} from "./measurement-experimentation-engine.js";
import { buildMetaMeasurementVerdict, type MetaMeasurementEvidence } from "./meta-measurement-verdict.js";

type Row = Record<string, unknown>;
export type MetaMeasurementWindow = {
  target_organization_id: string;
  target_store_id: string | null;
  period_start: string;
  period_end: string;
};

/** Internal cap bounds memory; exceeding it is explicit incomplete evidence. */
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function loadMetaMeasurementPages(
  client: SupabaseClient,
  window: MetaMeasurementWindow,
  kind: "events" | "issues",
): Promise<{ data: Row[]; error: { message: string } | null; complete: boolean; next_cursor: string | null }> {
  const key = kind === "events" ? "ad_set_id" : "issue_id";
  const rpc = kind === "events" ? "meta_measurement_event_page" : "meta_measurement_issue_page";
  const cursorKey = kind === "events" ? "after_ad_set_id" : "after_issue_id";
  const rows: Row[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await (client as SupabaseClient<any>).rpc(rpc, {
      ...window, [cursorKey]: cursor, page_size: PAGE_SIZE,
    });
    if (result.error || !Array.isArray(result.data)) {
      return { data: rows, error: { message: "measurement_page_unavailable" }, complete: false, next_cursor: cursor };
    }
    const batch = result.data as Row[];
    for (const row of batch) {
      if (typeof row[key] !== "string" || seen.has(row[key] as string)) {
        return { data: rows, error: { message: "measurement_page_identity_invalid" }, complete: false, next_cursor: cursor };
      }
      seen.add(row[key] as string);
      rows.push(row);
    }
    if (batch.length < PAGE_SIZE) {
      const expected = kind === "events"
        ? Math.max(0, ...rows.map((row) => Number(row.eligible_ad_set_count ?? 0)))
        : rows.length;
      const complete = Number.isFinite(expected) && expected === rows.length;
      return {
        data: kind === "events" ? rows.map((row) => ({ ...row, ad_set_rows_truncated: !complete })) : rows,
        error: complete ? null : { message: "measurement_scope_changed_during_pagination" },
        complete,
        next_cursor: complete ? null : cursor,
      };
    }
    cursor = batch.at(-1)?.[key] as string;
  }
  return { data: rows, error: { message: "measurement_page_budget_exceeded" }, complete: false, next_cursor: cursor };
}

/** Repeated Shopify aggregates remain one observation, never one per ad set. */
export function compactMetaMeasurementContext(rows: Row[], complete: boolean, limit = 40) {
  const first = rows[0];
  const storeActivity = first
    ? Object.fromEntries(Object.entries(first).filter(([key]) => key.startsWith("store_") || key.startsWith("sessions_sync_") || key.startsWith("orders_sync_")))
    : null;
  return {
    store_activity: storeActivity,
    coverage: { fetched: rows.length, complete, presented: Math.min(rows.length, limit), presentation_truncated: rows.length > limit },
    entities: rows.slice(0, limit).map((row) => Object.fromEntries(
      Object.entries(row).filter(([key]) => !key.startsWith("store_") && !key.startsWith("sessions_sync_") && !key.startsWith("orders_sync_")),
    )),
    next_ad_set_id: rows.length > limit ? rows[limit - 1]?.ad_set_id ?? null : null,
    detail_tool: "meta_delivery_health",
  };
}

export function metaMeasurementEvidenceDetails(evidence: MetaMeasurementEvidence, evaluatedAt = new Date()) {
  const row = evidence.eventMapping.rows[0];
  const sessionsFresh = row?.sessions_sync_state === "fresh";
  const ordersFresh = row?.orders_sync_state === "fresh";
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value)
    ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
  const activity = row?.store_activity_evidence ?? "unknown_or_incomplete";
  const eventObserved = evidence.eventMapping.available && evidence.eventMapping.rows.some((item) => item.mapping_status === "mapped_event_observed");
  return {
    planes: {
      measurement: buildMetaMeasurementVerdict({ ...evidence, issues: { ...evidence.issues, rows: [] } }, evaluatedAt),
      delivery: {
        coverage_complete: evidence.issues.available && evidence.issueSnapshot?.rows.every((item) => item.complete === true) === true,
        rejected_ad_ids: evidence.issues.rows.filter((item) => item.review_category === "rejected" && item.freshness === "fresh").map((item) => item.ad_id).filter(Boolean),
      },
      learning: { source: "meta_reported_learning_status", entity_count: evidence.learning.rows.length, reset_inferred_from_activity: false },
    },
    capability_matrix: [
      { capability: "pixel_event_counts", state: eventObserved ? "observed" : "not_observed_or_unavailable", source: "meta_pixel_stats", verifies: "aggregate_event_observation" },
      ...["browser_server_origin", "event_deduplication", "match_quality", "event_value_currency", "store_domain_isolation"].map((capability) => ({
        capability, state: "requires_external_verification", source: "events_manager_or_authorized_evidence", verifies: null,
      })),
    ],
    measurement_engine: {
      source_version: MEASUREMENT_EXPERIMENTATION_SOURCE_VERSION,
      facts: measurementObservationFacts({
        sales: { available: ordersFresh, orders_count: ordersFresh ? finite(row?.store_orders_total) : null },
        funnel: { available: sessionsFresh, sessions: sessionsFresh ? finite(row?.store_sessions_total) : null, has_funnel_steps: null },
        daily: null,
      }),
      quality_state: "UNKNOWN",
      reconciliation: "coverage_context_only",
      store_activity: activity,
      purchase_comparison: "not_comparable_as_causal_or_one_to_one",
      metric_definitions: { shopify_orders: "non_test_non_cancelled_order_facts", meta_events: "observations_of_explicitly_promoted_event" },
      repair_authority: "meta_measurement_incidents",
    },
    action_limits: [
      "La cobertura del agregado Pixel no certifica el checkout ni el dominio de esta tienda.",
      "CAPI, deduplicación, coincidencia y valor/divisa del evento requieren evidencia adicional autorizada.",
    ],
  };
}
