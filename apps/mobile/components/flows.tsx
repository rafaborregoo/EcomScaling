import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { ListRow, Section } from "./ui";

// Flows en solo lectura: los de Klaviyo (con sus cifras) y los diseñados en la web (con sus pasos).
// Contrato de los diseños: apps/web/src/app/marketing/flows/flow-design.ts.
type Stats = { revenue: number; recipients: number; opens_unique: number; clicks_unique: number };
type FlowStats = Stats & { delivered: number };
type GraphNode = { id: string; kind: string; label: string; subject?: string | null; next?: string | null; yes?: string | null; no?: string | null };
export type KlaviyoFlow = {
  id: string;
  name: string;
  status: string | null;
  trigger_type: string | null;
  stats: Stats | null;
  // Mismo contrato que KFlow en apps/web/src/app/marketing/klaviyo-workspace.ts.
  graph?: { entry: string | null; triggers: Array<{ label: string }>; nodes: GraphNode[] } | null;
  messages?: Array<{ action_id: string | null; message_id: string; name: string | null; subject: string | null; stats: FlowStats | null }>;
};
type Step =
  | { id: string; type: "email"; name: string; subject: string }
  | { id: string; type: "delay"; value: number; unit: "minutes" | "hours" | "days" }
  | { id: string; type: "split"; condition: { kind: string; operator?: string; value?: number | string; property?: string; member?: boolean }; yes: Step[]; no: Step[] }
  | { id: string; type: "trigger_split"; field: string; operator: string; value: number; yes: Step[]; no: Step[] }
  | { id: string; type: "update"; property: string; value: string };
type Design = {
  id: string;
  name: string;
  status: "draft" | "in_klaviyo";
  design: { trigger: { type: "metric" | "list" | "segment"; id: string }; steps: Step[] };
  updated_at: string;
};
type Account = { lists?: Array<{ id: string; name: string }>; segments?: Array<{ id: string; name: string }> };

const eur = (v: number) => fmtCurrency(v, "EUR");
const UNIT = { minutes: "minutos", hours: "horas", days: "días" } as const;
const OP: Record<string, string> = { "greater-than-or-equal": "≥", "greater-than": ">", equals: "=", "not-equals": "≠", "less-than": "<", "less-than-or-equal": "≤", contains: "contiene", "not-contains": "no contiene" };

function flowStatus(status: string | null) {
  const v = (status ?? "").toLowerCase();
  return v === "live" ? { key: "live", label: "Activo" } : v === "manual" ? { key: "manual", label: "Manual" } : { key: "draft", label: "Borrador" };
}

function describe(step: Step): string {
  switch (step.type) {
    case "email":
      return `Email · ${step.subject || step.name || "sin asunto"}`;
    case "delay":
      return `Esperar ${step.value} ${UNIT[step.unit]}`;
    case "split": {
      const k = step.condition;
      if (k.kind === "group") return k.member ? "Si está en el grupo" : "Si no está en el grupo";
      if (k.kind === "property") return `Si ${k.property} ${OP[k.operator ?? ""] ?? ""} ${k.value}`;
      return `Si cumple la condición (${OP[k.operator ?? ""] ?? ""} ${k.value})`;
    }
    case "trigger_split":
      return `Si ${step.field} ${OP[step.operator] ?? step.operator} ${step.value}`;
    case "update":
      return `Actualizar ${step.property} = ${step.value}`;
  }
}

// Diagrama vertical: nodos unidos por conectores. Las divisiones apilan las ramas Sí / No (en un móvil no caben lado a lado).
const KIND_LABEL: Record<string, string> = { email: "Email", sms: "SMS", push: "Push", delay: "Espera", split: "División", update: "Perfil", webhook: "Webhook", end: "Fin", other: "Paso", trigger: "Disparador" };
const MAX_DEPTH = 60;

const Conn = () => <View style={{ width: 1, height: 14, backgroundColor: c.edge, marginLeft: 20 }} />;

function Node({ kind, title, sub, stats, off }: { kind: string; title: string; sub?: string | null; stats?: string | null; off?: boolean }) {
  const strong = kind === "email" || kind === "sms" || kind === "push" || kind === "trigger";
  return (
    <View style={{ gap: 2, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.edge, backgroundColor: strong ? c.bg : c.surface }}>
      <Text style={{ fontSize: 12, fontFamily: font.semibold, color: off ? c.warning : c.muted }}>{KIND_LABEL[kind] ?? "Paso"}{off ? " · Sin enviar" : ""}</Text>
      <Text style={{ fontSize: 15, fontFamily: strong ? font.medium : font.regular, color: c.ink }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>«{sub}»</Text> : null}
      {stats ? <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{stats}</Text> : null}
    </View>
  );
}

function Branch({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginLeft: 12, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: c.edge }}>
      <Conn />
      <Text style={{ fontSize: 12, fontFamily: font.semibold, color: c.ink }}>{label}</Text>
      {children}
    </View>
  );
}

const End = () => (
  <>
    <Conn />
    <Node kind="end" title="Sale del flow" />
  </>
);

/** Flow de Klaviyo: recorre `graph` desde `entry` como la web (flow-diagram.tsx). */
function KlaviyoChain({ flow }: { flow: KlaviyoFlow }) {
  const graph = flow.graph;
  const byAction = new Map((flow.messages ?? []).map((m) => [m.action_id, m]));
  const live = (flow.status ?? "").toLowerCase() === "live";
  const trigger = graph?.triggers[0]?.label ?? flow.trigger_type ?? "Disparador";
  const seen = new Set<string>();

  const emailNode = (n: GraphNode) => {
    const m = byAction.get(n.id);
    const s = m?.stats;
    const stats = s && s.delivered > 0 ? `Aperturas ${Math.round((s.opens_unique / s.delivered) * 100)} % · Clics ${Math.round((s.clicks_unique / s.delivered) * 100)} % · ${eur(s.revenue)} atrib.` : live ? "Sin envíos en el periodo" : null;
    return <Node kind={n.kind} title={m?.name ?? n.label} sub={n.subject ?? m?.subject} stats={stats} off={!live} />;
  };

  function sequence(start: string | null | undefined, depth: number): ReactNode[] {
    const out: ReactNode[] = [];
    const nodes = new Map(graph!.nodes.map((n) => [n.id, n]));
    let current = start ?? null;
    let steps = depth;
    while (current && steps < MAX_DEPTH) {
      const n = nodes.get(current);
      if (!n || seen.has(current)) break;
      seen.add(current);
      steps += 1;
      out.push(<Conn key={`c-${n.id}`} />);
      if (n.kind === "split") {
        out.push(<Node key={n.id} kind="split" title={n.label} />);
        for (const [label, target] of [["Sí", n.yes], ["No", n.no]] as const) {
          const branch = sequence(target, steps);
          out.push(<Branch key={`${n.id}-${label}`} label={label}>{branch.length ? branch : <End />}</Branch>);
        }
        break;
      }
      out.push(n.kind === "email" || n.kind === "sms" || n.kind === "push" ? <View key={n.id}>{emailNode(n)}</View> : <Node key={n.id} kind={n.kind} title={n.label} />);
      current = n.next ?? null;
    }
    return out;
  }

  // Sin grafo (aún no sincronizado): los emails guardados, en orden.
  const body = graph?.entry
    ? sequence(graph.entry, 0)
    : (flow.messages ?? []).map((m) => (
        <View key={m.message_id}>
          <Conn />
          <Node kind="email" title={m.name ?? "Email"} sub={m.subject} off={!live} />
        </View>
      ));
  return (
    <View>
      <Node kind="trigger" title={trigger} />
      {body}
    </View>
  );
}

/** Flow diseñado en la web: mismo dibujo a partir de los pasos. */
function Steps({ steps }: { steps: Step[] }) {
  return (
    <View>
      {steps.map((s) => {
        const branches = s.type === "split" || s.type === "trigger_split" ? s : null;
        const title = s.type === "email" ? s.subject || s.name || "Sin asunto" : describe(s);
        return (
          <View key={s.id}>
            <Conn />
            <Node kind={s.type === "trigger_split" ? "split" : s.type} title={title} />
            {branches &&
              ([["Sí", branches.yes], ["No", branches.no]] as const).map(([label, list]) => (
                <Branch key={label} label={label}>{list.length ? <Steps steps={list} /> : <End />}</Branch>
              ))}
          </View>
        );
      })}
    </View>
  );
}

function countEmails(steps: Step[]): number {
  return steps.reduce((n, s) => n + (s.type === "email" ? 1 : s.type === "split" || s.type === "trigger_split" ? countEmails(s.yes) + countEmails(s.no) : 0), 0);
}

const PILL = {
  live: { bg: "#e3f1e6", fg: "#1f6b34" },
  draft: { bg: "#fbf0cf", fg: c.warning },
  manual: { bg: c.accentTint, fg: c.muted },
} as const;

/** Nombre y detalle a la izquierda; estado y cifra a la derecha. */
function FlowRow({ first, title, pill, meta, revenue, onPress }: { first: boolean; title: string; pill: { label: string; tone: keyof typeof PILL }; meta: string; revenue?: string | null; onPress: () => void }) {
  const tone = PILL[pill.tone];
  return (
    <ListRow first={first} onPress={onPress} right={<ChevronRight size={18} color={c.muted} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ fontSize: 16, fontFamily: font.medium, color: c.ink }}>{title}</Text>
          {meta ? <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{meta}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: tone.bg }}>
            <Text style={{ fontSize: 12, fontFamily: font.semibold, color: tone.fg }}>{pill.label}</Text>
          </View>
          {revenue ? <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{revenue}</Text> : null}
        </View>
      </View>
    </ListRow>
  );
}

export function FlowsSection({ orgId, flows, account }: { orgId: string; flows: KlaviyoFlow[]; account: Account | undefined }) {
  const designs = useApi<{ designs?: Design[] }>(`/v1/organizations/${orgId}/marketing/flow-designs`);
  const [flow, setFlow] = useState<KlaviyoFlow | null>(null);
  const [design, setDesign] = useState<Design | null>(null);
  const list = designs.data?.designs ?? [];
  const trigger = (d: Design) => {
    const t = d.design.trigger;
    if (t.type === "list") return `Al entrar en ${account?.lists?.find((l) => l.id === t.id)?.name ?? "una lista"}`;
    if (t.type === "segment") return `Al entrar en ${account?.segments?.find((l) => l.id === t.id)?.name ?? "un segmento"}`;
    return "Al hacer una acción de la tienda";
  };

  return (
    <>
      {list.length > 0 && (
        <Section title="En preparación" count={list.length} hint="Flows que has diseñado en E-NORA. Hasta que pasan a Klaviyo no envían nada.">
          {list.map((d, i) => (
            <FlowRow
              key={d.id}
              first={i === 0}
              title={d.name}
              pill={d.status === "in_klaviyo" ? { label: "En Klaviyo", tone: "live" } : { label: "Borrador", tone: "draft" }}
              meta={`${countEmails(d.design.steps)} emails`}
              onPress={() => setDesign(d)}
            />
          ))}
        </Section>
      )}
      <Section title="En Klaviyo" count={flows.length} hint="Los flows de tu cuenta de Klaviyo, con lo que han generado en el periodo.">
        {flows.map((f, i) => {
          const st = flowStatus(f.status);
          const emails = f.messages?.length ?? 0;
          const when = f.graph?.triggers[0]?.label ?? f.trigger_type;
          return (
            <FlowRow
              key={f.id}
              first={i === 0}
              title={f.name}
              pill={{ label: st.label, tone: st.key === "live" ? "live" : st.key === "draft" ? "draft" : "manual" }}
              meta={[emails ? `${emails} emails` : null, when].filter(Boolean).join(" · ")}
              revenue={f.stats ? eur(f.stats.revenue) : null}
              onPress={() => setFlow(f)}
            />
          );
        })}
        {flows.length === 0 && <ListRow first><Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>No hay flows.</Text></ListRow>}
      </Section>

      <Sheet visible={Boolean(flow)} onClose={() => setFlow(null)} title={flow?.name ?? ""}>
        {flow && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>{flowStatus(flow.status).label}{flow.trigger_type ? ` · ${flow.trigger_type}` : ""}</Text>
            {flow.stats ? (
              [["Ingresos atribuidos", eur(flow.stats.revenue)], ["Destinatarios", fmtNum(flow.stats.recipients)], ["Aperturas únicas", fmtNum(flow.stats.opens_unique)], ["Clics únicos", fmtNum(flow.stats.clicks_unique)]].map(([label, value]) => (
                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: c.edge }}>
                  <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.muted }}>{label}</Text>
                  <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{value}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Sin cifras en este periodo.</Text>
            )}
            <KlaviyoChain flow={flow} />
          </View>
        )}
      </Sheet>

      <Sheet visible={Boolean(design)} onClose={() => setDesign(null)} title={design?.name ?? ""}>
        {design && (
          <View style={{ gap: 16 }}>
            <Node kind="trigger" title={trigger(design)} />
            {design.design.steps.length ? <Steps steps={design.design.steps} /> : <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Este flow aún no tiene pasos.</Text>}
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>Se edita desde la web.</Text>
          </View>
        )}
      </Sheet>
    </>
  );
}
