import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { c, cardStyle, font, useTheme } from "../lib/theme";

export type Point = { label: string; y: number | null };
/** "accent" y "secondary" toman el color del tema del canal; cualquier otro valor es un color literal. */
export type Series = { name: string; color: "accent" | "secondary" | (string & {}); points: Point[] };
export type ChartTab = {
  key: string;
  label: string;
  series: Series[];
  /** Valor completo (tooltip y cabecera). */
  format: (v: number) => string;
  /** Texto de la cabecera cuando no se está tocando el gráfico (p. ej. el total del periodo). */
  summary: string;
};

const PAD = { t: 18, b: 22, l: 0, r: 8 };

const compact = (v: number) => {
  const abs = Math.abs(v);
  const s = abs >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : abs >= 1e4 ? `${Math.round(v / 1e3)} k` : abs >= 1e3 ? `${(v / 1e3).toFixed(1)} k` : abs < 10 && v % 1 !== 0 ? v.toFixed(1) : `${Math.round(v)}`;
  return s.replace(".", ",");
};

/**
 * Gráfico de líneas con SVG. Se toca o se arrastra el dedo para ver el valor de cada punto
 * (línea guía, marcador y vibración suave al cambiar de punto).
 */
function LineChart({ series: raw, height, onActive }: { series: Series[]; height: number; onActive: (i: number | null) => void }) {
  const th = useTheme();
  const series = raw.map((s) => ({ ...s, color: s.color === "accent" ? th.tone : s.color === "secondary" ? th.secondary : s.color }));
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const n = series[0]?.points.length ?? 0;
  const geo = useRef({ width: 0, n: 0, last: -1 });
  geo.current.width = width;
  geo.current.n = n;

  // Mantener pulsado arma el gráfico; antes de eso el gesto es del scroll / carrusel.
  // `e.x` es relativo al gráfico (a diferencia de locationX, que depende del hijo tocado).
  const pan = useMemo(() => {
    const move = (x: number) => {
      const { width: w, n: count } = geo.current;
      if (w <= 0 || count < 1) return;
      const plotW = w - PAD.l - PAD.r;
      const i = Math.max(0, Math.min(count - 1, Math.round(((x - PAD.l) / plotW) * (count - 1))));
      if (i !== geo.current.last) {
        geo.current.last = i;
        Haptics.selectionAsync().catch(() => {});
        setActive(i);
        onActive(i);
      }
    };
    const end = () => {
      geo.current.last = -1;
      setActive(null);
      onActive(null);
    };
    return Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(180)
      .onStart((e) => move(e.x))
      .onUpdate((e) => move(e.x))
      .onFinalize(end);
  }, [onActive]);

  const plotW = Math.max(1, width - PAD.l - PAD.r);
  const plotH = height - PAD.t - PAD.b;
  const values = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y !== null));
  const max = Math.max(...values, 0) * 1.1 || 1;
  const x = (i: number) => PAD.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;

  // Un tramo por cada racha de puntos con dato: un hueco rompe la línea en vez de inventar un valor.
  const segments = (s: Series) => {
    const out: Array<Array<[number, number]>> = [];
    let cur: Array<[number, number]> = [];
    s.points.forEach((p, i) => {
      if (p.y === null) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push([x(i), y(p.y)]);
    });
    if (cur.length) out.push(cur);
    return out;
  };
  const line = (seg: Array<[number, number]>) => seg.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");

  const first = series[0];
  const xLabels = n > 0 && first ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i) : [];

  return (
    <GestureDetector gesture={pan}>
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => (
            <Line key={f} x1={PAD.l} x2={width - PAD.r} y1={PAD.t + plotH * (1 - f)} y2={PAD.t + plotH * (1 - f)} stroke={c.edge} strokeWidth={1} strokeDasharray={f === 0 ? undefined : "3 4"} />
          ))}
          {[0.5, 1].map((f) => (
            <SvgText key={f} x={PAD.l + 2} y={PAD.t + plotH * (1 - f) - 4} fontSize={10} fill={c.muted} fontFamily={font.regular}>
              {compact(max * f)}
            </SvgText>
          ))}
          {series.map((s) =>
            segments(s).map((seg, i) =>
              seg.length === 1 ? (
                <Circle key={`${s.name}${i}`} cx={seg[0]![0]} cy={seg[0]![1]} r={2.5} fill={s.color} />
              ) : (
                <Path key={`${s.name}${i}`} d={line(seg)} stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" fill="none" />
              ),
            ),
          )}
          {xLabels.map((i) => (
            <SvgText key={i} x={x(i)} y={height - 6} fontSize={10} fill={c.muted} fontFamily={font.regular} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {first?.points[i]?.label}
            </SvgText>
          ))}
          {active !== null && (
            <>
              <Line x1={x(active)} x2={x(active)} y1={PAD.t} y2={PAD.t + plotH} stroke={c.ink} strokeWidth={1} strokeOpacity={0.35} />
              {series.map((s) => {
                const v = s.points[active]?.y;
                return v == null ? null : <Circle key={s.name} cx={x(active)} cy={y(v)} r={5} fill={c.bg} stroke={s.color} strokeWidth={2.5} />;
              })}
            </>
          )}
        </Svg>
      )}
    </View>
    </GestureDetector>
  );
}

/** Tarjeta con un gráfico interactivo: mantén pulsado y arrastra para ver cada punto. */
export function ChartCard({ title, tab, height = 190, onScrub }: { title: string; tab: ChartTab; height?: number; onScrub?: (on: boolean) => void }) {
  const th = useTheme();
  const [active, setActive] = useState<number | null>(null);
  const setScrub = useCallback((i: number | null) => { setActive(i); onScrub?.(i !== null); }, [onScrub]);
  const first = tab.series[0];
  const hasData = tab.series.some((s) => s.points.some((p) => p.y !== null));
  const dateLabel = active !== null ? first?.points[active]?.label : null;
  const single = tab.series.length === 1;
  const activeValue = active !== null && first ? first.points[active]?.y : null;

  return (
    <View>
      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>{title}</Text>

      <View style={{ marginTop: 6, minHeight: 56 }}>
        {single ? (
          <>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 28, fontFamily: font.semibold, color: th.tone }}>
              {active !== null ? (activeValue == null ? "—" : tab.format(activeValue)) : tab.summary}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{dateLabel ?? "Mantén pulsado y arrastra"}</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{dateLabel ?? tab.summary}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 4 }}>
              {tab.series.map((s) => {
                const v = active !== null ? s.points[active]?.y : null;
                return (
                  <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color === "accent" ? th.tone : s.color === "secondary" ? th.secondary : s.color }} />
                    <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{active !== null ? (v == null ? "—" : tab.format(v)) : s.name}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {hasData ? (
        <LineChart series={tab.series} height={height} onActive={setScrub} />
      ) : (
        <View style={{ height, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Sin datos en este periodo</Text>
        </View>
      )}
    </View>
  );
}

const GAP = 40;

/** Ruleta de gráficos: se desliza de lado, cada página encaja y deja asomar la siguiente. */
export function ChartCarousel({ tabs: cards, suffix = "", height = 190 }: { tabs: ChartTab[]; suffix?: string; height?: number }) {
  const th = useTheme();
  const { width: screen } = useWindowDimensions();
  const page = screen - 40; // ancho completo (20 de margen a cada lado): sin gráfico asomando; los puntos indican que hay más
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  if (cards.length === 0) return null;

  return (
    <View style={{ marginHorizontal: -20 }}>
      <ScrollView
        ref={ref}
        horizontal
        scrollEnabled={!scrubbing}
        showsHorizontalScrollIndicator={false}
        snapToInterval={page + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, gap: GAP }}
        onScroll={(e) => setIndex(Math.max(0, Math.min(cards.length - 1, Math.round(e.nativeEvent.contentOffset.x / (page + GAP)))))}
        scrollEventThrottle={32}
      >
        {cards.map((card) => (
          <View key={card.key} style={{ width: page }}>
            <ChartCard title={card.label + suffix} tab={card} height={height} onScrub={setScrubbing} />
          </View>
        ))}
      </ScrollView>
      <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "center", gap: 6 }}>
        {cards.map((card, i) => (
          <Pressable key={card.key} hitSlop={8} onPress={() => ref.current?.scrollTo({ x: i * (page + GAP), animated: true })}>
            <View style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? th.tone : c.edge }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Embudo en barras horizontales; el porcentaje es sobre el primer paso. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const th = useTheme();
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <View style={{ ...cardStyle(th), padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>Embudo de compra</Text>
      {steps.map((s, i) => (
        <View key={s.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.ink }}>{s.label}</Text>
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>
              {s.value.toLocaleString("es-ES")}
              {i > 0 ? ` · ${((s.value / top) * 100).toFixed(1).replace(".", ",")} %` : ""}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: th.soft }}>
            <View style={{ height: 8, borderRadius: 4, width: `${Math.max(2, (s.value / top) * 100)}%`, backgroundColor: th.accent, opacity: 1 - i * 0.18 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
