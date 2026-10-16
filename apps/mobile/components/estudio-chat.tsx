import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowUp, Undo2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { c, font } from "../lib/theme";
import { ModelPicker } from "./model-picker";

const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "";

export type ChatMsg = { role: "user" | "assistant"; text: string; labels?: string[]; error?: boolean; upgrade?: "yes" | "ask" };

const IDEA = "¿Qué mejorarías de este email?";

/** Chat con la IA del estudio: ocupa la mitad inferior y deja el email visible arriba. */
export function EstudioChat({ base, messages, busy, canUndo, onSend, onUndo, onClose }: { base: string; messages: ChatMsg[]; busy: boolean; canUndo: boolean; onSend: (text: string, model: string) => void; onUndo: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const subs = [
      Keyboard.addListener("keyboardWillShow", () => setKb(true)),
      Keyboard.addListener("keyboardDidShow", () => setKb(true)),
      Keyboard.addListener("keyboardWillHide", () => setKb(false)),
      Keyboard.addListener("keyboardDidHide", () => setKb(false)),
    ];
    return () => subs.forEach((l) => l.remove());
  }, []);
  const scroll = useRef<ScrollView>(null);
  const lastChange = messages.map((m) => Boolean(m.labels?.length)).lastIndexOf(true);
  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    setDraft("");
    onSend(value, model ?? "sonnet");
  };
  return (
    <View style={{ flex: 0.6, borderTopWidth: 1, borderTopColor: c.edge, backgroundColor: c.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.edge }}>
        <Text style={{ fontSize: 16, fontFamily: font.semibold, color: c.ink }}>IA</Text>
        <View style={{ flex: 1 }}><ModelPicker base={base} value={model} onChange={setModel} /></View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar chat"><X size={22} color={c.ink} /></Pressable>
      </View>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10 }}>
        {messages.length === 0 && (
          <Pressable onPress={() => send(IDEA)} style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: c.edge, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.ink }}>{IDEA}</Text>
          </Pressable>
        )}
        {messages.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: m.role === "user" ? c.accentTint : c.surface }}>
            <Text style={{ fontSize: 14, fontFamily: font.regular, color: m.error ? c.danger : c.ink }}>{m.text}</Text>
            {m.labels?.map((label, k) => <Text key={k} style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>· {label}</Text>)}
            {m.upgrade === "yes" && (
              <Pressable onPress={() => Linking.openURL(`${webUrl}/planes`)} style={{ alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.accent }}>
                <Text style={{ fontSize: 13, fontFamily: font.semibold, color: "#fff" }}>Mejorar plan</Text>
              </Pressable>
            )}
            {m.upgrade === "ask" && <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>Avisa al propietario del plan o a tu consultor para ampliar el saldo.</Text>}
            {i === lastChange && canUndo && (
              <Pressable onPress={onUndo} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 }} accessibilityLabel="Deshacer cambios de la IA">
                <Undo2 size={15} color={c.accent} />
                <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.accent }}>Deshacer</Text>
              </Pressable>
            )}
          </View>
        ))}
        {busy && <ActivityIndicator color={c.muted} style={{ alignSelf: "flex-start", marginLeft: 8 }} />}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: kb ? 10 : insets.bottom + 12, borderTopWidth: 1, borderTopColor: c.edge }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Ej.: pon el botón en verde y añade un cupón…"
          placeholderTextColor={c.muted}
          style={{ flex: 1, maxHeight: 96, borderWidth: 1, borderColor: c.edge, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, fontFamily: font.regular, color: c.ink }}
        />
        <Pressable onPress={() => send(draft)} disabled={busy || !draft.trim()} accessibilityLabel="Enviar" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: busy || !draft.trim() ? c.edge : c.ink }}>
          <ArrowUp size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
