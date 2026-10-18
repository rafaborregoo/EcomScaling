import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { c, font, GOOD, useTheme } from "../lib/theme";
import { LineChart, type Point } from "./chart";
import { smallTitle } from "./bloques";

// Piezas de Inicio. Todas las vistas (Todo, Shopify, Meta, Klaviyo) siguen el mismo orden para que se lean igual:
// cifra principal con su gráfico → "Para hoy" (lo que pide atención) → filas que abren el detalle → enlace a Métricas.


/** Variación con flecha. `pp`: puntos porcentuales (una tasa que pasa del 2,0 % al 2,2 % sube 0,2 pp, no un 10 %). */
const arrow = (delta: number, pp?: boolean) => `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(pp ? 2 : 1).replace(".", ",")}${pp ? " pp" : " %"}`;

/** Periodo "Hoy" en el selector: desde las 00:00 de la tienda. */
export const TODAY = 0;

/** Nombre de la tienda a la izquierda y periodo a la derecha, en una sola línea. La opción `TODAY` se lee "Hoy". El consultor no
 * ve el nombre (ya lo dice el selector de cliente de su cabecera): llega vacío. */
export function TopBar({ name, options, days, onChange }: { name: string; options: number[]; days: number; onChange: (d: number) => void }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: c.muted }}>{name}</Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {options.map((d) => {
          const on = d === days;
          return (
            <Pressable key={d} onPress={() => onChange(d)} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d === TODAY ? "Hoy" : `${d} días`}>
              <Text style={{ fontSize: 13, fontFamily: on ? font.semibold : font.regular, color: on ? th.ink : c.muted }}>{d === TODAY ? "Hoy" : `${d} d`}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type HeroMetric = {
  key: string;
  label: string;
  value: string;
  delta?: number | null;
  /** Bajar es bueno (CAC, costes). */
  lowerIsBetter?: boolean;
  /** Ni buena ni mala (la inversión): la variación va en gris. */
  neutral?: boolean;
  /** La variación está en puntos porcentuales (tasas). */
  pp?: boolean;
  /** Serie del gráfico; sin ella la cifra se enseña sola. */
  points?: Point[];
  format?: (v: number) => string;
};

/**
 * Cifra principal de la vista: una sola, grande, con su variación y su gráfico. Las demás esperan en las pastillas
 * de debajo: tocar una la pone arriba. Mantener pulsado el gráfico enseña el valor de cada día.
 */
export function Hero({ metrics, compare, height = 160 }: { metrics: HeroMetric[]; compare: string; height?: number }) {
  const th = useTheme();
  const [key, setKey] = useState(metrics[0]?.key);
  const [active, setActive] = useState<number | null>(null);
  const m = metrics.find((x) => x.key === key) ?? metrics[0];
  if (!m) return null;
  const point = active !== null ? m.points?.[active] : undefined;
  const hasChart = !!m.points?.some((p) => p.y !== null);
  const good = m.delta != null && (m.lowerIsBetter ? m.delta <= 0 : m.delta >= 0);

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>{m.label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 40, fontFamily: font.semibold, color: th.tone }}>
        {point ? (point.y == null ? "—" : (m.format ?? String)(point.y)) : m.value}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: font.medium, color: point || m.delta == null || !Number.isFinite(m.delta) ? c.muted : m.neutral ? c.muted : good ? GOOD : c.danger }}>
        {point ? point.label : m.delta != null && Number.isFinite(m.delta) ? `${arrow(m.delta, m.pp)} vs ${compare}` : " "}
      </Text>
      {hasChart && (
        <View style={{ marginTop: 8 }}>
          <LineChart key={m.key} series={[{ name: m.label, color: "accent", points: m.points ?? [] }]} height={height} onActive={setActive} />
        </View>
      )}
      {metrics.length > 1 && (
        // Pestañas de texto: la activa en negrita con una raya debajo. Sin "de hoy": ya lo dice el periodo.
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 8 }}>
          {metrics.map((x) => {
            const on = x.key === m.key;
            return (
              <Pressable
                key={x.key}
                onPress={() => {
                  setKey(x.key);
                  setActive(null);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={x.label}
                style={{ paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: on ? th.tone : "transparent" }}
              >
                <Text style={{ fontSize: 14, fontFamily: on ? font.semibold : font.regular, color: on ? th.ink : c.muted }}>{x.label.replace(/ de hoy$/, "")}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Bloque con título corto en versalitas. */
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <Text style={smallTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

/** "Para hoy" sin nada pendiente: una sola fila tranquila en vez de un hueco. */
export function AllClear() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#e0f5ee" }}>
        <Check size={14} color={GOOD} strokeWidth={3} />
      </View>
      <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>Todo en orden</Text>
    </View>
  );
}

/** Fila de un canal en Todo: color de marca, su cifra propia y variación. Tocarla abre la vista del canal. */
export function ChannelRow({ name, color, caption, value, delta, pp, lowerIsBetter, first, onPress }: { name: string; color: string; caption: string; value?: string; delta?: number | null; pp?: boolean; lowerIsBetter?: boolean; first?: boolean; onPress: () => void }) {
  const good = delta != null && (lowerIsBetter ? delta <= 0 : delta >= 0);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${name}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: first ? 0 : 1, borderTopColor: c.edge }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{caption}</Text>
      </View>
      {value ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 17, fontFamily: font.semibold, color: c.ink }}>{value}</Text>
          {delta != null && Number.isFinite(delta) && <Text style={{ fontSize: 12, fontFamily: font.medium, color: good ? GOOD : c.danger }}>{arrow(delta, pp)}</Text>}
        </View>
      ) : null}
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}

/** Enlace al final de cada vista: el detalle completo vive en Métricas. */
export function MoreLink({ label = "Ver todas las cifras", onPress }: { label?: string; onPress: () => void }) {
  const th = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 }}>
      <Text style={{ fontSize: 14, fontFamily: font.semibold, color: th.ink }}>{label}</Text>
      <ChevronRight size={16} color={th.ink} />
    </Pressable>
  );
}
