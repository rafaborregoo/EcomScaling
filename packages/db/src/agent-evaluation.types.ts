import type { Json } from "./database.types.js";

export const AGENT_EVALUATION_MODES = ["offline", "shadow", "live"] as const;
export type AgentEvaluationMode = (typeof AGENT_EVALUATION_MODES)[number];

export const AGENT_EVALUATION_STATUSES = [
  "passed",
  "failed",
  "incomplete",
] as const;
export type AgentEvaluationStatus = (typeof AGENT_EVALUATION_STATUSES)[number];

/** Local overlay until Supabase official typegen includes AI-26. */
export type AgentVersionEvaluationRow = {
  id: string;
  agent_version_id: string;
  dataset_version: string;
  evaluation_mode: AgentEvaluationMode;
  status: AgentEvaluationStatus;
  overall_score: number | null;
  scores: Json;
  rates: Json;
  evaluated_agent_codes: Json;
  agent_eval_failures: Json;
  evidence: Json;
  evaluated_at: string;
  created_at: string;
};

export type AgentVersionEvalResultRow = {
  id: string;
  evaluation_id: string;
  agent_code: string;
  passed: boolean;
  checks: number;
  failed: Json;
  metrics: Json;
  created_at: string;
};
