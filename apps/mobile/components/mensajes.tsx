import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ChevronLeft, SendHorizontal } from "lucide-react-native";
import { apiGet, apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { c, font } from "../lib/theme";
import { Note, Screen, Status } from "./ui";

// Ver apps/web/src/components/consultant-messages.tsx y apps/web/src/app/mensajes/page.tsx.
type Thread = {
  organization_id: string;
  organization_name: string;
  counterpart_name: string | null;
  last_message: { body: string; author_kind: string; has_attachments: boolean; created_at: string } | null;
  unread_count: number;
};
type Message = { id: string; author_kind: "consultant" | "client" | "platform" | "system"; author_name: string | null; body: string; created_at: string };

const POLL_MS = 30_000;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function listWhen(iso: string) {
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return hhmm(iso);
  if (days === 1) return "ayer";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Chats consultor ↔ cliente: lista y conversación. Sin adjuntos (se hacen en la web). */
export function MensajesModule({ isConsultant, offset }: { isConsultant: boolean; offset: number }) {
  const { data, error, reload, retry } = useApi<{ threads: Thread[] }>("/v1/consultant/message-threads");
  const [activeId, setActiveId] = useState<string | null>(null);
  const threads = data?.threads ?? [];
  // Con una sola conversación (lo normal en un cliente) se abre sola.
  const only = threads.length === 1 && !isConsultant ? threads[0] : null;
  const active = threads.find((t) => t.organization_id === activeId) ?? only;

  if (active) {
    return <Chat thread={active} isConsultant={isConsultant} offset={offset} onBack={only ? null : () => { setActiveId(null); reload(); }} onActivity={reload} />;
  }

  return (
    <Screen title="Mensajes" onRefresh={reload}>
      <Status error={error} loading={!data} retry={retry} />
      {data && threads.length === 0 && <Note text="Todavía no tienes conversaciones." />}
      {threads.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: c.edge }}>
          {threads.map((t) => {
            const waiting = isConsultant && t.last_message?.author_kind === "client";
            return (
              <Pressable key={t.organization_id} onPress={() => setActiveId(t.organization_id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.edge }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: t.unread_count > 0 ? font.semibold : font.medium, color: c.ink }}>{t.organization_name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: t.unread_count > 0 ? font.medium : font.regular, color: waiting ? c.warning : c.muted }}>
                    {t.last_message ? (t.last_message.body || (t.last_message.has_attachments ? "Adjunto" : "")) : "Sin mensajes"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {t.last_message && <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{listWhen(t.last_message.created_at)}</Text>}
                  {t.unread_count > 0 && (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: c.accent }}>
                      <Text style={{ fontSize: 12, fontFamily: font.semibold, color: "#fff" }}>{t.unread_count}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function Chat({ thread, isConsultant, offset, onBack, onActivity }: { thread: Thread; isConsultant: boolean; offset: number; onBack: (() => void) | null; onActivity: () => void }) {
  const base = `/v1/organizations/${thread.organization_id}/consultant-messages`;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const lastMarked = useRef("");

  const load = useCallback(async () => {
    try {
      const payload = await apiGet<{ messages: Message[] }>(`${base}?mark_read=0`);
      const list = payload.messages ?? [];
      setMessages(list);
      setError(null);
      // Se marca como leído solo lo que llega de la otra parte, una vez por mensaje nuevo.
      const latest = list.filter((m) => m.author_kind !== "system" && (isConsultant ? m.author_kind === "client" : m.author_kind !== "client")).at(-1)?.created_at ?? "";
      if (latest && latest !== lastMarked.current) {
        lastMarked.current = latest;
        apiSend("POST", `${base}/read`).then(onActivity, () => (lastMarked.current = ""));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el chat.");
    }
  }, [base, isConsultant, onActivity]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await apiSend("POST", base, { body, attachments: [] });
      setInput("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setSending(false);
    }
  }

  const mine = (m: Message) => (isConsultant ? m.author_kind === "consultant" || m.author_kind === "platform" : m.author_kind === "client");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={offset}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.edge }}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={10}>
            <ChevronLeft size={24} color={c.ink} />
          </Pressable>
        )}
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontFamily: font.semibold, color: c.ink, paddingLeft: onBack ? 0 : 8 }}>
          {isConsultant ? thread.organization_name : thread.counterpart_name ?? "Tu consultor"}
        </Text>
      </View>

      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {!messages && !error && <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />}
        {messages?.map((m) =>
          m.author_kind === "system" ? (
            <Text key={m.id} style={{ textAlign: "center", fontSize: 12, fontFamily: font.regular, color: c.muted, paddingVertical: 4 }}>{m.body}</Text>
          ) : (
            <View key={m.id} style={{ alignSelf: mine(m) ? "flex-end" : "flex-start", maxWidth: "85%", borderRadius: 14, padding: 12, backgroundColor: mine(m) ? c.accentTint : c.surface, borderWidth: mine(m) ? 0 : 1, borderColor: c.edge }}>
              <Text style={{ fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: c.ink }}>{m.body}</Text>
              <Text style={{ marginTop: 4, fontSize: 11, fontFamily: font.regular, color: c.muted, textAlign: "right" }}>{hhmm(m.created_at)}</Text>
            </View>
          ),
        )}
        {messages?.length === 0 && <Text style={{ textAlign: "center", marginTop: 40, fontSize: 14, fontFamily: font.regular, color: c.muted }}>Escribe el primer mensaje.</Text>}
      </ScrollView>

      {error && <Text style={{ paddingHorizontal: 16, paddingBottom: 6, fontSize: 13, fontFamily: font.regular, color: c.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: c.edge, backgroundColor: c.bg }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje"
          placeholderTextColor={c.muted}
          multiline
          style={{ flex: 1, maxHeight: 110, borderWidth: 1, borderColor: c.edge, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontFamily: font.regular, color: c.ink }}
        />
        <Pressable onPress={send} disabled={sending || !input.trim()} style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: sending || !input.trim() ? c.edge : c.accent }}>
          <SendHorizontal size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
