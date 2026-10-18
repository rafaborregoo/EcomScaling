import { useRef, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, type LucideIcon } from "lucide-react-native";
import { c, font } from "../lib/theme";

/**
 * Deslizar hacia abajo desde la cabecera cierra la hoja o el modal. `style` va al contenedor que se mueve y
 * `panHandlers` a la cabecera (el cuerpo queda libre para hacer scroll).
 */
export function useSwipeDown(onClose: () => void) {
  const y = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  const back = () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) close.current();
        back();
      },
      onPanResponderTerminate: back,
    }),
  ).current;
  return { style: { transform: [{ translateY: y }] }, panHandlers: pan.panHandlers };
}

/**
 * Hoja inferior para explicaciones y listas cortas. Tocar fuera, deslizar hacia abajo o el botón atrás la cierra.
 * El fondo oscuro cubre toda la pantalla y la hoja llega hasta abajo (con el margen del área segura), así el nav
 * inferior nunca asoma por debajo. `count` va en una pastilla junto al título.
 */
export function Sheet({ visible, onClose, title, count, children }: { visible: boolean; onClose: () => void; title: string; count?: number; children: ReactNode }) {
  const swipe = useSwipeDown(onClose);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} accessibilityLabel="Cerrar" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
        <Animated.View style={[{ maxHeight: "85%", backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }, swipe.style]}>
          <View {...swipe.panHandlers} style={{ paddingTop: 10 }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.edge }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 18, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
              {count != null && (
                <View style={{ minWidth: 24, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: c.accentTint, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.muted }}>{count}</Text>
                </View>
              )}
            </View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 12 }}>{children}</ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Color de prioridad o severidad: el punto sustituye a la palabra. */
export const LEVEL_COLOR: Record<string, string> = { critical: c.danger, urgent: c.danger, high: "#e8a317", medium: "#2563eb", low: c.edge, info: c.edge };

/** Botón redondo de solo icono para acciones en filas (aprobar, descartar, completar...). `on` lo rellena con su color. */
export function RoundIcon({ Icon, color, on, disabled, label, onPress }: { Icon: LucideIcon; color: string; on?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: on ? color : c.edge, backgroundColor: on ? color : c.bg, opacity: disabled ? 0.4 : 1 }}
    >
      <Icon size={20} color={on ? "#fff" : color} strokeWidth={2.4} />
    </Pressable>
  );
}

/** Error de una acción dentro de la hoja. */
export function SheetError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <CircleAlert size={16} color={c.danger} />
      <Text style={{ flex: 1, fontSize: 14, fontFamily: font.regular, color: c.danger }}>{text}</Text>
    </View>
  );
}
