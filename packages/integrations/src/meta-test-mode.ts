export type MetaTestModeMutation = {
  provider: string;
  objectType?: string | null;
  action?: string | null;
  fields?: Record<string, unknown> | null;
};

export type MetaTestModeDecision =
  | { allowed: true }
  | { allowed: false; error: "meta_test_mode_activation_blocked"; reason: string };

const truthy = (value: string | undefined | null) =>
  typeof value === "string" &&
  ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());

export function isMetaTestModeEnabled(value = process.env.META_TEST_MODE) {
  return truthy(value);
}

function containsActivationIntent(value: unknown) {
  return (
    typeof value === "string" &&
    /(^|[_\s-])(activate|active|publish|published|resume|enable|enabled|go[_\s-]?live|start[_\s-]?delivery)($|[_\s-])/i.test(
      value,
    )
  );
}

function fieldRequestsActivation(key: string, value: unknown) {
  const normalizedKey = key.toLowerCase();
  if (
    ["status", "configured_status", "effective_status", "run_status", "delivery_status"].includes(
      normalizedKey,
    )
  ) {
    return typeof value === "string" && value.trim().toUpperCase() === "ACTIVE";
  }
  if (
    ["publish", "published", "activate", "activated", "enabled", "is_active", "go_live"].includes(
      normalizedKey,
    )
  ) {
    return value === true || containsActivationIntent(value);
  }
  return (
    containsActivationIntent(value) &&
    /(status|publish|activate|delivery|enabled)/i.test(key)
  );
}

/**
 * Hard kill-switch for Meta test environments.
 *
 * PAUSED/DRAFT writes remain possible, but any explicit or implicit activation
 * or publication is refused while META_TEST_MODE=true.
 */
export function evaluateMetaTestModeMutation(
  input: MetaTestModeMutation,
  enabled = isMetaTestModeEnabled(),
): MetaTestModeDecision {
  if (!enabled || input.provider !== "meta_ads") return { allowed: true };

  if (
    containsActivationIntent(input.action) ||
    containsActivationIntent(input.objectType)
  ) {
    return {
      allowed: false,
      error: "meta_test_mode_activation_blocked",
      reason:
        "META_TEST_MODE blocks Meta activation/publication and any transition to delivery.",
    };
  }

  for (const [key, value] of Object.entries(input.fields ?? {})) {
    if (fieldRequestsActivation(key, value)) {
      return {
        allowed: false,
        error: "meta_test_mode_activation_blocked",
        reason: `META_TEST_MODE blocks Meta field ${key} from enabling delivery.`,
      };
    }
  }

  return { allowed: true };
}
