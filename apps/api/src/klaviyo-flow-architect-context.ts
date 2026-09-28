import { readKlaviyoFlowDefinitionSummary } from "./klaviyo-flow-definition-summary.js";
import { summarizeStoredKlaviyoMetricVolumes } from "./klaviyo-flow-event-volume.js";

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
        structure: readKlaviyoFlowDefinitionSummary(row.raw_data),
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
  const items = limited.map((flow) => {
    const actions = (actionsByFlow.get(flow.id) ?? [])
      .sort((left, right) => numeric(left.position) - numeric(right.position))
      .slice(0, maxActionsPerFlow);
    const syncedMs = flow.last_synced_at
      ? Date.parse(flow.last_synced_at)
      : Number.NaN;
    return {
      account: flow.account_name,
      name: flow.name,
      status: flow.status,
      trigger_type: flow.trigger_type,
      action_count_observed: actionsByFlow.get(flow.id)?.length ?? 0,
      actions: actions.map((action) => ({
        type: text(action.action_type, 80),
        status: text(action.status, 40),
        position: numeric(action.position),
      })),
      message_count_observed: messagesByFlow.get(flow.id) ?? 0,
      definition_status: flow.structure ? "available" : "not_synced",
      definition_stale: flow.structure
        ? isDifferentTimestamp(
            flow.updated_at_external,
            flow.structure.source_updated_at,
          )
        : true,
      structure: flow.structure,
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
    };
  });
  const referencedVolumeCount = limited.reduce(
    (sum, flow) => sum + flow.eventVolumeSummary.metrics_referenced,
    0,
  );
  const observedVolumeCount = limited.reduce(
    (sum, flow) => sum + flow.eventVolumeSummary.metrics_observed,
    0,
  );
  const freshVolumes = limited.flatMap((flow) =>
    flow.eventVolumeSummary.volumes.filter((volume) => !volume.stale),
  );
  const status =
    errors.length > 0
      ? items.length > 0
        ? "partial"
        : "unavailable"
      : accounts.length === 0
        ? "unavailable"
        : "available";
  return {
    status,
    scope: input.selectedStoreId
      ? "selected_store"
      : "organization_all_accounts",
    account_count: accounts.length,
    active_flow_count_observed: activeFlows.length,
    active_flow_count_included: items.length,
    inventory_truncated: activeFlows.length > items.length,
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
    trigger_event_volume_period: freshVolumes[0]
      ? { start: freshVolumes[0].period_start, end: freshVolumes[0].period_end }
      : null,
    trigger_event_metrics_truncated: referencedVolumeCount > 6,
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

function isDifferentTimestamp(
  left: string | null,
  right: string | null,
): boolean {
  if (!left || !right) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime !== rightTime
  );
}
