export const MARKETING_COMPARISON_BATCH = "a11-real-2026-11-02-v4";
export const MARKETING_SPECIALISTS_BATCH = "a11-specialists-2026-11-02-v1";
export type MarketingSpecialistTrace = {
  version: string; status: string; visual_review: string;
  ready_for_human_review: boolean;
  stages: Array<{ stage: string; model: string; model_verified: boolean; duration_ms: number; price: { low: number; high: number } | null; output: unknown }>;
  review: { verdict: string; summary: string; issues: Array<{ severity: string; detail: string }> };
};
export type LabCheck = { label: string; status: "pass" | "warning" | "fail"; detail: string };
export type LabManifestRow = {
  case_id: string; channel: string; mode: string; model_id: string; model_label: string;
  status: string; error: string | null; price: { low: number; high: number } | null;
  duration_ms: number | null; model_verified: boolean; draft_id: string | null;
  raw_response?: string | null;
};
export type RealMarketingLab = {
  batch?: string; case_id?: string; mode?: string;
  model: string; model_label: string; synthetic: boolean;
  estimated_api_cost_low: number | null; estimated_api_cost_high: number | null;
  cli_duration_ms?: number; model_verified?: boolean; actual_model?: string | null;
  checks?: LabCheck[]; issues?: string[]; prompt_hash?: string; context_hash?: string;
  products?: Array<{ id: string; title: string; price: number | null; currency: string | null; image_url: string | null; product_url: string | null }>;
  limitations?: string[]; manifest?: LabManifestRow[];
  audit_history?: { findings: string[]; baseline_failures: Array<{ case_id: string; model_id: string; error: string; raw_response: string }>; previous_known_cost: { low: number; high: number }; unmeasured_interrupted: number };
  verdict?: { title: string; recommendation: string; winner: string | null; fallback: string | null; channel_notes: string[]; limitations: string[] } | null;
  editorial_review?: { summary: string; strengths: string[]; weaknesses: string[]; recommendation: string } | null;
};

export function comparisonCaseRows(manifest: readonly LabManifestRow[], channel: string, mode: string) {
  return manifest.filter((row) => row.channel === channel && row.mode === mode);
}

export function comparisonPrice(row: { low: number; high: number } | null | undefined) {
  if (!row || !Number.isFinite(row.low) || !Number.isFinite(row.high)) return "No disponible";
  const format = (value: number) => value.toLocaleString("es-ES", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return row.low === row.high ? format(row.low) : `${format(row.low)}–${format(row.high)}`;
}
