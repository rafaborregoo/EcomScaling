import { useState } from "react";
import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { ListCard, ListRow, RowMeta, RowTitle } from "./ui";

// Flows en solo lectura: los de Klaviyo (con sus cifras) y los diseñados en la web (con sus pasos).
// Contrato de los diseños: apps/web/src/app/marketing/flows/flow-design.ts.
type Stats = { revenue: number; recipients: number; opens_unique: number; clicks_unique: number };
export type KlaviyoFlow = { id: string; name: string; status: string | null; trigger_type: string | null; stats: Stats | null };
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

function Steps({ steps }: { steps: Step[] }) {
  return (
    <View style={{ gap: 10 }}>
      {steps.map((s) => (
        <View key={s.id} style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontFamily: s.type === "email" ? font.medium : font.regular, color: s.type === "email" ? c.ink : c.muted }}>{describe(s)}</Text>
          {(s.type === "split" || s.type === "trigger_split") && (
            <View style={{ gap: 8, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: c.edge }}>
              <Text style={{ fontSize: 12, fontFamily: font.semibold, color: c.ink }}>Sí</Text>
              {s.yes.length ? <Steps steps={s.yes} /> : <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>Fin</Text>}
              <Text style={{ fontSize: 12, fontFamily: font.semibold, color: c.ink }}>No</Text>
              {s.no.length ? <Steps steps={s.no} /> : <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>Fin</Text>}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function countEmails(steps: Step[]): number {
  return steps.reduce((n, s) => n + (s.type === "email" ? 1 : s.type === "split" || s.type === "trigger_split" ? countEmails(s.yes) + countEmails(s.no) : 0), 0);
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
        <ListCard title={`Diseñados en NORA · ${list.length}`}>
          {list.map((d, i) => (
            <ListRow key={d.id} first={i === 0} onPress={() => setDesign(d)} right={<ChevronRight size={18} color={c.muted} />}>
              <RowTitle>{d.name}</RowTitle>
              <RowMeta tone={d.status === "in_klaviyo" ? "good" : "warn"}>{`${d.status === "in_klaviyo" ? "En Klaviyo" : "Borrador"} · ${countEmails(d.design.steps)} emails`}</RowMeta>
            </ListRow>
          ))}
        </ListCard>
      )}
      <ListCard title={`En Klaviyo · ${flows.length}`}>
        {flows.map((f, i) => {
          const st = flowStatus(f.status);
          return (
            <ListRow key={f.id} first={i === 0} onPress={() => setFlow(f)} right={f.stats ? <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{eur(f.stats.revenue)}</Text> : <ChevronRight size={18} color={c.muted} />}>
              <RowTitle>{f.name}</RowTitle>
              <RowMeta tone={st.key === "live" ? "good" : st.key === "draft" ? "warn" : undefined}>{st.label}</RowMeta>
            </ListRow>
          );
        })}
        {flows.length === 0 && <ListRow first><RowMeta>No hay flows.</RowMeta></ListRow>}
      </ListCard>

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
          </View>
        )}
      </Sheet>

      <Sheet visible={Boolean(design)} onClose={() => setDesign(null)} title={design?.name ?? ""}>
        {design && (
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.ink }}>{trigger(design)}</Text>
            {design.design.steps.length ? <Steps steps={design.design.steps} /> : <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Este flow aún no tiene pasos.</Text>}
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>Se edita desde la web.</Text>
          </View>
        )}
      </Sheet>
    </>
  );
}
