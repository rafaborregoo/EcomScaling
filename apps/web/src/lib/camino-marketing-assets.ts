export type CaminoMarketingAsset = {
  id: string;
  task_id: string;
  milestone_id: string | null;
  milestone_name: string | null;
  title: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
};

export function marketingAssetStatusLabel(asset: Pick<CaminoMarketingAsset, "status" | "scheduled_for">) {
  if (asset.scheduled_for && ["approved", "published"].includes(asset.status)) return "Programado";
  switch (asset.status) {
    case "draft":
      return "Borrador";
    case "pending_approval":
      return "Pendiente de revisión";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
    case "published":
      return "Publicado";
    default:
      return "Estado: " + asset.status;
  }
}

export function marketingAssetHref(draftId: string) {
  return `/marketing?section=crear&draft=${encodeURIComponent(draftId)}`;
}

/** Builds the task lookup while retaining the newest linked draft per task. */
export function latestMarketingAssetByTask(assets: CaminoMarketingAsset[]) {
  const sorted = [...assets].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const byTask = new Map<string, CaminoMarketingAsset>();
  for (const asset of sorted) {
    if (!byTask.has(asset.task_id)) byTask.set(asset.task_id, asset);
  }
  return byTask;
}

export function marketingDraftAsCaminoAsset(
  draft: {
    id: string;
    status: string;
    template_name: string;
    subject: string;
    scheduled_for: string | null;
    created_at: string;
    request: {
      store_id?: string | null;
      camino_task?: {
        task_id: string;
        milestone_id: string | null;
        milestone_name: string | null;
      };
    } | null;
  },
  connectionId: string | null,
): CaminoMarketingAsset | null {
  const linkedTask = draft.request?.camino_task;
  if (!connectionId || draft.request?.store_id !== connectionId || !linkedTask) return null;
  return {
    id: draft.id,
    task_id: linkedTask.task_id,
    milestone_id: linkedTask.milestone_id,
    milestone_name: linkedTask.milestone_name,
    title: draft.template_name || draft.subject || "Borrador de email",
    status: draft.status,
    scheduled_for: draft.scheduled_for,
    created_at: draft.created_at,
  };
}
