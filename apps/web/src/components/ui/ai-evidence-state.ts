export type AiEvidenceSource = {
  kind: string;
  reference: string;
  period: string | null;
};

export type AiEvidenceStatus = "verified" | "partial" | "insufficient";

export function getAiEvidencePresentation(
  sources: readonly AiEvidenceSource[],
  warnings: readonly string[] = [],
): { status: AiEvidenceStatus; label: string } {
  if (sources.length === 0) return { status: "insufficient", label: "Sin evidencia" };
  if (warnings.length > 0) return { status: "partial", label: "Evidencia parcial" };
  return { status: "verified", label: "Fuentes verificadas" };
}
