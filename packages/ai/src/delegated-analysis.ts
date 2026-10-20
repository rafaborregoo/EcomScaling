/**
 * Detecta pasos de una tarea que piden a una persona hacer un análisis que
 * E-NORA puede calcular con sus datos ("Comparar venta suelta y pack...",
 * "Calcular la contribución..."). Una tarea de un agente solo debe pedir
 * acciones que únicamente puede hacer una persona fuera de E-NORA; el cálculo
 * lo hace el agente y viene ya hecho en la tarea.
 *
 * Es una heurística por verbo inicial: marca para revisar, no bloquea. Los
 * falsos positivos acaban en la bandeja de capacidades del platform_admin, que
 * es donde se ve si hay que afinar la lista.
 */

// Mismo corte que la UI (client-pulse.tsx splitSteps) más saltos de línea y viñetas.
export function splitTaskSteps(text: string): string[] {
  return text
    .split(/\n+|\s*(?<![0-9,./])(?=[0-9]{1,2}[).] )/)
    .map((part) => part.replace(/^\s*(?:[0-9]{1,2}[).]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

const ANALYSIS_VERB =
  /^(compar|calcul|analiz|estim|evalu|cuantific|simul|contrast|cruz|determin|med(ir|ida)\b|mide\b)/;
// Verbos que también son acciones humanas legítimas ("Revisar el asunto del
// email"): solo cuentan como análisis cuando su objeto son datos.
const DATA_OBJECT =
  /^(revis|verific|comprob|identific|detect)\w*\s+(?:(?:si|qué|que|cuál|cual|cuáles|cuales|los|las|el|la|de|del)\s+)*(datos|métricas|metricas|cifras|ventas|márgen|margen|márgenes|margenes|costes?|ticket|histórico|historico|rendimiento|contribución|contribucion|cobertura|conversión|conversion|tasa|roas|cpa|cac)/;

const normalize = (step: string) =>
  step
    .toLowerCase()
    // "En Shopify > Productos, calcular..." -> "calcular..."
    .replace(/^en\s+[^,]{1,80}>[^,]{1,80},\s*/, "")
    .trim();

export function findDelegatedAnalysisSteps(description: string | null | undefined): string[] {
  if (!description) return [];
  return splitTaskSteps(description).filter((step) => {
    const head = normalize(step);
    return ANALYSIS_VERB.test(head) || DATA_OBJECT.test(head) || /\bcomo hip[oó]tesis\b/.test(head);
  });
}
