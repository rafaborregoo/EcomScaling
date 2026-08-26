import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentEvalEvidencePayload } from "@ecomscaling/ai";

/** Persists AI-26 evidence through the private atomic RPC (service role only). */
export async function persistAgentEvalEvidence(
  supabase: SupabaseClient,
  payload: AgentEvalEvidencePayload,
): Promise<{ evaluationId: string }> {
  const { data, error } = await supabase.rpc(
    "record_agent_version_evaluation",
    { p_payload: payload },
  );

  if (error) {
    throw new Error(`agent_eval_evidence_persist_failed:${error.message}`);
  }
  if (typeof data !== "string" || data.length === 0) {
    throw new Error("agent_eval_evidence_persist_missing_id");
  }
  return { evaluationId: data };
}
