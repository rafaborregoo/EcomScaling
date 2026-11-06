import { createHash } from "node:crypto";
import type { AiModelLabResult } from "../packages/contracts/src/ai-model-lab.js";

export const LAB_MODELS = [
  {
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    provider: "anthropic" as const,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    provider: "anthropic" as const,
  },
  { id: "claude-opus-5-5", label: "Opus 5.5", provider: "anthropic" as const },
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai" as const },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", provider: "openai" as const },
  { id: "gpt-6-astra", label: "GPT-6 Astra", provider: "openai" as const },
  { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", provider: "openai" as const },
];
export const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");

export function isUsageLimitFailure(failed: boolean, message: string): boolean {
  return (
    failed &&
    /usage limit|rate.?limit|quota exceeded|limit reached|you.ve hit.*limit|out.of.credit|insufficient.quota|límite de uso/i.test(
      message,
    )
  );
}

/** No se publica ni se envía al modelo una credencial, URL firmada o dato de contacto. */
export function redact(value: unknown, key = ""): unknown {
  if (
    /token|secret|password|authorization|api.?key|email|phone|address|first_name|last_name|customer_name|signed.?url|base64/i.test(
      key,
    )
  )
    return "[omitido]";
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redact(v, k)]),
    );
  if (typeof value === "string")
    return value
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[correo omitido]")
      .replace(
        /https?:\/\/[^\s"<>]+[?][^\s"<>]+/gi,
        "[URL con parámetros omitida]",
      )
      .replace(
        /\b(?:sk|sb_secret|shpat|shpca)_[a-zA-Z0-9_-]{10,}\b/g,
        "[credencial omitida]",
      );
  return value;
}

export function parseOutput(raw: string): unknown {
  try {
    return JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    return null;
  }
}
const asText = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(asText) : v ? [asText(v)] : [];
export function normalizeOutput(raw: string): AiModelLabResult["normalized"] {
  const parsed = parseOutput(raw);
  const v =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const sections = Array.isArray(v.sections)
    ? v.sections.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const sectionItems = (key: "findings" | "recommendations") =>
    sections.flatMap((section) =>
      Array.isArray(section[key])
        ? section[key].map((item: unknown) =>
            item && typeof item === "object" && !Array.isArray(item)
              ? JSON.stringify({
                  section: section.label ?? section.key,
                  ...item,
                })
              : asText(item),
          )
        : [],
    );
  return {
    summary: asText(
      v.answer ??
        v.headline ??
        v.summary ??
        v.executive_summary ??
        v.diagnosis ??
          v.description ??
        (parsed ? "Respuesta estructurada disponible en el original." : raw),
    ),
    findings:
        v.findings === undefined && v.key_points === undefined && v.design_findings === undefined
        ? sectionItems("findings")
          : asList(v.findings ?? v.key_points ?? v.design_findings),
    recommendations:
      v.recommendations === undefined &&
      v.proposed_tasks === undefined &&
      v.proposed_writes === undefined &&
      v.actions === undefined
          ? v.suggested_use ? asList(v.suggested_use) : Array.isArray(v.initiatives) ? asList(v.initiatives) : sectionItems("recommendations")
        : asList(
            (Array.isArray(v.proposed_writes) && v.proposed_writes.length > 0 ? v.proposed_writes : undefined) ??
              v.recommendations ?? v.proposed_tasks ?? v.proposed_writes ?? v.actions,
          ),
    warnings: asList(v.warnings ?? v.limitations ?? v.unknowns),
  };
}

export function requeueBlocked(rows: AiModelLabResult[]): AiModelLabResult[] {
  return rows.map((row) =>
    row.status === "blocked" ? pendingResult(row.case_id, row.model_id) : row,
  );
}

export function pendingResult(
  caseId: string,
  modelId: string,
): AiModelLabResult {
  return {
    id: `${caseId}:${modelId}`,
    case_id: caseId,
    model_id: modelId,
    actual_model: null,
    model_verified: false,
    status: "pending",
    started_at: null,
    duration_ms: null,
    cli_version: null,
    error: null,
    raw_response: "",
    normalized: normalizeOutput(""),
    checks: { json_valid: null, nonempty: null, native_contract: null },
    usage: { input: null, cached: null, cache_creation: null, output: null },
    provider_reported_cost: null,
    review: {
      status: "pending",
      method: "pending",
      reviewer: null,
      verdict: null,
      notes: [],
    },
  };
}
