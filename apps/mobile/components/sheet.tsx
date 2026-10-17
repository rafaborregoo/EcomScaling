import { useRef, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from "react-native";
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

/** Hoja inferior para explicaciones y listas cortas. Tocar fuera, deslizar hacia abajo o el botón atrás la cierra. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const swipe = useSwipeDown(onClose);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Animated.View style={[{ maxHeight: "85%", backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }, swipe.style]}>
        <View {...swipe.panHandlers} style={{ paddingTop: 10 }}>
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.edge }} />
          <Text style={{ fontSize: 18, fontFamily: font.semibold, color: c.ink, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>{title}</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>{children}</ScrollView>
      </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
