import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Sheet } from "./sheet";
import { c, cardStyle, font, ThemeContext, themes, useTheme, type ThemeKey } from "../lib/theme";

export function Screen({ title, subtitle, theme = "todo", flat, onRefresh, children }: { title: string; subtitle?: string | null; theme?: ThemeKey; flat?: boolean; onRefresh: () => Promise<void>; children: ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const th = themes[theme];
  return (
    <ThemeContext.Provider value={th}>
    <ScrollView
      style={{ backgroundColor: flat ? c.bg : th.paper }}
      contentContainerStyle={{ padding: 20, gap: flat ? 28 : 16, paddingBottom: flat ? 48 : 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={th.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }}
        />
      }
    >
      <View>
        <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{subtitle ?? " "}</Text>
        <Text style={{ fontSize: 24, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
      </View>
      {children}
    </ScrollView>
    </ThemeContext.Provider>
  );
}

export function Status({ error, loading, retry }: { error: string | null; loading: boolean; retry?: () => void }) {
  const th = useTheme();
  if (error) {
    return (
      <View style={{ borderRadius: 10, padding: 12, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text>
        {retry && (
          <Pressable onPress={retry}>
            <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.danger }}>Reintentar</Text>
          </Pressable>
        )}
      </View>
    );
  }
  return loading ? <ActivityIndicator color={th.accent} style={{ marginTop: 40 }} /> : null;
}

export function Note({ text, flat }: { text: string; flat?: boolean }) {
  const th = useTheme();
  if (flat) return <Text style={{ fontSize: 14, lineHeight: 21, fontFamily: font.regular, color: c.muted }}>{text}</Text>;
  return (
    <View style={{ ...cardStyle(th), padding: 16 }}>
      <Text style={{ fontSize: 14, lineHeight: 21, fontFamily: font.regular, color: c.muted }}>{text}</Text>
    </View>
  );
}

// Filtro de periodo minimalista: solo texto; el activo va en tinta, con una línea fina debajo.
export function PeriodChips({ options, value, onChange }: { options: number[]; value: number; onChange: (d: number) => void }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: c.edge }}>
      {options.map((d) => {
        const on = d === value;
        return (
          <Pressable key={d} onPress={() => onChange(d)} hitSlop={6} style={{ paddingBottom: 8, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: on ? th.accent : "transparent" }}>
            <Text style={{ fontSize: 14, fontFamily: on ? font.semibold : font.regular, color: on ? th.ink : c.muted }}>{d} días</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Hero({ label, value, delta, bars }: { label: string; value: string; delta?: number | null; bars?: number[] }) {
  const max = Math.max(1, ...(bars ?? []));
  return (
    <View style={{ borderRadius: 16, padding: 20, backgroundColor: c.accentTint, borderWidth: 1, borderColor: c.edge }}>
      <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{label}</Text>
      <Text style={{ marginTop: 4, fontSize: 34, fontFamily: font.semibold, color: c.ink }}>{value}</Text>
      {delta != null && (
        <Text style={{ marginTop: 4, fontSize: 14, fontFamily: font.medium, color: delta >= 0 ? c.accent : c.danger }}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1).replace(".", ",")} % vs periodo anterior
        </Text>
      )}
      {bars && bars.length > 0 && (
        <View style={{ marginTop: 16, height: 64, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
          {bars.map((v, i) => (
            <View key={i} style={{ flex: 1, height: Math.max(2, (v / max) * 64), backgroundColor: c.accent, borderRadius: 2 }} />
          ))}
        </View>
      )}
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  const th = useTheme();
  return (
    <View style={{ ...cardStyle(th), flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4, fontSize: 22, fontFamily: font.semibold, color: c.ink }}>{value}</Text>
    </View>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: "row", gap: 12 }}>{children}</View>;

/** Navegación secundaria de un módulo: solo texto, el activo con línea debajo (igual que el filtro de periodo). */
export function SubNav<K extends string>({ items, value, onChange }: { items: Array<{ key: K; label: string }>; value: K; onChange: (key: K) => void }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: c.edge }}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} hitSlop={6} style={{ paddingBottom: 8, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: on ? th.accent : "transparent" }}>
            <Text style={{ fontSize: 15, fontFamily: on ? font.semibold : font.regular, color: on ? th.ink : c.muted }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Agrupa filas de una lista; las filas se separan con una línea fina. `flat`: sin tarjeta, título grande sobre fondo blanco. */
export function ListCard({ title, flat, children }: { title?: string; flat?: boolean; children: ReactNode }) {
  const th = useTheme();
  return (
    <View style={flat ? undefined : { ...cardStyle(th), overflow: "hidden" }}>
      {title ? <Text style={flat ? { paddingBottom: 4, fontSize: 20, fontFamily: font.semibold, color: c.ink } : { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{title}</Text> : null}
      {children}
    </View>
  );
}

/** Fila de lista: contenido a la izquierda y valor opcional a la derecha. */
export function ListRow({ first, flat, children, right, onPress }: { first?: boolean; flat?: boolean; children: ReactNode; right?: ReactNode; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: flat ? 0 : 16, paddingVertical: flat ? 18 : 12, borderTopWidth: first ? 0 : 1, borderTopColor: c.edge }}>
      <View style={{ flex: 1 }}>{children}</View>
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export const RowTitle = ({ children }: { children: string }) => <Text numberOfLines={2} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{children}</Text>;
export const RowMeta = ({ children, tone }: { children: string; tone?: "bad" | "warn" | "good" }) => (
  <Text numberOfLines={2} style={{ fontSize: 13, fontFamily: font.regular, color: tone === "bad" ? c.danger : tone === "warn" ? c.warning : tone === "good" ? c.accent : c.muted }}>{children}</Text>
);

/** Grupo de cifras: título corto y rejilla de 2 columnas. */
export function KpiGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

/** Cifra con variación frente al periodo anterior. `lowerIsBetter` pinta en verde las bajadas (costes, devoluciones); `neutral` en gris (ni buena ni mala, p. ej. la inversión). */
export function Kpi({ label, value, delta, lowerIsBetter, neutral, dot, onPress }: { label: string; value: string; delta?: number | null; lowerIsBetter?: boolean; neutral?: boolean; dot?: string; onPress?: () => void }) {
  const th = useTheme();
  const good = delta != null && (lowerIsBetter ? delta <= 0 : delta >= 0);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ ...cardStyle(th), flexBasis: "48%", flexGrow: 1, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontFamily: font.medium, color: c.muted }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2, fontSize: 19, fontFamily: font.semibold, color: c.ink }}>{value}</Text>
      {delta != null && Number.isFinite(delta) && (
        <Text style={{ marginTop: 2, fontSize: 12, fontFamily: font.medium, color: neutral ? c.muted : good ? c.accent : c.danger }}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1).replace(".", ",")} %
        </Text>
      )}
    </Pressable>
  );
}

/** Reparto de un total en una barra apilada (las partes SÍ suman el total: gasto, ventas nuevas/recurrentes). */
export function ShareBar({ title, parts, format }: { title: string; parts: Array<{ label: string; value: number; color: string }>; format: (v: number) => string }) {
  const th = useTheme();
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  if (total <= 0) return null;
  return (
    <View style={{ ...cardStyle(th), padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
      <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: c.surface }}>
        {parts.map((p) => (p.value > 0 ? <View key={p.label} style={{ flex: p.value / total, backgroundColor: p.color }} /> : null))}
      </View>
      {parts.map((p) => (
        <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
          <Text style={{ flex: 1, fontSize: 14, fontFamily: font.regular, color: c.ink }}>{p.label}</Text>
          <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{format(p.value)}</Text>
          <Text style={{ width: 52, textAlign: "right", fontSize: 13, fontFamily: font.medium, color: c.muted }}>{Math.round((Math.max(0, p.value) / total) * 100)} %</Text>
        </View>
      ))}
    </View>
  );
}

/** Barras independientes de 0 a 100 %: cada una se lee sola y NO se suman entre sí (atribución por plataforma, ADR-0021). */
export function Meters({ title, items, note }: { title: string; items: Array<{ label: string; ratio: number; color: string }>; note?: string }) {
  const th = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ ...cardStyle(th), padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
      {items.map((it) => (
        <View key={it.label} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.ink }}>{it.label}</Text>
            <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{Math.round(it.ratio * 100)} %</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface, overflow: "hidden" }}>
            <View style={{ width: `${Math.min(100, Math.max(0, it.ratio * 100))}%`, height: 8, borderRadius: 4, backgroundColor: it.color }} />
          </View>
        </View>
      ))}
      {note ? <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{note}</Text> : null}
    </View>
  );
}

/** Fila-resumen de un aviso (alertas, tareas, propuestas...): título, resumen a la derecha y flecha; el detalle va en una hoja. */
export function SummaryRow({ title, summary, color, dot, onPress }: { title: string; summary: string; color?: string; dot?: string; onPress: () => void }) {
  return (
    <ListRow
      flat
      onPress={onPress}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 15, fontFamily: font.medium, color: color ?? c.muted }}>{summary}</Text>
          <ChevronRight size={18} color={c.muted} />
        </View>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
        <RowTitle>{title}</RowTitle>
      </View>
    </ListRow>
  );
}

export type MetricRowProps = { label: string; value: string; delta?: number | null; lowerIsBetter?: boolean; neutral?: boolean; dot?: string; hint?: string; tone?: "bad" | "warn" | "good"; bar?: number | null; onPress?: () => void };

/** Lista de cifras sin tarjeta: nombre (y pista) a la izquierda, cifra con variación a la derecha, línea fina entre filas. `bar` (0-1) dibuja una barra fina. Las filas `false` se omiten. */
export function MetricList({ title, rows }: { title?: string; rows: Array<MetricRowProps | false | null | undefined> }) {
  const th = useTheme();
  const list = rows.filter((r): r is MetricRowProps => !!r);
  return (
    <ListCard title={title} flat>
      {list.map((r, i) => {
        const good = r.delta != null && (r.lowerIsBetter ? r.delta <= 0 : r.delta >= 0);
        return (
          <ListRow
            key={r.label}
            flat
            first={i === 0 && !title}
            onPress={r.onPress}
            right={
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 17, fontFamily: font.semibold, color: c.ink }}>{r.value}</Text>
                {r.delta != null && Number.isFinite(r.delta) && (
                  <Text style={{ fontSize: 12, fontFamily: font.medium, color: r.neutral ? c.muted : good ? c.accent : c.danger }}>
                    {r.delta >= 0 ? "▲" : "▼"} {Math.abs(r.delta).toFixed(1).replace(".", ",")} %
                  </Text>
                )}
              </View>
            }
          >
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {r.dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.dot }} />}
                <RowTitle>{r.label}</RowTitle>
              </View>
              {r.hint ? <RowMeta tone={r.tone}>{r.hint}</RowMeta> : null}
              {r.bar != null && (
                <View style={{ marginTop: 6, height: 4, borderRadius: 2, backgroundColor: c.surface, overflow: "hidden" }}>
                  <View style={{ width: `${Math.min(100, Math.max(0, r.bar * 100))}%`, height: 4, borderRadius: 2, backgroundColor: th.accent }} />
                </View>
              )}
            </View>
          </ListRow>
        );
      })}
    </ListCard>
  );
}

export type SheetItem = { title: string; summary?: string; theme?: ThemeKey; content: ReactNode };

/** Filas que abren su contenido en una hoja desde abajo: la pantalla queda limpia y el detalle a un toque. */
export function SheetList({ title, items }: { title?: string; items: Array<SheetItem | false | null | undefined> }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = items.filter((x): x is SheetItem => !!x);
  if (list.length === 0) return null;
  const current = open == null ? null : list[open];
  return (
    <>
      <ListCard title={title} flat>
        {list.map((it, i) => (
          <ListRow key={it.title} flat first={i === 0 && !title} onPress={() => setOpen(i)} right={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{it.summary ? <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.muted }}>{it.summary}</Text> : null}<ChevronRight size={18} color={c.muted} /></View>}>
            <RowTitle>{it.title}</RowTitle>
          </ListRow>
        ))}
      </ListCard>
      {current && (
        <ThemeContext.Provider value={themes[current.theme ?? "todo"]}>
          <Sheet visible onClose={() => setOpen(null)} title={current.title}>
            {current.content}
          </Sheet>
        </ThemeContext.Provider>
      )}
    </>
  );
}

/** Cifra principal de la pantalla: grande, sin tarjeta, con su variación. */
export function BigNumber({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 40, fontFamily: font.semibold, color: c.ink }}>{value}</Text>
      {delta != null && Number.isFinite(delta) && (
        <Text style={{ fontSize: 14, fontFamily: font.medium, color: delta >= 0 ? c.accent : c.danger }}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1).replace(".", ",")} % vs periodo anterior
        </Text>
      )}
    </View>
  );
}
