export type CaminoProposalAction = "accept" | "reject" | "edit" | "complete";
export type CaminoProposalState = "pending" | "accepted" | "edited" | "rejected" | "completed";

export function isCaminoProposalActionAllowed(action: CaminoProposalAction, previous: CaminoProposalState): boolean {
  if (previous === "rejected" || previous === "completed") return false;
  if (action === "accept" || action === "reject") return previous === "pending";
  if (action === "edit") return ["pending", "accepted", "edited"].includes(previous);
  return previous === "accepted" || previous === "edited";
}
