export type AgentOutputNoteWrite = {
  outputId: string;
  organizationId: string;
  authorUserId: string;
  proposalIndex: number;
  title?: unknown;
  description?: unknown;
};

export type AgentOutputNoteStore = {
  upsert: (row: {
    output_id: string;
    organization_id: string;
    author_user_id: string;
    author_kind: "ai";
    body: string;
    agent_proposal_index: number;
  }) => Promise<{ id: string | null; error: unknown | null }>;
  find: (outputId: string, proposalIndex: number) => Promise<{ id: string | null; error: unknown | null }>;
};

export type AgentOutputNoteMaterialization =
  | { ok: true; id: string }
  | { ok: false; reason: "note_body_required" | "note_materialization_failed" };

/** Materializa una nota aprobada y recupera la existente si el upsert fue duplicado. */
export async function materializeApprovedAgentOutputNote(
  store: AgentOutputNoteStore,
  input: AgentOutputNoteWrite,
): Promise<AgentOutputNoteMaterialization> {
  const body = [input.title, input.description]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" — ")
    .slice(0, 4000);
  if (!body) return { ok: false, reason: "note_body_required" };

  const { id: createdId, error: writeError } = await store.upsert({
    output_id: input.outputId,
    organization_id: input.organizationId,
    author_user_id: input.authorUserId,
    author_kind: "ai",
    body,
    agent_proposal_index: input.proposalIndex,
  });
  if (writeError) return { ok: false, reason: "note_materialization_failed" };
  const { id: existingId, error: readError } = createdId
    ? { id: null, error: null }
    : await store.find(input.outputId, input.proposalIndex);
  const id = createdId ?? existingId;
  return readError || !id
    ? { ok: false, reason: "note_materialization_failed" }
    : { ok: true, id };
}
