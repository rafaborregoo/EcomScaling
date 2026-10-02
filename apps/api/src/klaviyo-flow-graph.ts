/**
 * Grafo de un flow de Klaviyo para dibujarlo en Marketing -> Flows.
 *
 * A diferencia del resumen de A28 (klaviyo-flow-definition-summary.ts), que
 * quita ids y contenidos a propósito porque va a un prompt, este grafo es para
 * que el propio cliente vea SU flow: conserva los ids de acción (para cruzarlos
 * con klaviyo_flow_actions/klaviyo_flow_messages y pintar el rendimiento de
 * cada email), los enlaces entre pasos y un texto legible de cada paso. Los
 * valores de los filtros no se copian: solo se traduce la forma de la
 * condición a una frase.
 *
 * Forma de la definición (revisión 2026-07-15, GET /flows/{id}
 * ?additional-fields[flow]=definition): `definition.triggers[]`,
 * `definition.actions[]` con `{ id, type, links: { next | next_if_true,
 * next_if_false }, data }` y `definition.entry_action_id`.
 */

export type FlowGraphNode = {
  id: string;
  kind: "email" | "sms" | "push" | "delay" | "split" | "update" | "webhook" | "end" | "other";
  label: string;
  /** Asunto del email, o null. */
  subject?: string | null;
  template_id?: string | null;
  next?: string | null;
  yes?: string | null;
  no?: string | null;
};

export type FlowGraph = {
  version: 1;
  entry: string | null;
  triggers: Array<{ type: string; label: string }>;
  nodes: FlowGraphNode[];
  truncated: boolean;
};

type Row = Record<string, unknown>;
type Names = { metrics?: Map<string, string>; audiences?: Map<string, string> };

const MAX_NODES = 80;

export function buildKlaviyoFlowGraph(response: unknown, names: Names = {}): FlowGraph | null {
  const root = row(response);
  const data = row(root?.data) ?? root;
  const attributes = row(data?.attributes) ?? data;
  const definition = row(attributes?.definition);
  if (!definition) return null;

  const actions = array(definition.actions);
  const nodes = actions.slice(0, MAX_NODES).flatMap((value): FlowGraphNode[] => {
    const action = row(value);
    const id = str(action?.id) ?? str(action?.temporary_id);
    if (!action || !id) return [];
    const type = (str(action.type) ?? "other").toLowerCase().replaceAll("_", "-");
    const links = row(action.links) ?? {};
    const actionData = row(action.data) ?? {};
    const next = str(links.next);
    if (type === "send-email" || type === "send-sms" || type === "send-push") {
      const message = row(actionData.message) ?? {};
      const kind = type === "send-email" ? "email" : type === "send-sms" ? "sms" : "push";
      return [{
        id,
        kind,
        label: str(message.name) ?? (kind === "email" ? "Email" : kind === "sms" ? "SMS" : "Notificación push"),
        subject: str(message.subject_line) ?? str(message.subject),
        template_id: str(message.template_id),
        next,
      }];
    }
    if (type === "time-delay") return [{ id, kind: "delay", label: delayLabel(actionData), next }];
    if (type === "conditional-split" || type === "trigger-split") {
      return [{
        id,
        kind: "split",
        label: type === "trigger-split" ? "Según los datos del evento" : splitLabel(actionData, names),
        yes: str(links.next_if_true) ?? str(links.yes),
        no: str(links.next_if_false) ?? str(links.no),
      }];
    }
    if (type === "update-profile-property") return [{ id, kind: "update", label: "Actualiza el perfil", next }];
    if (type === "webhook") return [{ id, kind: "webhook", label: "Webhook", next }];
    if (type === "end-flow") return [{ id, kind: "end", label: "Fin del flow" }];
    return [{ id, kind: "other", label: `Paso «${type}»`, next }];
  });

  return {
    version: 1,
    entry: str(definition.entry_action_id) ?? nodes[0]?.id ?? null,
    triggers: array(definition.triggers).slice(0, 4).map((value) => triggerLabel(row(value) ?? {}, names)),
    nodes,
    truncated: actions.length > MAX_NODES,
  };
}

/** Acepta solo lo que escribió `buildKlaviyoFlowGraph` (lo que viene de la base). */
export function readKlaviyoFlowGraph(value: unknown): FlowGraph | null {
  const graph = row(value);
  if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes)) return null;
  return graph as unknown as FlowGraph;
}

function triggerLabel(trigger: Row, names: Names) {
  const type = (str(trigger.type) ?? "other").toLowerCase();
  const id = str(trigger.id);
  if (type === "metric") {
    const name = id ? names.metrics?.get(id) : undefined;
    return { type, label: name ? `Cuando alguien hace «${name}»` : "Cuando ocurre un evento" };
  }
  if (type === "list" || type === "segment") {
    const name = id ? names.audiences?.get(id) : undefined;
    const what = type === "list" ? "la lista" : "el segmento";
    return { type, label: name ? `Al entrar en ${what} «${name}»` : `Al entrar en ${what}` };
  }
  const fixed: Record<string, string> = {
    date: "En una fecha del perfil",
    "price-drop": "Cuando baja el precio de un producto visto",
    "low-stock": "Cuando queda poco stock",
    "back-in-stock": "Cuando vuelve el stock",
  };
  return { type, label: fixed[type] ?? "Disparador" };
}

const UNIT: Record<string, [string, string]> = {
  minutes: ["minuto", "minutos"],
  hours: ["hora", "horas"],
  days: ["día", "días"],
  weeks: ["semana", "semanas"],
};

export function delayLabel(data: Row): string {
  const value = typeof data.value === "number" && Number.isFinite(data.value) ? Math.trunc(data.value) : null;
  const unit = UNIT[(str(data.unit) ?? "").toLowerCase()];
  const base = value !== null && unit ? `Espera ${value} ${value === 1 ? unit[0] : unit[1]}` : "Espera";
  const until = str(data.delay_until_time);
  return until ? `${base}, hasta las ${until.slice(0, 5)}` : base;
}

function splitLabel(data: Row, names: Names): string {
  const filter = row(data.profile_filter);
  const groups = array(filter?.condition_groups);
  const conditions = groups.flatMap((group) => array(row(group)?.conditions));
  const first = row(conditions[0]);
  if (!first) return "División condicional";
  const type = (str(first.type) ?? "").toLowerCase();
  let text = "División condicional";
  if (type.includes("metric")) {
    const metric = str(first.metric_id);
    const name = metric ? names.metrics?.get(metric) : undefined;
    text = name ? `¿Ha hecho «${name}»?` : "¿Ha hecho un evento?";
  } else if (type.includes("property")) {
    const property = str(first.property);
    text = property ? `¿Cumple «${property}»?` : "¿Cumple una propiedad del perfil?";
  } else if (type.includes("consent") || type.includes("marketing")) {
    text = "¿Acepta marketing?";
  } else if (type.includes("group") || type.includes("list") || type.includes("segment")) {
    text = "¿Está en una lista o segmento?";
  } else if (type.includes("region") || type.includes("location")) {
    text = "¿Según su ubicación?";
  }
  return conditions.length > 1 ? `${text} (+${conditions.length - 1} condiciones)` : text;
}

function row(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
