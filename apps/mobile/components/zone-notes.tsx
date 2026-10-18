import { useState } from "react";
import { Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { c, font, GOOD } from "../lib/theme";
import { RoundIcon } from "./sheet";

// Notas que el consultor deja en una tarjeta del panel web (apps/web/src/components/zone-notes.tsx). Mismo endpoint:
// el cliente ve las que aún no ha visto y, al marcarlas como vistas, desaparecen también en la web.
// Pasa el juez de alcance: es un aviso de su consultor, se despacha en un toque y no necesita pantalla grande.
type ZoneNote = { id: string; anchor: string; body: string; expires_at: string | null; seen_at: string | null; created_at: string };

// "kpi:ventas-netas" -> "Ventas netas"; "bloque:vigilar" -> "Vigilar".
function anchorLabel(anchor: string) {
  const slug = anchor.split(":").slice(1).join(":") || anchor;
  const text = slug.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Notas sin ver del consultor, en "Para hoy". Si no hay ninguna, no ocupa sitio. */
export function ZoneNotesWidget({ orgId, connectionId }: { orgId: string; connectionId?: string }) {
  const path = `/v1/organizations/${orgId}/zone-notes`;
  // Las notas son por tienda: la elegida en Configuración (la web usa la de la cabecera).
  const notes = useApi<{ notes: ZoneNote[] }>(connectionId ? `${path}?connectionId=${encodeURIComponent(connectionId)}` : path);
  const [busy, setBusy] = useState<string | null>(null);
  const list = (notes.data?.notes ?? []).filter((n) => !n.seen_at);
  if (list.length === 0) return null;

  async function seen(note: ZoneNote) {
    setBusy(note.id);
    try {
      await apiSend("POST", `${path}/${note.id}/seen`);
      await notes.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {list.map((note) => (
        <View key={note.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "#fffbea", borderWidth: 1, borderColor: "#f3d65a" }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: font.semibold, color: "#7a5b00" }}>Tu consultor · {anchorLabel(note.anchor)}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>{note.body}</Text>
          </View>
          <RoundIcon Icon={Check} color={GOOD} disabled={busy === note.id} label="Visto" onPress={() => void seen(note)} />
        </View>
      ))}
    </View>
  );
}
