import { membershipCoversStore, requireOperationalOrganization, requireOperationalStore, type AuthContext } from "./auth-context.js";

export type AgentOutputScope = {
  organization_id: string;
  store_id: string | null;
  agent_code: string | null;
  objective: string | null;
};

/** A service client must apply the same audience/store checks for reads and decisions. */
export function authorizeAgentOutputScope(context: AuthContext, organizationId: string, scope: AgentOutputScope) {
  if (scope.organization_id !== organizationId || !scope.agent_code) {
    return { ok: false as const, statusCode: 404, error: "agent_output_not_found" };
  }
  if (!context.profile.is_active) return { ok: false as const, statusCode: 403, error: "profile_inactive" };
  const access = scope.store_id
    ? requireOperationalStore(context, organizationId, scope.store_id)
    : requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  const internal = scope.agent_code === "a08_gestor_conocimiento" || scope.objective?.includes("[dashboard_scope=panel]");
  if (internal && !["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return { ok: false as const, statusCode: 403, error: "agent_output_consultant_only", message: "Esta salida es interna del consultor." };
  }
  return access;
}

export function agentTaskNotificationBatches(
  members: Array<{ user_id: string; access_scope: string | null; store_ids: string[] | null; store_id: string | null }>,
  tasks: Array<{ id: string; title: string; store_id: string | null; is_visible_to_client: boolean }>,
) {
  return members.flatMap((member) => {
    const visible = tasks.filter((task) => task.is_visible_to_client && membershipCoversStore({
      accessSource: "membership", access_scope: member.access_scope ?? "organization",
      store_ids: member.store_ids ?? (member.store_id ? [member.store_id] : []),
    }, task.store_id));
    return visible.length ? [{ userId: member.user_id, taskIds: visible.map((task) => task.id), titles: visible.map((task) => task.title) }] : [];
  });
}
