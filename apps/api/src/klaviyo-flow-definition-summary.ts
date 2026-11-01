const ACTION_TYPES = new Set([
  "send-email",
  "send-sms",
  "send-push",
  "time-delay",
  "conditional-split",
  "trigger-split",
  "webhook",
  "update-profile-property",
  "end-flow",
]);
const TRIGGER_TYPES = new Set([
  "metric",
  "list",
  "date",
  "segment",
  "price-drop",
  "low-stock",
  "back-in-stock",
]);
const DELAY_UNITS = new Set(["minutes", "hours", "days", "weeks"]);

type Row = Record<string, unknown>;

/**
 * Extract only structural facts from a Klaviyo flow definition. In particular,
 * filters' values, message contents, IDs, labels and settings are never copied.
 */
export function summarizeKlaviyoFlowDefinition(
  response: unknown,
  syncedAt = new Date().toISOString(),
) {
  const root = row(response);
  const data = row(root?.data) ?? root;
  const attributes = row(data?.attributes) ?? data;
  const definition = row(attributes?.definition);
  if (!definition) return null;

  const triggers = array(definition.triggers).slice(0, 4);
  const actions = array(definition.actions).slice(0, 30);
  const steps = actions.map((value) => {
    const action = row(value) ?? {};
    const type = safeEnum(action.type, ACTION_TYPES) ?? "other";
    const actionData = row(action.data) ?? {};
    const links = row(action.links) ?? {};
    const message = row(actionData.message) ?? {};
    const delayUnit = safeEnum(actionData.unit, DELAY_UNITS);
    const delayValue = finiteInteger(actionData.value, 0, 365 * 24 * 60);
    return {
      type,
      ...(type === "time-delay" && delayUnit && delayValue !== null
        ? { delay_value: delayValue, delay_unit: delayUnit }
        : {}),
      ...(type === "time-delay"
        ? {
            delay_until_time_configured:
              typeof actionData.delay_until_time === "string" &&
              actionData.delay_until_time.length > 0,
            delay_until_weekday_count: Math.min(
              7,
              array(actionData.delay_until_weekdays).length,
            ),
          }
        : {}),
      ...(type === "conditional-split" || type === "trigger-split"
        ? {
            has_yes_branch: Boolean(links.next_if_true ?? links.yes),
            has_no_branch: Boolean(links.next_if_false ?? links.no),
          }
        : {}),
      ...(type === "send-email" || type === "send-sms" || type === "send-push"
        ? {
            smart_sending_enabled:
              typeof message.smart_sending_enabled === "boolean"
                ? message.smart_sending_enabled
                : null,
          }
        : {}),
    };
  });

  const triggerFilterCounts = triggers.map((value) =>
    countFilter(row(value)?.trigger_filter),
  );
  return {
    version: 1,
    synced_at: syncedAt,
    source_updated_at: isoTimestamp(attributes?.updated),
    trigger_types: triggers.map(
      (value) => safeEnum(row(value)?.type, TRIGGER_TYPES) ?? "other",
    ),
    trigger_filter_group_count: triggerFilterCounts.reduce(
      (sum, item) => sum + item.groups,
      0,
    ),
    trigger_filter_condition_count: triggerFilterCounts.reduce(
      (sum, item) => sum + item.conditions,
      0,
    ),
    has_profile_filter:
      definition.profile_filter !== null &&
      definition.profile_filter !== undefined,
    profile_filter_group_count: countFilter(definition.profile_filter).groups,
    profile_filter_condition_count: countFilter(definition.profile_filter)
      .conditions,
    action_count_observed: array(definition.actions).length,
    steps,
    steps_truncated: array(definition.actions).length > steps.length,
  } as const;
}

/** Accept only summaries written by the extractor, never provider raw data. */
export function readKlaviyoFlowDefinitionSummary(rawData: unknown) {
  const data = row(rawData);
  const summary = row(data?.a28_flow_structure);
  if (!summary || summary.version !== 1 || !Array.isArray(summary.steps))
    return null;
  const steps = summary.steps.slice(0, 30).flatMap((value) => {
    const step = row(value);
    if (
      !step ||
      typeof step.type !== "string" ||
      ![...ACTION_TYPES, "other"].includes(step.type)
    )
      return [];
    return [
      {
        type: step.type,
        ...(finiteInteger(step.delay_value, 0, 365 * 24 * 60) !== null &&
        typeof step.delay_unit === "string" &&
        DELAY_UNITS.has(step.delay_unit)
          ? {
              delay_value: finiteInteger(step.delay_value, 0, 365 * 24 * 60),
              delay_unit: step.delay_unit,
            }
          : {}),
        ...(step.type === "time-delay"
          ? {
              delay_until_time_configured:
                step.delay_until_time_configured === true,
              delay_until_weekday_count:
                finiteInteger(step.delay_until_weekday_count, 0, 7) ?? 0,
            }
          : {}),
        ...(step.type === "conditional-split" || step.type === "trigger-split"
          ? {
              has_yes_branch: step.has_yes_branch === true,
              has_no_branch: step.has_no_branch === true,
            }
          : {}),
        ...(step.type === "send-email" ||
        step.type === "send-sms" ||
        step.type === "send-push"
          ? {
              smart_sending_enabled:
                typeof step.smart_sending_enabled === "boolean"
                  ? step.smart_sending_enabled
                  : null,
            }
          : {}),
      },
    ];
  });
  return {
    version: 1,
    synced_at: isoTimestamp(summary.synced_at),
    source_updated_at: isoTimestamp(summary.source_updated_at),
    trigger_types: Array.isArray(summary.trigger_types)
      ? summary.trigger_types
          .slice(0, 4)
          .map((value) => safeEnum(value, TRIGGER_TYPES) ?? "other")
      : [],
    trigger_filter_group_count:
      finiteInteger(summary.trigger_filter_group_count, 0, 100) ?? 0,
    trigger_filter_condition_count:
      finiteInteger(summary.trigger_filter_condition_count, 0, 500) ?? 0,
    has_profile_filter: summary.has_profile_filter === true,
    profile_filter_group_count:
      finiteInteger(summary.profile_filter_group_count, 0, 100) ?? 0,
    profile_filter_condition_count:
      finiteInteger(summary.profile_filter_condition_count, 0, 500) ?? 0,
    action_count_observed:
      finiteInteger(summary.action_count_observed, 0, 1000) ?? steps.length,
    steps,
    steps_truncated: summary.steps_truncated === true,
  } as const;
}

function countFilter(value: unknown) {
  let groups = 0;
  let conditions = 0;
  let visited = 0;
  const walk = (item: unknown, depth: number) => {
    if (visited >= 256 || depth > 8) return;
    visited += 1;
    const object = row(item);
    if (!object) return;
    if (Array.isArray(object.condition_groups)) {
      groups += object.condition_groups.length;
      for (const group of object.condition_groups.slice(0, 100))
        walk(group, depth + 1);
    }
    if (Array.isArray(object.conditions)) {
      conditions += object.conditions.length;
      for (const condition of object.conditions.slice(0, 100))
        walk(condition, depth + 1);
    }
    if (object.filter && typeof object.filter === "object")
      walk(object.filter, depth + 1);
  };
  walk(value, 0);
  return {
    groups: Math.min(groups, 100),
    conditions: Math.min(conditions, 500),
  };
}

function row(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeEnum(value: unknown, allowed: Set<string>): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return allowed.has(normalized) ? normalized : null;
}

function finiteInteger(
  value: unknown,
  min: number,
  max: number,
): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.trunc(value)))
    : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
