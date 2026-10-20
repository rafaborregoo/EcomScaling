import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Text, type TextStyle, type ViewStyle } from "react-native";

const EASE = Easing.out(Easing.cubic);

/** Cifra que cuenta desde 0 hasta `to` al aparecer (y entre valores cuando cambia). */
export function CountUp({ to, format, style, duration = 900 }: { to: number; format: (n: number) => string; style?: TextStyle; duration?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = v.addListener(({ value }) => setN(value));
    Animated.timing(v, { toValue: to, duration, easing: EASE, useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [to]);
  return <Text style={style}>{format(n)}</Text>;
}

/** Barra de progreso que se llena al aparecer. `pct` de 0 a 1. */
export function Grow({ pct, color, track, height = 6, delay = 0 }: { pct: number; color: string; track: string; height?: number; delay?: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(1, pct)), duration: 800, delay, easing: EASE, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </Animated.View>
  );
}

/** Entrada suave: sube 12 px y aparece. `delay` para escalonar listas. */
export function FadeIn({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: ViewStyle }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, easing: EASE, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}
