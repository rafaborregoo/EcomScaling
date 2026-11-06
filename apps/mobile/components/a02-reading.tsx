import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { a02EvidenceText, a02PlainText, a02SeverityLabel, projectA02Reading, type A02Diagnostic } from "@e-nora/contracts";
import { useApi } from "../lib/use-api";
import { c, font } from "../lib/theme";
import { Sheet } from "./sheet";

export const a02MobilePath = (organizationId: string, connectionId?: string) => `/v1/organizations/${organizationId}/ai/monitor?days=30&view=overview${connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : ""}`;

export function A02MobileSlot({ organizationId, connectionId, onChannel }: {
  organizationId: string;
  connectionId?: string;
  onChannel: (channel: "shopify" | "meta" | "klaviyo") => void;
}) {
  const query = useApi<A02Diagnostic>(a02MobilePath(organizationId, connectionId));
  const [open, setOpen] = useState(false);
  const reading = projectA02Reading({ spot: "mobile", diagnostic: query.data, loading: !query.data && !query.error, error: query.error, errorCode: query.errorCode });
  const detail = reading.findings.length > 0 || reading.recommendations.length > 0;
  const date = reading.generatedAt && Number.isFinite(Date.parse(reading.generatedAt)) ? new Date(reading.generatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }) : null;
  return <View style={s.reading}>
    <View style={s.heading}><Text style={s.tag}>A02 · 09</Text><Text style={s.title}>{reading.label}</Text></View>
    {query.data?.preview ? <Text style={s.meta}>Vista previa CLI · TEST</Text> : null}
    <Text style={s.body}>{reading.summary}</Text>
    {date ? <Text style={s.meta}>Ventana de 30 días · {connectionId ? "Tienda seleccionada" : "Todas las tiendas"} · Lectura del {date}</Text> : null}
    {detail ? <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={s.action}><Text style={s.actionText}>{reading.state === "stale" ? "Consultar lectura anterior" : "Ver hallazgos y evidencia"}</Text></Pressable> : null}
    {reading.state === "unavailable" ? <Pressable accessibilityRole="button" onPress={query.retry} style={s.action}><Text style={s.actionText}>Volver a cargar</Text></Pressable> : null}
    <Sheet visible={open} onClose={() => setOpen(false)} title="A02 · 09 — Salud del negocio">
      <Text style={s.body}>{reading.summary}</Text>
      {date ? <Text style={s.meta}>Lectura del {date} · Ventana de 30 días</Text> : null}
      {reading.findings.map((finding, index) => {
        const section = finding.section;
        const channel = section === "meta" || section === "klaviyo" ? section : section === "ventas" || section === "finanzas" || section === "stock" ? "shopify" : null;
        return <View key={`${finding.title}:${index}`} style={s.finding}>
          <Text style={s.meta}>{a02SeverityLabel(finding.severity)}</Text>
          <Text style={s.title}>{a02PlainText(finding.title)}</Text>
          {finding.figures?.map((figure, i) => <View key={`${figure.label}:${i}`}><Text style={s.meta}>{a02PlainText(figure.label)}</Text><Text style={s.figure}>{figure.value}{figure.previous ? ` · antes ${figure.previous}` : ""}</Text></View>)}
          {a02EvidenceText(finding.evidence) ? <Text style={s.body}>{a02EvidenceText(finding.evidence)}</Text> : null}
          {channel ? <Pressable accessibilityRole="button" style={s.action} onPress={() => { setOpen(false); onChannel(channel); }}><Text style={s.actionText}>Revisar {channel === "shopify" ? "Shopify" : channel === "meta" ? "Meta Ads" : "Klaviyo"}</Text></Pressable> : null}
        </View>;
      })}
      {reading.recommendations.length ? <View style={s.finding}><Text style={s.title}>Qué propone revisar</Text>{reading.recommendations.map((item, index) => <Text key={index} style={s.body}>{a02PlainText(item.action)}</Text>)}<Text style={s.meta}>Las tareas se gestionan en Trabajo.</Text></View> : null}
    </Sheet>
  </View>;
}

const s = StyleSheet.create({
  reading: { paddingVertical: 16, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.edge },
  heading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  tag: { color: c.ink, fontFamily: font.semibold, fontSize: 11, borderWidth: 1, borderColor: c.edge, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  title: { color: c.ink, fontFamily: font.semibold, fontSize: 14, lineHeight: 21 },
  body: { color: c.ink, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  meta: { color: c.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  action: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  actionText: { color: c.ink, fontFamily: font.medium, fontSize: 13, textDecorationLine: "underline" },
  finding: { gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.edge },
  figure: { color: c.ink, fontFamily: font.semibold, fontSize: 15, fontVariant: ["tabular-nums"] },
});
