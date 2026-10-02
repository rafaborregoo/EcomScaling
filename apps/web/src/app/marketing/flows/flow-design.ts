/**
 * Flow diseñado en NORA (Marketing → Flows). Mismo contrato que valida la API
 * en apps/api/src/marketing-flows.ts (`flowDesignSchema`); la conversión al
 * formato de Klaviyo vive solo allí, y la vista «Formato Klaviyo» se la pide.
 */

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const NUMERIC_OPERATORS = ["greater-than-or-equal", "greater-than", "equals", "not-equals", "less-than", "less-than-or-equal"] as const;
export type NumericOperator = (typeof NUMERIC_OPERATORS)[number];

export type Timeframe = { kind: "flow-start" } | { kind: "alltime" } | { kind: "in-the-last"; quantity: number; unit: "hour" | "day" | "week" };

export type FlowCondition =
  | { kind: "metric"; metric_id: string; operator: NumericOperator; value: number; timeframe: Timeframe }
  | { kind: "group"; group_id: string; member: boolean }
  | { kind: "property"; property: string; operator: "equals" | "not-equals" | "contains" | "not-contains"; value: string };

export type EmailStep = {
  id: string;
  type: "email";
  name: string;
  draft_id: string | null;
  subject: string;
  preheader: string;
  from_label: string;
  from_email: string;
  reply_to: string;
  smart_sending: boolean;
  utm: boolean;
};
export type DelayStep = { id: string; type: "delay"; value: number; unit: "minutes" | "hours" | "days"; until: string | null; weekdays: Weekday[] };
export type SplitStep = { id: string; type: "split"; condition: FlowCondition; yes: FlowStep[]; no: FlowStep[] };
export type TriggerSplitStep = { id: string; type: "trigger_split"; field: string; operator: NumericOperator; value: number; yes: FlowStep[]; no: FlowStep[] };
export type UpdateStep = { id: string; type: "update"; property: string; value: string };
export type FlowStep = EmailStep | DelayStep | SplitStep | TriggerSplitStep | UpdateStep;
export type StepType = FlowStep["type"];
export type BranchStep = SplitStep | TriggerSplitStep;

export type FlowTrigger = {
  type: "metric" | "list" | "segment";
  id: string;
  min_value: number | null;
  exclude_purchasers: boolean;
  reentry_days: number | null;
};

export type FlowDesign = { version: 1; trigger: FlowTrigger; steps: FlowStep[] };

/** Lo que el editor sabe de la cuenta: métricas, listas, segmentos y remitente. */
export type FlowAccount = {
  metrics: Array<{ id: string; name: string; integration: string | null }>;
  lists: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  fromEmail: string;
  fromLabel: string;
};

export const isBranch = (step: FlowStep): step is BranchStep => step.type === "split" || step.type === "trigger_split";

let seq = 0;
export function stepId() {
  seq += 1;
  return `s${Date.now().toString(36)}${seq.toString(36)}`;
}

export function newStep(type: StepType, account: FlowAccount, over: Partial<FlowStep> = {}): FlowStep {
  const id = stepId();
  const base: FlowStep =
    type === "email"
      ? { id, type, name: "Email", draft_id: null, subject: "", preheader: "", from_label: account.fromLabel, from_email: account.fromEmail, reply_to: "", smart_sending: true, utm: true }
      : type === "delay"
        ? { id, type, value: 1, unit: "days", until: null, weekdays: [] }
        : type === "split"
          ? { id, type, condition: { kind: "metric", metric_id: metricByName(account, "Placed Order"), operator: "greater-than-or-equal", value: 1, timeframe: { kind: "flow-start" } }, yes: [], no: [] }
          : type === "trigger_split"
            ? { id, type, field: "$value", operator: "greater-than-or-equal", value: 80, yes: [], no: [] }
            : { id, type, property: "", value: "" };
  return { ...base, ...over, id } as FlowStep;
}

/** Métrica de la cuenta por su nombre en Klaviyo; si hay varias, la de Shopify. */
export function metricByName(account: Pick<FlowAccount, "metrics">, name: string): string {
  const matches = account.metrics.filter((metric) => metric.name === name);
  return (matches.find((metric) => (metric.integration ?? "").toLowerCase().includes("shopify")) ?? matches[0])?.id ?? "";
}

// ---------------------------------------------------------------------------
// Árbol. Cada lista de pasos tiene un id: "root" o "<idDivisión>:yes|no".

export function walk(steps: FlowStep[], fn: (step: FlowStep) => void) {
  for (const step of steps) {
    fn(step);
    if (isBranch(step)) {
      walk(step.yes, fn);
      walk(step.no, fn);
    }
  }
}

export function findList(steps: FlowStep[], listId: string, here = "root"): FlowStep[] | null {
  if (listId === here) return steps;
  for (const step of steps) {
    if (isBranch(step)) {
      const hit = findList(step.yes, listId, `${step.id}:yes`) ?? findList(step.no, listId, `${step.id}:no`);
      if (hit) return hit;
    }
  }
  return null;
}

export function locate(steps: FlowStep[], id: string, listId = "root"): { list: FlowStep[]; index: number; listId: string; step: FlowStep } | null {
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]!;
    if (step.id === id) return { list: steps, index, listId, step };
    if (isBranch(step)) {
      const hit = locate(step.yes, id, `${step.id}:yes`) ?? locate(step.no, id, `${step.id}:no`);
      if (hit) return hit;
    }
  }
  return null;
}

/** ¿`listId` está dentro de las ramas de `step`? (no se puede mover una división dentro de sí misma) */
export function containsList(step: FlowStep, listId: string): boolean {
  if (!isBranch(step)) return false;
  if (listId === `${step.id}:yes` || listId === `${step.id}:no`) return true;
  return [...step.yes, ...step.no].some((child) => containsList(child, listId));
}

/**
 * Inserta en su sitio (muta `steps`). Una división termina la rama: lo que
 * venía detrás pasa a su rama «Sí», y detrás de una división no se puede poner
 * nada en la misma rama.
 */
export function insertStep(steps: FlowStep[], listId: string, index: number, step: FlowStep) {
  const list = findList(steps, listId);
  if (!list) return;
  if (isBranch(step)) step.yes = [...step.yes, ...list.splice(index)];
  const before = list[index - 1];
  if (before && isBranch(before)) before.yes.push(step);
  else list.splice(index, 0, step);
}

/** Quita un paso (muta `steps`). Al borrar una división, su rama «Sí» ocupa su sitio. */
export function removeStep(steps: FlowStep[], id: string) {
  const hit = locate(steps, id);
  if (!hit) return;
  const [step] = hit.list.splice(hit.index, 1);
  if (step && isBranch(step) && step.yes.length) hit.list.splice(hit.index, 0, ...step.yes);
}

/** Copia profunda con ids nuevos. */
export function cloneStep(step: FlowStep): FlowStep {
  const copy = { ...structuredClone(step), id: stepId() } as FlowStep;
  if (isBranch(copy)) {
    copy.yes = copy.yes.map(cloneStep);
    copy.no = copy.no.map(cloneStep);
  }
  return copy;
}

/** Al final de la rama principal, o de la rama «No» de la última división. */
export function tailList(steps: FlowStep[]): { listId: string; index: number } {
  let listId = "root";
  let list = steps;
  for (let last = list[list.length - 1]; last && isBranch(last); last = list[list.length - 1]) {
    listId = `${last.id}:no`;
    list = last.no;
  }
  return { listId, index: list.length };
}

// ---------------------------------------------------------------------------
// Textos

/** Nombres de Klaviyo más habituales, en castellano. El resto se enseña tal cual. */
const METRIC_ES: Record<string, string> = {
  "Started Checkout": "Empezó el pago",
  "Placed Order": "Hizo un pedido",
  "Ordered Product": "Compró un producto",
  "Viewed Product": "Vio un producto",
  "Added to Cart": "Añadió al carrito",
  "Fulfilled Order": "Pedido enviado",
  "Cancelled Order": "Pedido cancelado",
  "Refunded Order": "Pedido reembolsado",
  "Active on Site": "Visitó la tienda",
  "Opened Email": "Abrió un email",
  "Clicked Email": "Hizo clic en un email",
  "Received Email": "Recibió un email",
  "Subscribed to List": "Se apuntó a una lista",
  "Checkout Started": "Empezó el pago",
};

/** Qué significa cada métrica habitual, dicho como lo vive la tienda. */
const METRIC_HELP: Record<string, string> = {
  "Started Checkout": "Alguien llegó al pago de la tienda (dejó su email) y no ha terminado. Es el disparador del carrito abandonado.",
  "Checkout Started": "Alguien llegó al pago de la tienda y no ha terminado. Es el disparador del carrito abandonado.",
  "Placed Order": "Alguien hizo un pedido. Sirve para agradecer, pedir reseña o preparar la segunda compra.",
  "Ordered Product": "Se envía una vez por cada producto de un pedido: útil para flows por producto o categoría.",
  "Fulfilled Order": "El pedido salió del almacén. Buen momento para cuidados de uso y, días después, pedir reseña.",
  "Viewed Product": "Alguien identificado vio la ficha de un producto. Dispara la navegación abandonada. Necesita el script de Klaviyo en la tienda.",
  "Added to Cart": "Alguien añadió algo al carrito, antes de llegar al pago.",
  "Active on Site": "Alguien identificado visitó la tienda, aunque no mirara productos.",
  "Cancelled Order": "Se canceló un pedido.",
  "Refunded Order": "Se devolvió el dinero de un pedido.",
  "Subscribed to List": "Alguien se apuntó a una lista. Para la bienvenida suele ser mejor «Se apunta a una lista».",
  "Opened Email": "Abrió un email de Klaviyo. Útil en divisiones, poco como disparador.",
  "Clicked Email": "Hizo clic en un email de Klaviyo.",
  "Received Email": "Klaviyo le entregó un email.",
};

export function metricHelp(account: Pick<FlowAccount, "metrics">, id: string): string | null {
  const metric = account.metrics.find((item) => item.id === id);
  return metric ? (METRIC_HELP[metric.name] ?? null) : null;
}

/** Métricas que manda la tienda (no las que genera Klaviyo al enviar). */
export const STORE_METRICS = ["Started Checkout", "Checkout Started", "Placed Order", "Ordered Product", "Fulfilled Order", "Viewed Product", "Added to Cart"];

export function hasStoreMetrics(account: Pick<FlowAccount, "metrics">): boolean {
  return account.metrics.some((metric) => STORE_METRICS.includes(metric.name));
}

/** Métricas agrupadas por quién las envía, tienda primero. */
export function groupedMetrics(account: Pick<FlowAccount, "metrics">): Array<{ label: string; metrics: FlowAccount["metrics"] }> {
  const groups = new Map<string, FlowAccount["metrics"]>();
  for (const metric of account.metrics) {
    const integration = metric.integration ?? "Otras";
    const label = integration === "Klaviyo" ? "Klaviyo (emails enviados)" : integration;
    groups.set(label, [...(groups.get(label) ?? []), metric]);
  }
  return [...groups.entries()]
    .map(([label, metrics]) => ({ label, metrics }))
    .sort((a, b) => Number(b.metrics.some((m) => STORE_METRICS.includes(m.name))) - Number(a.metrics.some((m) => STORE_METRICS.includes(m.name))) || a.label.localeCompare(b.label));
}

export function metricLabel(account: Pick<FlowAccount, "metrics">, id: string): string {
  const metric = account.metrics.find((item) => item.id === id);
  if (!metric) return id ? "Métrica que ya no está en la cuenta" : "Sin elegir";
  return METRIC_ES[metric.name] ?? metric.name;
}

export const OPERATOR_LABEL: Record<NumericOperator, string> = {
  "greater-than-or-equal": "al menos",
  "greater-than": "más de",
  equals: "exactamente",
  "not-equals": "distinto de",
  "less-than": "menos de",
  "less-than-or-equal": "como mucho",
};
export const OPERATOR_SYMBOL: Record<NumericOperator, string> = {
  "greater-than-or-equal": "≥",
  "greater-than": ">",
  equals: "=",
  "not-equals": "≠",
  "less-than": "<",
  "less-than-or-equal": "≤",
};

export function timeframeLabel(timeframe: Timeframe): string {
  if (timeframe.kind === "flow-start") return "desde que entró en el flow";
  if (timeframe.kind === "alltime") return "alguna vez";
  const unit = { hour: ["hora", "horas"], day: ["día", "días"], week: ["semana", "semanas"] }[timeframe.unit];
  return `en ${timeframe.quantity === 1 ? `la última ${unit[0]}` : `los últimos ${timeframe.quantity} ${unit[1]}`}`;
}

export function conditionQuestion(condition: FlowCondition, account: FlowAccount): string {
  if (condition.kind === "group") {
    const group = [...account.lists, ...account.segments].find((item) => item.id === condition.group_id);
    const name = group ? `«${group.name}»` : "una lista o segmento";
    return `¿${condition.member ? "Está" : "No está"} en ${name}?`;
  }
  if (condition.kind === "property") {
    const verb = { equals: "es", "not-equals": "no es", contains: "contiene", "not-contains": "no contiene" }[condition.operator];
    return `¿Su «${condition.property || "propiedad"}» ${verb} «${condition.value}»?`;
  }
  const what = metricLabel(account, condition.metric_id);
  const when = timeframeLabel(condition.timeframe);
  if (condition.operator === "equals" && condition.value === 0) return `¿No ha hecho «${what}» ${when}?`;
  if ((condition.operator === "greater-than-or-equal" && condition.value === 1) || (condition.operator === "greater-than" && condition.value === 0)) {
    return `¿Ha hecho «${what}» ${when}?`;
  }
  return `¿Ha hecho «${what}» ${OPERATOR_LABEL[condition.operator]} ${condition.value} ${condition.value === 1 ? "vez" : "veces"} ${when}?`;
}

export const TRIGGER_FIELDS: Array<[string, string]> = [
  ["$value", "Importe del evento"],
  ["ItemCount", "Número de productos"],
];

export function triggerSplitQuestion(step: TriggerSplitStep): string {
  const field = TRIGGER_FIELDS.find(([key]) => key === step.field)?.[1] ?? step.field;
  return `¿${field} ${OPERATOR_SYMBOL[step.operator]} ${step.value}${step.field === "$value" ? " €" : ""}?`;
}

export function delayText(step: DelayStep): string {
  const unit = { minutes: ["minuto", "minutos"], hours: ["hora", "horas"], days: ["día", "días"] }[step.unit];
  let text = `Espera ${step.value} ${unit[step.value === 1 ? 0 : 1]}`;
  if (step.unit === "days" && step.until) text += ` · sale a las ${step.until}`;
  if (step.unit === "days" && step.weekdays.length && step.weekdays.length < 7) {
    text += ` · solo ${step.weekdays.map((day) => DAY_SHORT[day]).join(" ")}`;
  }
  return text;
}

export const DAY_SHORT: Record<Weekday, string> = { monday: "L", tuesday: "M", wednesday: "X", thursday: "J", friday: "V", saturday: "S", sunday: "D" };
export const DAY_NAME: Record<Weekday, string> = { monday: "lunes", tuesday: "martes", wednesday: "miércoles", thursday: "jueves", friday: "viernes", saturday: "sábado", sunday: "domingo" };

export function triggerText(trigger: FlowTrigger, account: FlowAccount): string {
  if (!trigger.id) return "Elige qué lo dispara";
  if (trigger.type === "metric") return metricLabel(account, trigger.id);
  const pool = trigger.type === "list" ? account.lists : account.segments;
  const name = pool.find((item) => item.id === trigger.id)?.name;
  return name ? `Entra en «${name}»` : trigger.type === "list" ? "Se apunta a una lista" : "Entra en un segmento";
}

// ---------------------------------------------------------------------------
// Revisión

export type FlowCheck = { state: "ok" | "warn" | "bad"; title: string; text: string; target?: string };

/** Métricas de intención: quien las hace suele comprar solo si le das tiempo. */
const INTENT_METRICS = ["Started Checkout", "Checkout Started", "Viewed Product", "Added to Cart"];

export function reviewFlow(design: FlowDesign, account: FlowAccount, pieces: Map<string, { status: string }>): FlowCheck[] {
  const checks: FlowCheck[] = [];
  const add = (state: FlowCheck["state"], title: string, text: string, target?: string) => checks.push({ state, title, text, ...(target ? { target } : {}) });
  const t = design.trigger;
  const emails: EmailStep[] = [];
  walk(design.steps, (step) => {
    if (step.type === "email") emails.push(step);
  });

  add(t.id ? "ok" : "bad", "Disparador elegido", t.id ? triggerText(t, account) : "Elige qué hace entrar a la gente en el flow.", t.id ? undefined : "trigger");
  const intent = t.type === "metric" && INTENT_METRICS.includes(account.metrics.find((metric) => metric.id === t.id)?.name ?? "");
  const placedOrder = metricByName(account, "Placed Order");
  if (t.exclude_purchasers && !placedOrder) {
    add("bad", "Sale del flow quien ya compra", "Klaviyo no está conectado a Shopify: desactiva esta opción o conéctalo.", "trigger");
  } else {
    add(intent && !t.exclude_purchasers ? "bad" : "ok", "Sale del flow quien ya compra", intent && !t.exclude_purchasers ? "Sin este filtro, quien compra sigue recibiendo recordatorios del carrito." : intent ? "Quien compra sale en el siguiente paso." : "No hace falta con este disparador.", intent && !t.exclude_purchasers ? "trigger" : undefined);
  }

  const noPiece = emails.find((email) => !email.draft_id);
  add(noPiece ? "bad" : "ok", "Cada email tiene su contenido", noPiece ? `«${noPiece.name}» no tiene pieza del Estudio: Klaviyo no tendría qué mandar.` : `${emails.length} email${emails.length === 1 ? "" : "s"} con pieza.`, noPiece?.id);
  const notApproved = emails.find((email) => email.draft_id && pieces.get(email.draft_id)?.status !== "approved");
  add(
    notApproved ? "warn" : "ok",
    "Piezas aprobadas",
    notApproved ? `La pieza de «${notApproved.name}» aún no está aprobada. Se puede seguir diseñando, pero no crearlo en Klaviyo.` : "Todas las piezas están aprobadas.",
    notApproved?.id,
  );
  const noSubject = emails.find((email) => !email.subject.trim());
  add(noSubject ? "bad" : "ok", "Cada email tiene asunto", noSubject ? `«${noSubject.name}» no tiene asunto.` : "Todos tienen asunto.", noSubject?.id);
  const badFrom = emails.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.from_email));
  add(badFrom ? "bad" : "ok", "Remitente válido", badFrom ? `El remitente de «${badFrom.name}» no es un email.` : "Todos salen de un email válido.", badFrom?.id);
  const longSubject = emails.find((email) => email.subject.length > 60);
  add(longSubject ? "warn" : "ok", "Asuntos de menos de 60 caracteres", longSubject ? `«${longSubject.subject.slice(0, 40)}…» se corta en el móvil.` : "Se leen enteros en el móvil.", longSubject?.id);
  const noSmart = emails.find((email) => !email.smart_sending);
  add(noSmart ? "warn" : "ok", "Envío inteligente", noSmart ? `«${noSmart.name}» puede llegar a quien recibió otro email hace menos de 16 horas.` : "Nadie recibe dos emails seguidos.", noSmart?.id);
  const first = design.steps[0];
  add(intent && first?.type === "email" ? "warn" : "ok", "Da tiempo a volver solo", intent && first?.type === "email" ? "El primer email sale en el acto: pon antes una espera de 1 a 4 horas." : "Hay una espera antes del primer email.", intent && first?.type === "email" ? first.id : undefined);
  let emptySplit: BranchStep | null = null;
  let orphanTriggerSplit: TriggerSplitStep | null = null;
  let incomplete: FlowStep | null = null;
  walk(design.steps, (step) => {
    if (isBranch(step) && !step.yes.length && !step.no.length) emptySplit = step;
    if (step.type === "trigger_split" && t.type !== "metric") orphanTriggerSplit = step;
    if (step.type === "split") {
      const c = step.condition;
      if (c.kind === "metric" ? !c.metric_id : c.kind === "group" ? !c.group_id : !c.property) incomplete = step;
    }
    if ((step.type === "trigger_split" && !step.field) || (step.type === "update" && !step.property)) incomplete = step;
  });
  if (incomplete) add("bad", "Pasos completos", "Hay una división o un «Actualizar perfil» sin terminar de rellenar.", (incomplete as FlowStep).id);
  add(emptySplit ? "warn" : "ok", "Cada división lleva a algo", emptySplit ? "Hay una división con las dos ramas vacías: no cambia nada." : "Todas las divisiones tienen pasos.", (emptySplit as BranchStep | null)?.id);
  if (orphanTriggerSplit) add("bad", "División por disparador", "Solo sirve si el flow empieza por algo que hace la persona, no por una lista o segmento.", (orphanTriggerSplit as TriggerSplitStep).id);
  add(emails.length ? "ok" : "bad", "El flow manda algo", emails.length ? `${emails.length} email${emails.length === 1 ? "" : "s"} en total.` : "No hay ningún email.");
  return checks;
}

// ---------------------------------------------------------------------------
// Plantillas de flow

export type FlowTemplate = {
  key: "cart" | "welcome" | "browse" | "post" | "winback";
  name: string;
  why: string;
  shape: string;
  build: (account: FlowAccount) => { name: string; design: FlowDesign };
};

const email = (account: FlowAccount, name: string, subject: string, preheader: string) =>
  newStep("email", account, { name, subject, preheader } as Partial<EmailStep>);
const wait = (account: FlowAccount, value: number, unit: DelayStep["unit"], until: string | null = null) =>
  newStep("delay", account, { value, unit, until } as Partial<DelayStep>);
const bought = (account: FlowAccount, yes: FlowStep[], no: FlowStep[]) =>
  newStep("split", account, {
    condition: { kind: "metric", metric_id: metricByName(account, "Placed Order"), operator: "greater-than-or-equal", value: 1, timeframe: { kind: "flow-start" } },
    yes,
    no,
  } as Partial<SplitStep>);
const trigger = (over: Partial<FlowTrigger>): FlowTrigger => ({ type: "metric", id: "", min_value: null, exclude_purchasers: false, reentry_days: null, ...over });

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    key: "cart",
    name: "Carrito abandonado",
    why: "Recupera pedidos que ya estaban casi hechos.",
    shape: "Empezó el pago → 4 h → email → ¿compró? → 1 d → email",
    build: (account) => ({
      name: "Carrito abandonado",
      design: {
        version: 1,
        trigger: trigger({ id: metricByName(account, "Started Checkout") || metricByName(account, "Checkout Started"), exclude_purchasers: true, reentry_days: 30 }),
        steps: [
          wait(account, 4, "hours"),
          email(account, "Recordatorio", "¿Te has dejado algo?", "Lo guardamos un rato más por si vuelves."),
          bought(account, [], [wait(account, 1, "days", "10:00"), email(account, "Última llamada", "Tu carrito sigue aquí", "Por si quieres terminarlo hoy.")]),
        ],
      },
    }),
  },
  {
    key: "welcome",
    name: "Bienvenida",
    why: "El primer email tras apuntarse es el que más se abre.",
    shape: "Se apunta → email → 2 d → ¿compró? → email",
    build: (account) => ({
      name: "Bienvenida",
      design: {
        version: 1,
        trigger: trigger({ type: "list", id: account.lists[0]?.id ?? "" }),
        steps: [
          email(account, "Bienvenida", "Te damos la bienvenida", "Lo que nos hace distintos, en dos minutos."),
          wait(account, 2, "days", "10:00"),
          bought(account, [], [email(account, "Las favoritas", "Lo que más se pide", "Por si no sabes por dónde empezar.")]),
        ],
      },
    }),
  },
  {
    key: "browse",
    name: "Navegación abandonada",
    why: "Vuelve a traer a quien miró un producto y se fue.",
    shape: "Vio un producto → 2 h → email",
    build: (account) => ({
      name: "Navegación abandonada",
      design: {
        version: 1,
        trigger: trigger({ id: metricByName(account, "Viewed Product"), exclude_purchasers: true, reentry_days: 14 }),
        steps: [wait(account, 2, "hours"), email(account, "¿Le echas otro vistazo?", "¿Te quedaste con ganas?", "Sigue disponible, por ahora.")],
      },
    }),
  },
  {
    key: "post",
    name: "Post-compra",
    why: "Prepara la segunda compra y pide reseñas.",
    shape: "Pedido enviado → 5 d → email → 10 d → email",
    build: (account) => ({
      name: "Post-compra",
      design: {
        version: 1,
        trigger: trigger({ id: metricByName(account, "Fulfilled Order") || metricByName(account, "Placed Order") }),
        steps: [
          wait(account, 5, "days", "10:00"),
          email(account, "Cuidados", "Cómo sacarle partido", "Tres consejos para que te dure años."),
          wait(account, 10, "days", "10:00"),
          email(account, "Reseña", "¿Qué tal te ha ido?", "Tu opinión ayuda a otros a elegir."),
        ],
      },
    }),
  },
  {
    key: "winback",
    name: "Recuperación de clientes",
    why: "Reactiva a quien lleva meses sin comprar.",
    shape: "Entra en un segmento → email → 7 d → ¿compró? → email",
    build: (account) => ({
      name: "Recuperación de clientes",
      design: {
        version: 1,
        trigger: trigger({ type: "segment", id: account.segments[0]?.id ?? "" }),
        steps: [
          email(account, "Te echamos de menos", "Hace tiempo que no te vemos", "Mira lo que ha llegado desde entonces."),
          wait(account, 7, "days", "10:00"),
          bought(account, [], [email(account, "Un detalle para volver", "Un detalle para ti", "Solo esta semana.")]),
        ],
      },
    }),
  },
];

export function blankFlow(): { name: string; design: FlowDesign } {
  return { name: "Flow nuevo", design: { version: 1, trigger: trigger({}), steps: [] } };
}
