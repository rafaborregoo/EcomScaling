// Numero de agente que se pinta delante de cada mensaje de IA, para saber de
// quien es. Se deriva de la ruta del endpoint, no del texto que genera el modelo.
const AGENT_TAG_BY_PATH: Record<string, string> = {
  "/ai/monitor": "A02",
  "/ai/task-planner": "A04",
  "/ai/stock-planner": "A06",
  "/ai/knowledge-manager": "A08",
  "/ai/email-analyst": "A12",
  "/ai/operativa-shopify": "A13",
  "/ai/operativa-meta": "A14",
  "/ai/retencion-clientes": "A20",
  "/ai/adquisicion-shopify": "A21",
  "/ai/postventa-shopify": "A22",
  "/ai/creatividad-meta": "A23",
  "/ai/medicion-meta": "A24",
  "/ai/cambios-meta": "A25",
  "/ai/contenido-email": "A26",
  "/ai/klaviyo-flow-architect": "A28",
};

export function agentTagForPath(path: string): string {
  return AGENT_TAG_BY_PATH[path.split("?")[0] ?? ""] ?? "IA";
}
