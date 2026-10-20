import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SendHorizontal } from "lucide-react-native";
import { apiGet, apiSend, apiStream } from "../lib/api";
import { c, font } from "../lib/theme";
import { Note } from "./ui";
import { ModelPicker } from "./model-picker";
import { Reasoning, type Step } from "./copiloto-razonando";
import type { Org } from "./views";

// Respuesta de POST /v1/organizations/:id/consultant-chat (ver apps/web/src/components/copilot-panel.tsx).
type KeyFigure = { label: string; value: string; change: string | null };
type ReportArtifact = { report_id: string; file_name: string; template_id: string };
type ProposedWrite = { kind: string; title: string; description?: string };
const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "";
type Turn = { conversation_id: string; output_id?: string | null; approval_required?: boolean; report_artifacts?: ReportArtifact[]; can_upgrade?: boolean; model?: { degraded?: boolean }; saldo?: { exhausted?: boolean }; output: { answer: string; key_figures?: KeyFigure[]; warnings?: string[]; next_action?: string; proposed_writes?: ProposedWrite[] } };
type Live = { steps: Step[]; answer: string };
type Msg = { role: "user" | "assistant"; text: string; steps?: Step[]; figures?: KeyFigure[]; warnings?: string[]; error?: boolean; upgrade?: "yes" | "ask"; reports?: ReportArtifact[]; proposedWrites?: ProposedWrite[]; outputId?: string | null; approvalStatus?: "pending" | "approved" | "rejected" };
type ChatThread = { id: string; title: string; updated_at?: string };
type ChatThreadCursor = { created_at: string; id: string };
type ChatThreadPage = { conversations?: ChatThread[]; has_more?: boolean; next_cursor?: ChatThreadCursor | null };
type ChatMessageCursor = { created_at: string; id: string };
type ChatHistoryPage = { messages?: Array<Record<string, unknown>>; has_more?: boolean; next_cursor?: ChatMessageCursor | null };
type Escalation = { id: string; reason: string; risk: string; blocking_questions: string[]; status: string; owner_user_id: string | null; created_at: string };
type EscalationOwner = { id: string; name: string; platform_role: string };

const SUGGESTIONS = ["¿Qué es el CAC payback y por qué importa?", "¿Cómo van las ventas de mi tienda esta semana?"];

// La API pide un id por turno para no duplicar la pregunta si se reintenta.
const turnId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });

// Las respuestas llegan con Markdown; en móvil se muestran como texto limpio.
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/`([^`]+)`/g, "$1");

function restoreMessages(rows: Array<Record<string, unknown>>): Msg[] {
  return rows.flatMap<Msg>((row) => {
    if (row.role !== "user" && row.role !== "assistant") return [];
    const content = typeof row.content === "string" ? row.content : "";
    if (row.role === "user") return [{ role: "user", text: content }];
    const structured = row.copilot_output && typeof row.copilot_output === "object"
      ? row.copilot_output as Record<string, unknown>
      : {};
    return [{
      role: "assistant",
      text: plain(typeof structured.answer === "string" ? structured.answer : content),
      figures: Array.isArray(structured.key_figures) ? structured.key_figures as KeyFigure[] : undefined,
      warnings: Array.isArray(structured.warnings) ? structured.warnings.filter((item): item is string => typeof item === "string") : undefined,
      reports: Array.isArray(row.report_artifacts) ? row.report_artifacts as ReportArtifact[] : undefined,
      proposedWrites: Array.isArray(row.proposed_writes) ? row.proposed_writes as ProposedWrite[] : undefined,
      outputId: typeof row.output_id === "string" ? row.output_id : null,
      approvalStatus: row.approval_status === "pending" ? "pending"
        : row.approval_status === "approved" ? "approved"
          : row.approval_status === "rejected" ? "rejected" : undefined,
    }];
  });
}

/** Copiloto en el ámbito de organización y tienda seleccionados. */
export function CopilotoModule({ org, offset, seed }: { org: Org | null; offset: number; seed?: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // Con `seed` (pregunta que llega desde una métrica) el campo nace escrito: se revisa y se envía a mano.
  const [input, setInput] = useState(seed ?? "");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [showThreads, setShowThreads] = useState(false);
  const [threadCursor, setThreadCursor] = useState<ChatThreadCursor | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [escalationOwners, setEscalationOwners] = useState<EscalationOwner[]>([]);
  const [showEscalations, setShowEscalations] = useState(false);
  const [updatingEscalation, setUpdatingEscalation] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<ChatMessageCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const pendingTurn = useRef<{ question: string; id: string; scope: string; conversationId: string | null } | null>(null);
  const currentScope = useRef("");
  const scroll = useRef<ScrollView>(null);
  const scrollPosition = useRef({ y: 0, contentHeight: 0 });
  const preserveScroll = useRef<{ y: number; contentHeight: number } | null>(null);

  function historyUrl(conversationId: string, cursor?: ChatMessageCursor | null) {
    const params = new URLSearchParams();
    if (org?.connectionId) params.set("connection_id", org.connectionId);
    if (cursor) {
      params.set("before_created_at", cursor.created_at);
      params.set("before_id", cursor.id);
    }
    const query = params.toString();
    return `/v1/organizations/${org!.id}/consultant-chat/conversations/${conversationId}${query ? `?${query}` : ""}`;
  }

  function threadsUrl(cursor?: ChatThreadCursor | null) {
    const params = new URLSearchParams();
    if (org?.connectionId) params.set("connection_id", org.connectionId);
    if (cursor) {
      params.set("before_created_at", cursor.created_at);
      params.set("before_id", cursor.id);
    }
    const query = params.toString();
    return `/v1/organizations/${org!.id}/consultant-chat/conversations${query ? `?${query}` : ""}`;
  }

  const scope = `${org?.id ?? ""}:${org?.connectionId ?? ""}`;
  currentScope.current = scope;
  useEffect(() => {
    setMsgs([]);
    setConversation(null);
    setThreads([]);
    setShowThreads(false);
    setThreadCursor(null);
    setLoadingThreads(false);
    setEscalations([]);
    setEscalationOwners([]);
    setShowEscalations(false);
    setOlderCursor(null);
    setLoadingOlder(false);
    preserveScroll.current = null;
    scrollPosition.current = { y: 0, contentHeight: 0 };
    setLive(null);
    setBusy(false);
    pendingTurn.current = null;
    if (!org) return;
    let active = true;
    void (async () => {
      try {
        if (org.isConsultant) {
          try {
            const inbox = await apiGet<{ escalations?: Escalation[] }>(
              `/v1/organizations/${org.id}/consultant-chat/escalations`,
            );
            if (active) setEscalations((inbox.escalations ?? []).filter((item) => ["open", "acknowledged"].includes(item.status)));
            const ownerList = await apiGet<{ owners?: EscalationOwner[] }>(
              `/v1/organizations/${org.id}/consultant-chat/escalations/owners`,
            );
            if (active) setEscalationOwners(ownerList.owners ?? []);
          } catch {
            // La bandeja es adicional; un usuario sin acceso no debe perder el historial del chat.
          }
        }
        const page = await apiGet<ChatThreadPage>(threadsUrl());
        if (active) setThreads(page.conversations ?? []);
        if (active) setThreadCursor(page.has_more ? page.next_cursor ?? null : null);
        const recent = page.conversations?.[0];
        if (!active || !recent) return;
        setConversation(recent.id);
        const history = await apiGet<ChatHistoryPage>(historyUrl(recent.id));
        if (!active) return;
        setMsgs(restoreMessages(history.messages ?? []));
        setOlderCursor(history.has_more ? history.next_cursor ?? null : null);
      } catch {
        // El historial mejora la continuidad; un fallo de lectura no bloquea un chat nuevo.
      }
    })();
    return () => { active = false; };
  }, [scope]);

  async function openThread(thread: ChatThread) {
    if (!org || busy) return;
    try {
      preserveScroll.current = null;
      const history = await apiGet<ChatHistoryPage>(historyUrl(thread.id));
      if (currentScope.current !== scope) return;
      setConversation(thread.id);
      setMsgs(restoreMessages(history.messages ?? []));
      setOlderCursor(history.has_more ? history.next_cursor ?? null : null);
      setShowThreads(false);
    } catch (error) {
      setMsgs((items) => [...items, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo abrir el historial.", error: true }]);
    }
  }

  async function loadOlderMessages() {
    if (!org || !conversation || !olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    preserveScroll.current = { ...scrollPosition.current };
    try {
      const history = await apiGet<ChatHistoryPage>(historyUrl(conversation, olderCursor));
      if (currentScope.current !== scope) return;
      const older = restoreMessages(history.messages ?? []);
      setMsgs((items) => [...older, ...items]);
      setOlderCursor(history.has_more ? history.next_cursor ?? null : null);
    } catch (error) {
      preserveScroll.current = null;
      setMsgs((items) => [...items, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo cargar el historial anterior.", error: true }]);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function loadOlderThreads() {
    if (!org || !threadCursor || loadingThreads) return;
    setLoadingThreads(true);
    try {
      const page = await apiGet<ChatThreadPage>(threadsUrl(threadCursor));
      if (currentScope.current !== scope) return;
      setThreads((items) => {
        const seen = new Set(items.map((item) => item.id));
        return [...items, ...(page.conversations ?? []).filter((item) => !seen.has(item.id))];
      });
      setThreadCursor(page.has_more ? page.next_cursor ?? null : null);
    } catch (error) {
      setMsgs((items) => [...items, { role: "assistant", text: error instanceof Error ? error.message : "No se pudieron cargar más conversaciones.", error: true }]);
    } finally {
      setLoadingThreads(false);
    }
  }

  async function updateEscalationStatus(item: Escalation, status: "open" | "acknowledged" | "resolved", ownerUserId?: string | null) {
    if (!org?.isConsultant || updatingEscalation) return;
    setUpdatingEscalation(item.id);
    try {
      await apiSend("PATCH", `/v1/organizations/${org.id}/consultant-chat/escalations/${item.id}`, {
        status,
        ...(ownerUserId !== undefined ? { owner_user_id: ownerUserId } : {}),
        ...(status === "resolved" ? { resolution: "Resuelto desde el Copiloto móvil" } : {}),
      });
      setEscalations((items) => status === "resolved" ? items.filter((entry) => entry.id !== item.id) : items.map((entry) => entry.id === item.id ? { ...entry, status, ...(ownerUserId !== undefined ? { owner_user_id: ownerUserId } : {}) } : entry));
    } catch (error) {
      setMsgs((items) => [...items, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo actualizar el escalado.", error: true }]);
    } finally {
      setUpdatingEscalation(null);
    }
  }

  if (!org) return <View style={{ padding: 20 }}><Note text="Elige un cliente en Inicio para preguntarle al copiloto sobre su tienda." /></View>;

  async function ask(question: string, retry = false) {
    const q = question.trim();
    if (!q || busy || !org) return;
    const previous = retry && pendingTurn.current?.scope === scope && pendingTurn.current.question === q
      ? pendingTurn.current
      : null;
    const request = previous ?? { question: q, id: turnId(), scope, conversationId: conversation };
    pendingTurn.current = request;
    setInput("");
    setBusy(true);
    if (!previous) setMsgs((m) => [...m, { role: "user", text: q }]);
    const live: Live = { steps: [], answer: "" };
    setLive(live);
    let turn: Turn | null = null;
    try {
      await apiStream(`/v1/organizations/${org.id}/consultant-chat/stream`, { message: q, conversation_id: request.conversationId ?? undefined, client_turn_id: request.id, view_context: org.connectionId ? { connection_id: org.connectionId } : {}, ...(model ? { model } : {}) }, (e) => {
        if (currentScope.current !== request.scope) return;
        if (e.type === "tool") {
          const step = { id: String(e.id), name: String(e.name), status: e.status as Step["status"] };
          live.steps = live.steps.some((s) => s.id === step.id) ? live.steps.map((s) => (s.id === step.id ? step : s)) : [...live.steps, step];
        } else if (e.type === "answer_delta") live.answer += String(e.delta);
        else if (e.type === "answer_reset") live.answer = "";
        else if (e.type === "done") turn = e.data as Turn;
        else if (e.type === "error") throw new Error((e.error as { message?: string } | undefined)?.message ?? "No se pudo responder.");
        else return;
        setLive({ ...live });
      });
      if (currentScope.current !== request.scope) return;
      if (!turn) throw new Error("La respuesta se interrumpió antes de terminar.");
      const t: Turn = turn;
      setConversation(t.conversation_id);
      setThreads((items) => [{ id: t.conversation_id, title: q }, ...items.filter((item) => item.id !== t.conversation_id).slice(0, 19)]);
      pendingTurn.current = null;
      setMsgs((m) => [...m, { role: "assistant", text: plain(t.output.answer), steps: live.steps, figures: t.output.key_figures?.slice(0, 4), warnings: t.output.warnings?.slice(0, 2), reports: t.report_artifacts ?? [], proposedWrites: t.output.proposed_writes ?? [], outputId: t.output_id, approvalStatus: t.approval_required ? "pending" : undefined, ...(t.model?.degraded && t.saldo?.exhausted ? { upgrade: t.can_upgrade ? ("yes" as const) : ("ask" as const) } : {}) }]);
    } catch (e) {
      if (currentScope.current !== request.scope) return;
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "No se pudo responder.", error: true }]);
    } finally {
      if (currentScope.current === request.scope) {
        setLive(null);
        setBusy(false);
      }
    }
  }

  async function openReport(report: ReportArtifact) {
    if (!org) return;
    try {
      const result = await apiGet<{ download_url?: string }>(`/v1/organizations/${org.id}/copilot-reports/${report.report_id}/link?file_name=${encodeURIComponent(report.file_name)}`);
      if (!result.download_url) throw new Error("El informe ya no está disponible.");
      await Linking.openURL(result.download_url);
    } catch (error) {
      setMsgs((items) => [...items, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo abrir el PDF.", error: true }]);
    }
  }

  async function decideProposal(index: number, outputId: string, decision: "approved" | "rejected") {
    if (!org) return;
    try {
      await apiSend("POST", `/v1/organizations/${org.id}/ai/outputs/${outputId}/decision`, {
        decision,
        reason: decision === "approved" ? "Aprobada desde el Copiloto móvil" : "Rechazada desde el Copiloto móvil",
      });
      setMsgs((items) => items.map((item, position) => position === index ? { ...item, approvalStatus: decision } : item));
    } catch (error) {
      setMsgs((items) => [...items, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo revisar la propuesta.", error: true }]);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={offset}>
      <ScrollView ref={scroll} onScroll={(event) => {
        scrollPosition.current = {
          y: event.nativeEvent.contentOffset.y,
          contentHeight: event.nativeEvent.contentSize.height,
        };
      }} scrollEventThrottle={100} onContentSizeChange={(_, height) => {
        const anchor = preserveScroll.current;
        if (anchor) {
          preserveScroll.current = null;
          requestAnimationFrame(() => scroll.current?.scrollTo({ y: anchor.y + Math.max(0, height - anchor.contentHeight), animated: false }));
        } else {
          scroll.current?.scrollToEnd({ animated: true });
        }
      }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {org.isConsultant && escalations.length > 0 && (
          <View style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: c.edge, borderRadius: 12 }}>
            <Pressable onPress={() => setShowEscalations((value) => !value)} style={{ alignSelf: "flex-start" }}>
              <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>Escalados pendientes · {escalations.length}</Text>
            </Pressable>
            {showEscalations && escalations.map((item) => (
              <View key={item.id} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.edge }}>
                <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.ink }}>{item.risk.toUpperCase()} · {item.reason}</Text>
                {Array.isArray(item.blocking_questions) && item.blocking_questions.slice(0, 3).map((question, index) => (
                  <Text key={index} style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>• {question}</Text>
                ))}
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <Pressable disabled={updatingEscalation === item.id} onPress={() => void updateEscalationStatus(item, "acknowledged")}>
                    <Text style={{ fontSize: 12, fontFamily: font.semibold, color: c.accent }}>Reconocer</Text>
                  </Pressable>
                  <Pressable disabled={updatingEscalation === item.id} onPress={() => void updateEscalationStatus(item, "resolved")}>
                    <Text style={{ fontSize: 12, fontFamily: font.semibold, color: c.accent }}>Resolver</Text>
                  </Pressable>
                </View>
                {escalationOwners.length > 0 && (
                  <View style={{ gap: 5 }}>
                    <Text style={{ fontSize: 11, fontFamily: font.semibold, color: c.muted }}>Responsable</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {escalationOwners.map((owner) => (
                        <Pressable
                          key={owner.id}
                          disabled={updatingEscalation === item.id}
                          onPress={() => void updateEscalationStatus(item, item.status === "acknowledged" ? "acknowledged" : "open", owner.id)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: item.owner_user_id === owner.id ? c.accent : c.surface }}
                        >
                          <Text style={{ fontSize: 11, fontFamily: font.semibold, color: item.owner_user_id === owner.id ? c.bg : c.ink }}>{owner.name}</Text>
                        </Pressable>
                      ))}
                      {item.owner_user_id && (
                        <Pressable
                          disabled={updatingEscalation === item.id}
                          onPress={() => void updateEscalationStatus(item, item.status === "acknowledged" ? "acknowledged" : "open", null)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: c.surface }}
                        >
                          <Text style={{ fontSize: 11, fontFamily: font.semibold, color: c.muted }}>Quitar responsable</Text>
                        </Pressable>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        {olderCursor && conversation && (
          <Pressable disabled={loadingOlder} onPress={() => void loadOlderMessages()} style={{ alignSelf: "center", paddingVertical: 8, opacity: loadingOlder ? 0.5 : 1 }}>
            <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.accent }}>{loadingOlder ? "Cargando…" : "Cargar mensajes anteriores"}</Text>
          </Pressable>
        )}
        {(threads.length > 1 || threadCursor) && (
          <View style={{ gap: 8 }}>
            <Pressable onPress={() => setShowThreads((value) => !value)} style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
              <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.accent }}>{showThreads ? "Ocultar conversaciones" : "Conversaciones anteriores"}</Text>
            </Pressable>
            {showThreads && threads.map((thread) => (
              <Pressable key={thread.id} disabled={busy || thread.id === conversation} onPress={() => void openThread(thread)} style={{ padding: 10, borderWidth: 1, borderColor: c.edge, borderRadius: 10, opacity: thread.id === conversation ? 0.55 : 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.ink }}>{thread.title || "Conversación"}</Text>
              </Pressable>
            ))}
            {showThreads && threadCursor && (
              <Pressable disabled={loadingThreads} onPress={() => void loadOlderThreads()} style={{ alignSelf: "flex-start", paddingVertical: 6, opacity: loadingThreads ? 0.5 : 1 }}>
                <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.accent }}>{loadingThreads ? "Cargando…" : "Cargar más conversaciones"}</Text>
              </Pressable>
            )}
          </View>
        )}
        {msgs.length === 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted, marginBottom: 12 }}>{org.name}</Text>
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
              {m.steps && <Reasoning steps={m.steps} active={false} />}
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
              {m.reports?.map((report) => (
                <Pressable key={report.report_id} onPress={() => void openReport(report)} style={{ paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>Abrir informe: {report.file_name}</Text>
                </Pressable>
              ))}
              {m.proposedWrites && m.proposedWrites.length > 0 && (
                <View style={{ gap: 6, borderWidth: 1, borderColor: c.edge, borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>Propuestas para revisar</Text>
                  {m.proposedWrites.map((write, position) => <Text key={position} style={{ fontSize: 13, fontFamily: font.regular, color: c.ink }}>• {write.title}</Text>)}
                  {m.approvalStatus === "pending" && m.outputId && (
                    <View style={{ flexDirection: "row", gap: 18 }}>
                      <Pressable onPress={() => void decideProposal(i, m.outputId!, "approved")}><Text style={{ color: c.accent, fontFamily: font.semibold }}>Aprobar todas</Text></Pressable>
                      <Pressable onPress={() => void decideProposal(i, m.outputId!, "rejected")}><Text style={{ color: c.danger, fontFamily: font.semibold }}>Rechazar</Text></Pressable>
                    </View>
                  )}
                  {m.approvalStatus && m.approvalStatus !== "pending" && <Text style={{ fontSize: 13, color: c.muted }}>{m.approvalStatus === "approved" ? "Aprobadas" : "Rechazadas"}</Text>}
                </View>
              )}
            </View>
          ),
        )}
        {live && (
          <View style={{ gap: 10 }}>
            <Reasoning steps={live.steps} active={!live.answer} />
            {live.answer ? <Text style={{ fontSize: 15, lineHeight: 23, fontFamily: font.regular, color: c.ink }}>{plain(live.answer)}</Text> : null}
          </View>
        )}
        {!busy && pendingTurn.current?.scope === scope && (
          <Pressable onPress={() => {
            const pending = pendingTurn.current;
            if (pending) void ask(pending.question, true);
          }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>Recuperar respuesta pendiente</Text>
          </Pressable>
        )}
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
