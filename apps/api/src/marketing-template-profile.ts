import crypto from "node:crypto";

export type MarketingTemplateProfile = {
  version: 1;
  fingerprint: string;
  analyzed_at: string;
  structure: { blocks: number; types: Record<string, number> };
  palette: Array<{ hex: string; mentions: number; share_percent: number }>;
  typography: { font_sizes_px: number[]; font_weights: string[] };
  calls_to_action: Array<{ label: string; position: number }>;
  persuasion: string[];
};

/**
 * Perfil compacto, estable y sin llamadas externas. Se persiste por versión y
 * sirve como contexto de bajo coste para A11; un análisis profundo de IA puede
 * ampliar esta ficha sin tener que volver a enviar el HTML en cada generación.
 */
export function buildMarketingTemplateProfile(input: {
  html: string;
  blocks?: unknown[];
  plainText?: string;
}): MarketingTemplateProfile {
  const html = input.html ?? "";
  const colors = html.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const color of colors) {
    const hex = color.toLowerCase();
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const totalColors = colors.length || 1;
  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, mentions]) => ({
      hex,
      mentions,
      share_percent: Math.round((mentions / totalColors) * 100),
    }));
  const fontSizes = [...new Set(
    [...html.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((match) =>
      Number(match[1]),
    ),
  )].sort((a, b) => a - b);
  const fontWeights = [...new Set(
    [...html.matchAll(/font-weight\s*:\s*([\w-]+)/gi)].map((match) => match[1]!),
  )].slice(0, 8);
  const ctas = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match, position) => ({
      label: match[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      position: position + 1,
    }))
    .filter((cta) => cta.label.length > 0)
    .slice(0, 8);
  const copy = `${input.plainText ?? ""} ${html.replace(/<[^>]+>/g, " ")}`.toLowerCase();
  const persuasion = [
    copy.includes("%") || /descuento|oferta|ahorra/.test(copy) ? "oferta" : null,
    /hoy|últim|ahora|pronto/.test(copy) ? "urgencia" : null,
    /clientes|reseña|opinión|valoración/.test(copy) ? "prueba_social" : null,
    ctas.length > 0 ? "cta" : null,
  ].filter((item): item is string => Boolean(item));
  const types: Record<string, number> = {};
  for (const block of input.blocks ?? []) {
    const type =
      block && typeof block === "object" && typeof (block as { type?: unknown }).type === "string"
        ? (block as { type: string }).type
        : "unknown";
    types[type] = (types[type] ?? 0) + 1;
  }
  return {
    version: 1,
    fingerprint: crypto.createHash("sha256").update(html).digest("hex"),
    analyzed_at: new Date().toISOString(),
    structure: { blocks: input.blocks?.length ?? 0, types },
    palette,
    typography: { font_sizes_px: fontSizes, font_weights: fontWeights },
    calls_to_action: ctas,
    persuasion,
  };
}
