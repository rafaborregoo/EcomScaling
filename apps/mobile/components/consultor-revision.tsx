import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check, ChevronRight, Mail, Megaphone, MessageSquareWarning, Send, Smartphone } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { CAUTION, c, fmtCurrency, font, GOOD } from "../lib/theme";
import { Sheet, SheetError } from "./sheet";
import { ActionCard, AllDone, Group, Screen, Status } from "./ui";
import type { Org } from "./views";

// /v1/consultant/campaigns/overview (apps/web/src/app/marketing/campanas/campaign-api.ts): la cola de revisión de
// las campañas que crean los clientes, de toda la cartera o de un cliente.
type Review = { item_id: string; organization_id: string; organization_name: string; title: string; channel: string; starts_at: string; review_status: "pending" | "changes_requested"; open_corrections: number };
type Sent = { campaign_id: string; organization_name: string; name: string; open_rate: number | null; revenue: number | null; currency_code: string | null };
type Overview = { reviews: Review[]; last_week_sends: Sent[] };

type Note = { id: string; kind: "note" | "correction" | "ai_proposal" | "system"; author_name: string | null; author_kind: string; body: string; resolved_at: string | null };
type Thread = { item: { title: string; review_status: string | null }; notes: Note[] };

const day = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const daysTo = (iso: string) => Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
/** Cuándo sale, dicho como prisa: lo que sale hoy o mañana sin revisar es lo primero. */
function when(iso: string) {
  const d = daysTo(iso);
  if (d < 0) return { text: "Fecha pasada", color: c.danger };
  if (d === 0) return { text: "Sale hoy", color: c.danger };
  if (d === 1) return { text: "Sale mañana", color: CAUTION };
  return { text: d <= 6 ? `Sale en ${d} días` : day(iso), color: c.muted };
}
const CHANNEL_ICON: Record<string, LucideIcon> = { email: Mail, sms: Smartphone, meta: Megaphone, social: Megaphone };
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")} %`);

/** Revisión de campañas: lo que los clientes han creado y espera tu visto bueno, y cómo fueron los envíos de la semana pasada. */
export function ReviewQueue({ org }: { org: Org | null }) {
  const { data, error, reload, retry } = useApi<Overview>(`/v1/consultant/campaigns/overview${org ? `?organizationId=${org.id}` : ""}`);
  const [open, setOpen] = useState<Review | null>(null);
  const reviews = data?.reviews ?? [];
  const sends = (data?.last_week_sends ?? []).slice(0, 5);
  const empty = !!data && reviews.length === 0;

  return (
    <Screen flat title="Revisar" onRefresh={reload}>
      <Status error={error} loading={!data} retry={retry} />
      {empty && <AllDone text="Nada por revisar" />}

      {reviews.length > 0 && (
        <Group title="Por revisar">
          {[...reviews].sort((a, b) => Number(a.review_status === "changes_requested") - Number(b.review_status === "changes_requested") || a.starts_at.localeCompare(b.starts_at)).map((r) => {
            const waiting = r.review_status === "changes_requested";
            const w = when(r.starts_at);
            return (
              <ActionCard
                key={r.item_id}
                color={waiting ? c.edge : w.color === c.muted ? CAUTION : w.color}
                Icon={CHANNEL_ICON[r.channel] ?? Mail}
                eyebrow={org ? undefined : r.organization_name}
                when={waiting ? "Esperando al cliente" : w.text}
                whenColor={waiting ? c.muted : w.color}
                title={r.title}
                dim={waiting}
                onPress={() => setOpen(r)}
                right={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {r.open_corrections > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <MessageSquareWarning size={16} color={CAUTION} />
                        <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{r.open_corrections}</Text>
                      </View>
                    )}
                    <ChevronRight size={18} color={c.muted} />
                  </View>
                }
              />
            );
          })}
        </Group>
      )}

      {sends.length > 0 && (
        <Group title="Enviadas la semana pasada">
          {sends.map((s) => (
            <ActionCard
              key={s.campaign_id}
              color={c.edge}
              Icon={Send}
              eyebrow={`${org ? "" : `${s.organization_name} · `}${pct(s.open_rate)} abren`}
              title={s.name}
              right={
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{s.revenue != null && s.currency_code ? fmtCurrency(s.revenue, s.currency_code) : "—"}</Text>
                  {/* ADR-0021: es lo que se atribuye la plataforma, no lo que generó. */}
                  {s.revenue != null && <Text style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}>atribuido</Text>}
                </View>
              }
            />
          ))}
        </Group>
      )}

      <ReviewSheet review={open} onClose={() => setOpen(null)} onDone={() => void reload()} />
    </Screen>
  );
}

/** Hilo de una campaña y las dos decisiones del consultor: darla por revisada o pedir cambios al cliente con un comentario. */
function ReviewSheet({ review, onClose, onDone }: { review: Review | null; onClose: () => void; onDone: () => void }) {
  const base = review ? `/v1/organizations/${review.organization_id}/campaign-planning/items/${review.item_id}` : null;
  const thread = useApi<Thread>(base ? `${base}/thread` : null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reviewed" | "changes_requested" | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!review || !base) return null;
  const notes = (thread.data?.notes ?? []).filter((n) => n.kind !== "system");

  async function decide(status: "reviewed" | "changes_requested") {
    setBusy(status);
    setFailed(null);
    try {
      await apiSend("POST", `${base}/review`, { status, ...(message.trim() ? { message: message.trim() } : {}) });
      setMessage("");
      onDone();
      onClose();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible onClose={onClose} title={review.title}>
      <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{`${review.organization_name} · ${day(review.starts_at)}`}</Text>
      <Status error={thread.error} loading={!thread.data} retry={thread.retry} />
      {notes.map((n) => (
        <View key={n.id} style={{ flexDirection: "row", gap: 8, opacity: n.resolved_at ? 0.5 : 1 }}>
          {n.kind === "correction" ? <MessageSquareWarning size={16} color={CAUTION} style={{ marginTop: 2 }} /> : <View style={{ width: 16 }} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontFamily: font.semibold, color: n.author_kind === "client" ? c.ink : c.muted }}>{n.author_name ?? (n.author_kind === "client" ? "Cliente" : "Consultor")}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink, textDecorationLine: n.resolved_at ? "line-through" : "none" }}>{n.body}</Text>
          </View>
        </View>
      ))}
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Comentario para el cliente"
        placeholderTextColor={c.muted}
        multiline
        maxLength={1000}
        style={{ minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: c.edge, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: font.regular, color: c.ink }}
      />
      <SheetError text={failed} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable disabled={busy !== null || !message.trim()} onPress={() => decide("changes_requested")} accessibilityRole="button" style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: CAUTION, opacity: busy !== null || !message.trim() ? 0.4 : 1 }}>
          <MessageSquareWarning size={18} color={CAUTION} />
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: CAUTION }}>{busy === "changes_requested" ? "…" : "Cambios"}</Text>
        </Pressable>
        <Pressable disabled={busy !== null} onPress={() => decide("reviewed")} accessibilityRole="button" style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: GOOD, opacity: busy !== null ? 0.6 : 1 }}>
          <Check size={18} color="#fff" strokeWidth={2.6} />
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>{busy === "reviewed" ? "…" : "Revisada"}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
