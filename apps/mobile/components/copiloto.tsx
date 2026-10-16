import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SendHorizontal } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { c, font } from "../lib/theme";
import { Note } from "./ui";
import { ModelPicker } from "./model-picker";
import type { Org } from "./views";

// Respuesta de POST /v1/organizations/:id/consultant-chat (ver apps/web/src/components/copilot-panel.tsx).
type KeyFigure = { label: string; value: string; change: string | null };
const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "";
type Turn = { conversation_id: string; can_upgrade?: boolean; model?: { degraded?: boolean }; saldo?: { exhausted?: boolean }; output: { answer: string; key_figures?: KeyFigure[]; warnings?: string[]; next_action?: string } };
type Msg = { role: "user" | "assistant"; text: string; figures?: KeyFigure[]; warnings?: string[]; error?: boolean; upgrade?: "yes" | "ask" };

const SUGGESTIONS = ["¿Cómo van las ventas esta semana?", "¿Qué productos se están quedando sin stock?", "¿Cómo está rindiendo Meta este mes?"];

// La API pide un id por turno para no duplicar la pregunta si se reintenta.
const turnId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });

// Las respuestas llegan con Markdown; en móvil se muestran como texto limpio.
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/`([^`]+)`/g, "$1");

/** Copiloto: preguntas cortas a la IA sobre la tienda. Solo consulta; no genera informes ni edita. */
export function CopilotoModule({ org, offset }: { org: Org | null; offset: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversation, setConversation] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  if (!org) return <View style={{ padding: 20 }}><Note text="Elige un cliente en Inicio para preguntarle al copiloto sobre su tienda." /></View>;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || !org) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    try {
      const turn = await apiSend<Turn>("POST", `/v1/organizations/${org.id}/consultant-chat`, { message: q, conversation_id: conversation ?? undefined, client_turn_id: turnId(), ...(model ? { model } : {}) });
      setConversation(turn.conversation_id);
      setMsgs((m) => [...m, { role: "assistant", text: plain(turn.output.answer), figures: turn.output.key_figures?.slice(0, 4), warnings: turn.output.warnings?.slice(0, 2), ...(turn.model?.degraded && turn.saldo?.exhausted ? { upgrade: turn.can_upgrade ? ("yes" as const) : ("ask" as const) } : {}) }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "No se pudo responder.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={offset}>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {msgs.length === 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 24, fontFamily: font.semibold, color: c.ink }}>Copiloto</Text>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted, marginBottom: 12 }}>{org.name}</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => ask(s)} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.edge }}>
                <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.ink }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <View key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", borderRadius: 14, padding: 12, backgroundColor: c.accentTint }}>
              <Text style={{ fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: c.ink }}>{m.text}</Text>
            </View>
          ) : (
            <View key={i} style={{ gap: 10 }}>
              <Text style={{ fontSize: 15, lineHeight: 23, fontFamily: font.regular, color: m.error ? c.danger : c.ink }}>{m.text}</Text>
              {m.figures && m.figures.length > 0 && (
                <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.edge, overflow: "hidden" }}>
                  {m.figures.map((f, k) => (
                    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: k === 0 ? 0 : 1, borderTopColor: c.edge }}>
                      <Text style={{ flex: 1, fontSize: 14, fontFamily: font.regular, color: c.muted }}>{f.label}</Text>
                      <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{f.value}{f.change ? ` · ${f.change}` : ""}</Text>
                    </View>
                  ))}
                </View>
              )}
              {m.upgrade && <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>Se ha agotado el saldo del mes: el copiloto responde en modo reducido.{m.upgrade === "ask" ? " Avisa al propietario del plan o a tu consultor." : ""}</Text>}
              {m.upgrade === "yes" && (
                <Pressable onPress={() => Linking.openURL(`${webUrl}/planes`)} style={{ alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.accent }}>
                  <Text style={{ fontSize: 13, fontFamily: font.semibold, color: "#fff" }}>Mejorar plan</Text>
                </Pressable>
              )}
              {m.warnings?.map((w) => <Text key={w} style={{ fontSize: 13, fontFamily: font.regular, color: c.warning }}>{w}</Text>)}
            </View>
          ),
        )}
        {busy && <ActivityIndicator color={c.accent} style={{ alignSelf: "flex-start" }} />}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.edge, backgroundColor: c.bg }}>
        <ModelPicker base={`/v1/organizations/${org.id}`} value={model} onChange={setModel} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, backgroundColor: c.bg }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Pregunta sobre tu tienda"
          placeholderTextColor={c.muted}
          multiline
          style={{ flex: 1, maxHeight: 110, borderWidth: 1, borderColor: c.edge, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontFamily: font.regular, color: c.ink }}
        />
        <Pressable onPress={() => ask(input)} disabled={busy || !input.trim()} style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: busy || !input.trim() ? c.edge : c.accent }}>
          <SendHorizontal size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
