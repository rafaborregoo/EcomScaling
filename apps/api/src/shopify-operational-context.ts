export type ScopedOpenTask = {
  store_id: string | null;
  [key: string]: unknown;
};

/** Keep an RPC failure distinct from a successful query with no rows. */
export function operationalMetricValue<T>(
  rows: readonly T[] | null,
  error: unknown,
): T | { status: "unavailable" | "no_data"; reason?: "rpc_error" } {
  if (error) return { status: "unavailable", reason: "rpc_error" };
  return rows?.[0] ?? { status: "no_data" };
}

/** Separate work owned by the selected store from legacy organization-wide work. */
export function partitionOpenTasksForStore<T extends ScopedOpenTask>(
  tasks: readonly T[],
  selectedStoreId: string,
) {
  const sameStore: T[] = [];
  const unattributed: T[] = [];
  let excludedOtherStore = 0;
  for (const task of tasks) {
    if (task.store_id === selectedStoreId) sameStore.push(task);
    else if (task.store_id === null) unattributed.push(task);
    else excludedOtherStore += 1;
  }
  return {
    scope: "selected_store" as const,
    store_tasks: sameStore,
    organization_unattributed_tasks: unattributed,
    unattributed_tasks_purpose: "duplicate_avoidance_only" as const,
    excluded_other_store_count: excludedOtherStore,
  };
}

/** Alerts lack store_id today; never imply they are evidence for one store. */
export function labelOrganizationAlertsForStore<T>(
  alerts: readonly T[],
  selectedStoreId: string | null,
) {
  return {
    scope: selectedStoreId ? "organization_unattributed" as const : "organization" as const,
    store_attribution_available: false as const,
    eligible_as_store_evidence: false as const,
    items: alerts,
  };
}
