import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { c, font } from "../lib/theme";

/** Hoja inferior para explicaciones y listas cortas. Tocar fuera o la X la cierra. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ maxHeight: "85%", backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 }}>
        <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.edge }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
            <X size={22} color={c.muted} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>{children}</ScrollView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
