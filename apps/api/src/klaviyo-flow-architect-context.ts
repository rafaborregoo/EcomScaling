import { readKlaviyoFlowDefinitionSummary } from "./klaviyo-flow-definition-summary.js";
import { A28_METRIC_VOLUME_STALE_MS, readKlaviyoFlowMetricRefs, readStoredKlaviyoMetricVolumes, summarizeStoredKlaviyoMetricVolumes } from "./klaviyo-flow-event-volume.js";
import { readKlaviyoFlowGraph } from "./klaviyo-flow-graph.js";

type Row = Record<string, unknown>;

export type KlaviyoFlowInventoryInput = {
  accounts: unknown[];
  flows: unknown[];
  actions: unknown[];
  messages: unknown[];
  selectedStoreId: string | null;
  loadErrors?: string[];
  triggerEventVolumes?: unknown[];
  triggerEventVolumeStatus?: string;
  triggerEventVolumePeriod?: { start: string; end: string };
  triggerEventMetricsTruncated?: boolean;
  now?: number;
  maxFlows?: number;
  maxActionsPerFlow?: number;
  queryTruncation?: { accounts?: boolean; flows?: boolean; actions?: boolean; messages?: boolean };
};

/**
 * Bounded, content-free inventory for A28. Klaviyo names/triggers are labels
 * authored in the merchant account, not instructions; message bodies/settings
 * are intentionally excluded.
 */
export function summarizeKlaviyoFlowInventory(
  input: KlaviyoFlowInventoryInput,
) {
  const now = input.now ?? Date.now();
  const maxFlows = Math.min(100, Math.max(1, input.maxFlows ?? 60));
  const maxActionsPerFlow = Math.min(
    12,
    Math.max(1, input.maxActionsPerFlow ?? 8),
  );
  const errors = (input.loadErrors ?? [])
    .map((error) => error.slice(0, 120))
    .slice(0, 4);
  const accounts = input.accounts.flatMap((value) => {
    const row = asRow(value);
    const id = text(row?.id, 64);
    if (!row || !id) return [];
    if (input.selectedStoreId && row.store_id !== input.selectedStoreId)
      return [];
    return [
      { id, store_id: text(row.store_id, 64), name: text(row.name, 120) },
    ];
  });
  const accountIds = new Set(accounts.map((account) => account.id));
  const accountName = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const flows = input.flows.flatMap((value) => {
    const row = asRow(value);
    const id = text(row?.id, 64);
    const accountId = text(row?.account_id, 64);
    const name = text(row?.name, 180);
    if (!row || !id || !accountId || !name || !accountIds.has(accountId))
      return [];
    return [
      {
        id,
        account_id: accountId,
        account_name: accountName.get(accountId) ?? null,
        name,
        status: text(row.status, 40),
        trigger_type: text(row.trigger_type, 120),
        last_synced_at: text(row.last_synced_at, 64),
        updated_at_external: text(row.updated_at_external, 64),
        definition_graph_synced_at: text(row.definition_graph_synced_at, 64),
        structure: readKlaviyoFlowDefinitionSummary(row.raw_data),
        graph: safeGraphTopology(readKlaviyoFlowGraph(row.definition_graph)),
        metricRefs: readKlaviyoFlowMetricRefs(row.raw_data),
        freshMetricRefs: readStoredKlaviyoMetricVolumes(row.raw_data)
          .filter((volume) => now - Date.parse(volume.fetched_at) <= A28_METRIC_VOLUME_STALE_MS)
          .map((volume) => volume.metric_id),
        eventVolumeSummary: summarizeStoredKlaviyoMetricVolumes(
          row.raw_data,
          now,
        ),
      },
    ];
  });
  const flowIds = new Set(flows.map((flow) => flow.id));
  const actionsByFlow = new Map<string, Row[]>();
  for (const value of input.actions) {
    const row = asRow(value);
    const flowId = text(row?.flow_id, 64);
    if (!row || !flowId || !flowIds.has(flowId)) continue;
    const list = actionsByFlow.get(flowId) ?? [];
    list.push(row);
    actionsByFlow.set(flowId, list);
  }
  const messagesByFlow = new Map<string, number>();
  for (const value of input.messages) {
    const row = asRow(value);
    const flowId = text(row?.flow_id, 64);
    if (flowId && flowIds.has(flowId))
      messagesByFlow.set(flowId, (messagesByFlow.get(flowId) ?? 0) + 1);
  }
  const activeFlows = flows.filter(
    (flow) =>
      !flow.status || !/^(archived|deleted|removed)$/i.test(flow.status),
  );
  const limited = activeFlows.slice(0, maxFlows);
  const items = limited.map((flow, flowIndex) => {
    const actions = (actionsByFlow.get(flow.id) ?? [])
      .sort((left, right) => numeric(left.position) - numeric(right.position))
      .slice(0, maxActionsPerFlow);
    const syncedMs = flow.last_synced_at
      ? Date.parse(flow.last_synced_at)
      : Number.NaN;
    return {
      source_ref: `flow-${String(flowIndex + 1).padStart(3, "0")}`,
      account: flow.account_name,
      name: flow.name,
      status: flow.status,
      trigger_type: flow.trigger_type,
      updated_at_external: flow.updated_at_external,
      action_count_observed: actionsByFlow.get(flow.id)?.length ?? 0,
      actions: actions.map((action) => ({
        type: text(action.action_type, 80),
        status: text(action.status, 40),
        position: numeric(action.position),
      })),
      message_count_observed: messagesByFlow.get(flow.id) ?? 0,
      definition_status: flow.structure ? "available" : "not_synced",
      definition_freshness: flow.structure
        ? timestampFreshness(flow.updated_at_external, flow.structure.source_updated_at)
        : "missing",
      definition_stale: flow.structure
        ? timestampFreshness(flow.updated_at_external, flow.structure.source_updated_at) !== "current"
        : true,
      structure: flow.structure,
      graph: flow.graph,
      graph_freshness: flow.graph
        ? timestampFreshness(flow.updated_at_external, flow.definition_graph_synced_at)
        : "missing",
      trigger_event_volume_status: flow.eventVolumeSummary.status,
      trigger_event_volumes: flow.eventVolumeSummary.volumes
        .slice(0, 4)
        .map((volume) => ({
          event_type: volume.event_type,
          event_count: volume.event_count,
          period_start: volume.period_start,
          period_end: volume.period_end,
          fetched_at: volume.fetched_at,
          stale: volume.stale,
          meaning: "total_metric_events_not_filter_eligible_profiles",
        })),
      last_synced_at: flow.last_synced_at,
      sync_stale:
        !Number.isFinite(syncedMs) ||
        syncedMs > now ||
        now - syncedMs > 48 * 60 * 60 * 1000,
      sync_freshness: !Number.isFinite(syncedMs) || syncedMs > now
        ? "unknown"
        : now - syncedMs > 48 * 60 * 60 * 1000 ? "stale" : "current",
    };
  });
  const referencedMetricIds = new Set(limited.flatMap((flow) => flow.metricRefs));
  const observedMetricIds = new Set(limited.flatMap((flow) => flow.freshMetricRefs));
  const referencedVolumeCount = referencedMetricIds.size;
  const observedVolumeCount = [...observedMetricIds].filter((id) => referencedMetricIds.has(id)).length;
  const freshVolumes = limited.flatMap((flow) =>
    flow.eventVolumeSummary.volumes.filter((volume) => !volume.stale),
  );
  const uniquePeriods = [...new Map(freshVolumes.map((volume) => [
    `${volume.period_start}:${volume.period_end}`,
    { period_start: volume.period_start, period_end: volume.period_end },
  ])).values()];
  const status =
    errors.length > 0
      ? items.length > 0
        ? "partial"
        : "unavailable"
    : Object.values(input.queryTruncation ?? {}).some(Boolean)
      ? "partial"
      : accounts.length === 0
        ? "unavailable"
        : "available";
  return {
    status,
    scope: input.selectedStoreId
      ? "selected_store"
      : "organization_all_accounts",
    account_count: accounts.length,
    account_inventory_status: errors.includes("account_inventory_load_failed") ? "unavailable" : accounts.length ? "available" : "empty",
    active_flow_count_observed: activeFlows.length,
    active_flow_count_included: items.length,
    inventory_truncated: activeFlows.length > items.length,
    query_truncation: input.queryTruncation ?? {},
    event_volume_available: false,
    eligible_event_volume_available: false,
    trigger_event_volume_status:
      referencedVolumeCount === 0
        ? "unavailable"
        : observedVolumeCount === referencedVolumeCount
          ? "available"
          : observedVolumeCount > 0
            ? "partial"
            : "unavailable",
    trigger_event_volume_period: uniquePeriods.length === 1
      ? { start: uniquePeriods[0]!.period_start, end: uniquePeriods[0]!.period_end }
      : null,
    trigger_event_volume_period_status: uniquePeriods.length > 1 ? "mixed" : uniquePeriods.length === 1 ? "single" : "unavailable",
    trigger_event_metrics_truncated: input.triggerEventMetricsTruncated ?? null,
    trigger_event_metric_refresh_limit_per_sync: 6,
    trigger_event_volume_is_not_filter_eligibility: true,
    labels_are_untrusted_data: true,
    errors,
    flows: items,
  } as const;
}

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

function numeric(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampFreshness(left: string | null, right: string | null): "current" | "stale" | "unknown" {
  if (!left || !right) return "unknown";
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return "unknown";
  return leftTime === rightTime ? "current" : "stale";
}

function safeGraphTopology(graph: ReturnType<typeof readKlaviyoFlowGraph>) {
  if (!graph) return null;
  const indexById = new Map(graph.nodes.map((node, index) => [node.id, index + 1]));
  return {
    truncated: graph.truncated,
    entry_step: graph.entry ? indexById.get(graph.entry) ?? null : null,
    triggers: graph.triggers.slice(0, 4).map((trigger) => trigger.type),
    steps: graph.nodes.map((node, index) => ({
      step: index + 1,
      kind: node.kind,
      next_step: node.next ? indexById.get(node.next) ?? null : null,
      yes_step: node.yes ? indexById.get(node.yes) ?? null : null,
      no_step: node.no ? indexById.get(node.no) ?? null : null,
    })),
  };
}
