export type ProposalReviewer = "assigned_consultant" | "client" | "unverified";

export type ConsultantProposalGuidance = {
  reviewer: ProposalReviewer;
  reviewer_name: string | null;
  destination: "tasks";
};

/** Server-derived routing guidance; never accept reviewer identity from model output. */
export function buildConsultantProposalGuidance(input: {
  has_consultant: boolean | null;
  consultant_name: string | null;
}): ConsultantProposalGuidance {
  if (input.has_consultant === true) {
    const name = input.consultant_name
      ?.trim()
      .replace(/\s+/g, " ")
      .slice(0, 100);
    return {
      reviewer: "assigned_consultant",
      reviewer_name: name || null,
      destination: "tasks",
    };
  }
  return {
    reviewer: input.has_consultant === false ? "client" : "unverified",
    reviewer_name: null,
    destination: "tasks",
  };
}

export function parseConsultantProposalGuidance(
  value: unknown,
): ConsultantProposalGuidance | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ConsultantProposalGuidance>;
  if (
    !["assigned_consultant", "client", "unverified"].includes(
      String(candidate.reviewer),
    ) ||
    candidate.destination !== "tasks" ||
    !(
      candidate.reviewer_name === null ||
      typeof candidate.reviewer_name === "string"
    )
  )
    return null;
  return {
    reviewer: candidate.reviewer as ProposalReviewer,
    reviewer_name:
      typeof candidate.reviewer_name === "string"
        ? candidate.reviewer_name.trim().replace(/\s+/g, " ").slice(0, 100) ||
          null
        : null,
    destination: "tasks",
  };
}
