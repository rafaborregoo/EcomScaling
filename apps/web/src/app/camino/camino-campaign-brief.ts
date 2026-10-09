/**
 * Brief para el plan de campañas (A05) a partir del Camino: así las campañas se
 * proponen para cumplir sus hitos y fechas clave, no en abstracto.
 */

export type BriefMilestone = { name: string; date: string | null };

const MAX = 1900;

export function campaignBriefFromCamino(input: { planName: string; goal?: string | null; milestones: BriefMilestone[] }): string {
  const lines = input.milestones
    .filter((milestone) => milestone.name.trim())
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .map((milestone) => `- ${milestone.date ? milestone.date.slice(0, 10) : "sin fecha"}: ${milestone.name.trim()}`);
  const head =
    `Camino «${input.planName}»${input.goal ? ` (meta: ${input.goal})` : ""}. ` +
    "Propón las campañas, los envíos de email con su fecha y los creativos de Meta con su fecha de arranque que hacen falta para cumplir estos hitos y para preparar y aprovechar las fechas clave (Black Friday, Navidad, rebajas, temporada de la categoría). " +
    "Cada campaña debe llegar a tiempo para el hito que la necesita. Hitos del Camino:\n";
  let text = head;
  for (const line of lines) {
    if (text.length + line.length + 1 > MAX) break;
    text += `${line}\n`;
  }
  return text.trimEnd();
}
