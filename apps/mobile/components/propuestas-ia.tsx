import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronRight, Sparkles } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { c, font } from "../lib/theme";
import { FadeIn } from "./motion";
import { LEVEL_COLOR, Sheet } from "./sheet";

// GET /v1/consultant/proposed-tasks (ver apps/web/src/components/ai-proposed-tasks.tsx).
type Proposed = { area: "shopify" | "meta" | "klaviyo"; title: string; priority: string; pending_approval: boolean; output_id: string; write_index: number; evidence: Array<{ label: string; value: string }> };
export type ProposedClient = { organization_id: string; display_name: string; tasks: Proposed[] };

const AREA: Record<Proposed["area"], string> = { shopify: "Shopify", meta: "Meta Ads", klaviyo: "Klaviyo" };

/**
 * Lo que la IA propone, por tanda (una salida del agente = una decisión, igual que en la web). Cada propuesta entra
 * marcada; desmarcarla la descarta al crear. «Descartar» rechaza la tanda entera.
 */
const batchesOf = (clients: ProposedClient[]) =>
  clients.flatMap((cl) => {
    const byOutput = new Map<string, Proposed[]>();
    for (const t of cl.tasks.filter((x) => x.pending_approval)) byOutput.set(t.output_id, [...(byOutput.get(t.output_id) ?? []), t]);
    return [...byOutput].map(([outputId, tasks]) => ({ orgId: cl.organization_id, client: cl.display_name, outputId, tasks }));
  });

/** Hoja con las tandas de propuestas; se cierra sola al decidir la última. */
function BatchesSheet({ title, clients, showClient, open, onClose, onDone }: { title: string; clients: ProposedClient[]; showClient: boolean; open: boolean; onClose: () => void; onDone: () => void }) {
  const batches = batchesOf(clients);
  const total = batches.reduce((n, b) => n + b.tasks.length, 0);
  return (
    <Sheet visible={open} onClose={onClose} title={title} count={total}>
      <View style={{ gap: 22 }}>
        {batches.map((b, i) => (
          <FadeIn key={b.outputId} delay={i * 80}>
            <Batch
              {...b}
              showClient={showClient}
              onDone={() => {
                if (batches.length === 1) onClose();
                onDone();
              }}
            />
          </FadeIn>
        ))}
      </View>
    </Sheet>
  );
}

/**
 * Sin cliente elegido: las cuentas con propuestas pendientes de la IA, una fila por cuenta (cuántas y de qué canales);
 * tocarla abre sus propuestas en una hoja. Es lo primero que ve el consultor en Trabajo.
 */
export function PropuestasPorCuenta({ clients, onDone }: { clients: ProposedClient[]; onDone: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const accounts = clients
    .map((cl) => ({ cl, pending: cl.tasks.filter((t) => t.pending_approval) }))
    .filter((x) => x.pending.length > 0)
    .sort((a, b) => b.pending.length - a.pending.length);
  const open = accounts.find((x) => x.cl.organization_id === openId)?.cl ?? null;

  if (accounts.length === 0)
    return (
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 28, lineHeight: 34, fontFamily: font.semibold, color: c.ink, letterSpacing: -0.5 }}>La IA no propone nada</Text>
        <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.muted }}>Elige un cliente arriba para ver sus tareas.</Text>
      </View>
    );

  const total = accounts.reduce((n, x) => n + x.pending.length, 0);
  return (
    <View style={{ gap: 16 }}>
      <FadeIn style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color={c.ink} />
          <Text style={{ fontSize: 13, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>LA IA PROPONE</Text>
        </View>
        <Text style={{ fontSize: 28, lineHeight: 34, fontFamily: font.semibold, color: c.ink, letterSpacing: -0.5 }}>
          {`${total} tarea${total === 1 ? "" : "s"}`}
          <Text style={{ color: c.muted }}>{` en ${accounts.length} cuenta${accounts.length === 1 ? "" : "s"}`}</Text>
        </Text>
      </FadeIn>
      <View>
        {accounts.map(({ cl, pending }, i) => {
          const areas = [...new Set(pending.map((t) => AREA[t.area]))];
          const top = pending.find((t) => ["urgent", "high"].includes(t.priority)) ?? pending[0];
          return (
            <FadeIn key={cl.organization_id} delay={80 + i * 50}>
              <Pressable onPress={() => setOpenId(cl.organization_id)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.surface, opacity: pressed ? 0.5 : 1 })}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.ink }}>
                  <Text style={{ fontSize: 17, fontFamily: font.semibold, color: "#fff" }}>{pending.length}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: font.semibold, color: c.ink }}>{cl.display_name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{top ? `${areas.join(" · ")} · «${top.title}»` : areas.join(" · ")}</Text>
                </View>
                <ChevronRight size={18} color={c.muted} />
              </Pressable>
            </FadeIn>
          );
        })}
      </View>
      <BatchesSheet title={open?.display_name ?? ""} clients={open ? [open] : []} showClient={false} open={!!open} onClose={() => setOpenId(null)} onDone={onDone} />
    </View>
  );
}

export function PropuestasIA({ clients, showClient, onDone }: { clients: ProposedClient[]; showClient: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const batches = batchesOf(clients);
  if (batches.length === 0) return null;
  const total = batches.reduce((n, b) => n + b.tasks.length, 0);

  // Plegado: una línea que abre la hoja con las tandas.
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accentTint, opacity: pressed ? 0.6 : 1 })}>
        <Sparkles size={16} color={c.ink} />
        <Text style={{ flex: 1, fontSize: 14, fontFamily: font.medium, color: c.ink }}>{`La IA propone ${total} tarea${total === 1 ? "" : "s"}`}</Text>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>
      <BatchesSheet title="La IA propone" clients={clients} showClient={showClient} open={open} onClose={() => setOpen(false)} onDone={onDone} />
    </>
  );
}

function Batch({ orgId, client, outputId, tasks, showClient, onDone }: { orgId: string; client: string; outputId: string; tasks: Proposed[]; showClient: boolean; onDone: () => void }) {
  const [off, setOff] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keep = tasks.length - off.size;

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError(null);
    try {
      const real = decision === "approved" && keep === 0 ? "rejected" : decision;
      const edits = real === "approved" ? [...off].map((index) => ({ index, skip: true })) : [];
      await apiSend("POST", `/v1/organizations/${orgId}/ai/outputs/${outputId}/decision`, { decision: real, ...(edits.length ? { edits } : {}) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c.ink, paddingLeft: 14, gap: 4 }}>
      {showClient && <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.muted }}>{client}</Text>}
      {tasks.map((t) => {
        const on = !off.has(t.write_index);
        const ev = t.evidence[0];
        return (
          <Pressable
            key={t.write_index}
            onPress={() => setOff((s) => { const n = new Set(s); if (on) n.add(t.write_index); else n.delete(t.write_index); return n; })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 }}
          >
            <View style={{ marginTop: 1, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.ink : c.edge, backgroundColor: on ? c.ink : "transparent", alignItems: "center", justifyContent: "center" }}>
              {on && <Check size={13} color="#fff" strokeWidth={3} />}
            </View>
            <View style={{ flex: 1, gap: 3, opacity: on ? 1 : 0.45 }}>
              <Text style={{ fontSize: 15, lineHeight: 20, fontFamily: font.medium, color: c.ink, textDecorationLine: on ? "none" : "line-through" }}>{t.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: LEVEL_COLOR[t.priority] ?? c.edge }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: c.muted }}>{[AREA[t.area], ev ? `${ev.label}: ${ev.value}` : null].filter(Boolean).join(" · ")}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
      {error && <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingTop: 6 }}>
        <Pressable onPress={() => decide("approved")} disabled={!!busy} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: keep ? c.ink : c.danger, opacity: busy || pressed ? 0.6 : 1 })}>
          <Check size={16} color="#fff" strokeWidth={2.6} />
          <Text style={{ fontSize: 14, fontFamily: font.semibold, color: "#fff" }}>{busy === "approved" ? "Guardando…" : keep ? `Crear ${keep}` : "Descartar todo"}</Text>
        </Pressable>
        {keep > 0 && (
          <Pressable onPress={() => decide("rejected")} disabled={!!busy} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.muted }}>{busy === "rejected" ? "Descartando…" : "Descartar"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
