/** Handoff privado entre A01 y los flujos especialistas, sin poner citas en la URL. */
export const A01_CAMPAIGN_BRIEF_KEY = "e-nora:a01:campaign-brief";
export const A01_CAMINO_BRIEF_KEY = "e-nora:a01:camino-brief";

export function serializeA01BriefHandoff(organizationId: string, brief: string) {
  return JSON.stringify({
    organizationId,
    brief: brief.trim().slice(0, 2000),
  });
}

export function parseA01BriefHandoff(
  raw: string | null,
  organizationId: string,
): string | null {
  if (!raw || !organizationId) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = value as { organizationId?: unknown; brief?: unknown };
    if (candidate.organizationId !== organizationId || typeof candidate.brief !== "string") {
      return null;
    }
    const brief = candidate.brief.trim().slice(0, 2000);
    return brief || null;
  } catch {
    return null;
  }
}
