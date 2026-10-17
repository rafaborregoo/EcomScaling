import { Text, View } from "react-native";
import { c, font, klaviyo } from "../lib/theme";

// Estructuras de lectura sin tarjetas, compartidas por Inicio y Métricas: franja de cifras, barras de tasa,
// barras por concepto y embudo en vertical. El color lo pone cada canal.
export const smallTitle = { fontSize: 13, fontFamily: font.semibold, color: c.muted, letterSpacing: 0.6, textTransform: "uppercase" } as const;

/** Cifras en una franja separadas por líneas verticales, sin tarjetas. */
export function Strip({ title, color, items }: { title?: string; color?: string; items: Array<{ label: string; value: string; delta?: number | null; lowerIsBetter?: boolean }> }) {
  return (
    <View style={{ gap: 10 }}>
      {title ? <Text style={smallTitle}>{title}</Text> : null}
      <View style={{ flexDirection: "row" }}>
        {items.map((it, i) => {
          const good = it.delta != null && (it.lowerIsBetter ? it.delta <= 0 : it.delta >= 0);
          return (
            <View key={it.label} style={{ flex: 1, paddingLeft: i === 0 ? 0 : 12, marginLeft: i === 0 ? 0 : 12, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.edge }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, fontFamily: font.semibold, color: color ?? c.ink }}>{it.value}</Text>
              <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{it.label}</Text>
              {it.delta != null && Number.isFinite(it.delta) && (
                <Text style={{ fontSize: 12, fontFamily: font.medium, color: good ? klaviyo.mint : c.danger }}>{it.delta >= 0 ? "▲" : "▼"} {Math.abs(it.delta).toFixed(1).replace(".", ",")} %</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Del envío a la compra: una barra por paso, a escala real (0-100 %). */
export function RateBars({ title = "Del envío a la compra", steps, colors = [klaviyo.mint, "#2bb894", c.ink], track = klaviyo.soft }: { title?: string; steps: Array<{ label: string; rate: number | null; value: string }>; colors?: string[]; track?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={smallTitle}>{title}</Text>
      {steps.map((s, i) => (
        <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ width: 84, fontSize: 14, fontFamily: font.medium, color: c.ink }}>{s.label}</Text>
          <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: track, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(2, Math.min(100, (s.rate ?? 0) * 100))}%`, height: 12, borderRadius: 6, backgroundColor: colors[i] ?? colors[0] }} />
          </View>
          <Text style={{ width: 62, textAlign: "right", fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}
/** Una barra por concepto, a la escala del mayor: se lee de un vistazo cuánto se queda cada coste. */
export function Bars({ title, rows }: { title: string; rows: Array<{ label: string; value: number; shown: string; color: string; strong?: boolean }> }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <View style={{ gap: 12 }}>
      <Text style={smallTitle}>{title}</Text>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, fontFamily: r.strong ? font.semibold : font.regular, color: c.ink }}>{r.label}</Text>
            <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{r.shown}</Text>
          </View>
          <View style={{ height: r.strong ? 10 : 6, borderRadius: 5, backgroundColor: c.surface }}>
            <View style={{ width: `${Math.max(1, (Math.abs(r.value) / max) * 100)}%`, height: "100%", borderRadius: 5, backgroundColor: r.color }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Embudo en vertical: cada paso es una barra centrada más estrecha que la anterior. */
export function Tunnel({ title, steps, shades = ["#004c3f", "#008060", "#2f9e7c", "#5db596"] }: { title: string; steps: Array<{ label: string; value: string; rate: number }>; shades?: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...smallTitle, paddingBottom: 4 }}>{title}</Text>
      {steps.map((s, i) => (
        <View key={s.label} style={{ alignItems: "center" }}>
          <View style={{ width: `${Math.max(42, Math.min(100, s.rate * 100))}%`, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", backgroundColor: shades[i] ?? shades[3] }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14, fontFamily: font.semibold, color: "#fff" }}>{`${s.label} · ${s.value}`}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

