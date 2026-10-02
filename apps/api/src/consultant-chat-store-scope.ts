export type ConsultantConversationScope = {
  scope_kind: string;
  scope_store_id: string | null;
};

/** A chat thread is reusable only in the exact store or organization scope where it began. */
export function consultantConversationScopeMismatch(
  requestedStoreId: string | null,
  conversation: ConsultantConversationScope,
): "unknown" | "mismatch" | null {
  if (conversation.scope_kind === "legacy_unknown") return "unknown";
  if (requestedStoreId === null) {
    return conversation.scope_kind === "organization" && conversation.scope_store_id === null
      ? null
      : "mismatch";
  }
  return conversation.scope_kind === "store" && conversation.scope_store_id === requestedStoreId
    ? null
    : "mismatch";
}
