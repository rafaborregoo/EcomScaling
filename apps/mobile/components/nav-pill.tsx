import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import { c, font } from "../lib/theme";

export type NavItem = { key: string; label: string; Icon: LucideIcon; badge?: number; danger?: boolean };

const PAD = 5;

/** Nav inferior en píldora flotante, solo iconos (como Instagram); la cápsula de la pestaña activa se desliza al cambiar. */
export function NavPill({ items, active, onPress }: { items: NavItem[]; active: string; onPress: (key: string) => void }) {
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const index = Math.max(0, items.findIndex((x) => x.key === active));
  const slot = w ? (w - PAD * 2) / items.length : 0;
  const x = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (!slot) return;
    if (first.current) {
      x.setValue(index * slot);
      first.current = false;
      return;
    }
    Animated.spring(x, { toValue: index * slot, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 }).start();
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 260 }).start();
  }, [index, slot]);

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: c.bg }}>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ flexDirection: "row", padding: PAD, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.edge, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
      >
        {!!slot && <Animated.View style={{ position: "absolute", top: PAD, left: PAD, width: slot, height: 46, borderRadius: 999, backgroundColor: c.edge, transform: [{ translateX: x }] }} />}
        {items.map(({ key, label, Icon, badge, danger }, i) => {
          const on = i === index;
          return (
            <Pressable key={key} onPress={() => onPress(key)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 46 }}>
              <Animated.View style={{ transform: [{ scale: on ? pop : 1 }] }}>
                <Icon size={24} color={on ? c.ink : c.muted} strokeWidth={on ? 2.4 : 1.9} />
                {!!badge && (
                  <View style={{ position: "absolute", top: -6, left: 14, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: danger ? c.danger : c.accent, borderWidth: 2, borderColor: c.surface }}>
                    <Text style={{ fontSize: 10, fontFamily: font.semibold, color: "#fff" }}>{badge > 99 ? "99+" : badge}</Text>
                  </View>
                )}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
