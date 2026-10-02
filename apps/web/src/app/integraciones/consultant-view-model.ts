export type ConsultantIntegrationTone = "danger" | "warn" | "success" | "neutral";

const ERROR_STATUSES = new Set([
  "error",
  "reauthorization_required",
  "needs_reauth",
]);

const PENDING_STATUSES = new Set(["pending", "pending_deletion"]);

export function hasIntegrationAttention(status: string): boolean {
  return ERROR_STATUSES.has(status) || PENDING_STATUSES.has(status);
}

export function integrationStatusTone(status: string): ConsultantIntegrationTone {
  if (ERROR_STATUSES.has(status)) return "danger";
  if (PENDING_STATUSES.has(status)) return "warn";
  if (status === "connected") return "success";
  return "neutral";
}
