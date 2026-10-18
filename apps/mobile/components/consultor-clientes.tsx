import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronRight, Search } from "lucide-react-native";
import { byUrgency, STATUS, useWorkbench, type PortfolioClient } from "../lib/cartera";
import { c, font } from "../lib/theme";
import { Screen, Status } from "./ui";

/** Filtra por nombre sin tildes ni mayúsculas: "hue" encuentra "Huerta Norte". */
export const matches = (name: string, q: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(q.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim());

export function SearchBox({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.edge }}>
      <Search size={16} color={c.muted} />
      <TextInput
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChange}
        placeholder="Buscar cliente"
        placeholderTextColor={c.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.regular, color: c.ink }}
      />
    </View>
  );
}

/** Una fila de cliente: semáforo, nombre y solo lo que pide atención (alertas críticas). */
export function ClientRow({ client, first, onPress }: { client: PortfolioClient; first?: boolean; onPress: () => void }) {
  const s = STATUS[client.status];
  const meta = [client.critical_alerts > 0 && `${client.critical_alerts} crítica${client.critical_alerts > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${client.organization_name}, ${s.label}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: first ? 0 : 1, borderTopColor: c.edge }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{client.organization_name}</Text>
        {meta ? <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: client.status === "urgente" ? c.danger : c.muted }}>{meta}</Text> : null}
        {client.next_action && <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.ink }}>{client.next_action.title}</Text>}
      </View>
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}

/** Pestaña Clientes sin cliente elegido (y selector de cliente de las demás pestañas): buscador y lista por urgencia. */
export function ClientList({ onPick, title = "Clientes" }: { onPick: (client: { id: string; name: string }) => void; title?: string }) {
  const { data, error, reload, retry } = useWorkbench();
  const [q, setQ] = useState("");
  const rows = data ? byUrgency(data.portfolio).filter((r) => !q.trim() || matches(r.organization_name, q)) : [];
  return (
    <Screen flat title={title} onRefresh={reload}>
      <SearchBox value={q} onChange={setQ} />
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <View>
          {rows.map((r, i) => (
            <ClientRow key={r.organization_id} client={r} first={i === 0} onPress={() => onPick({ id: r.organization_id, name: r.organization_name })} />
          ))}
          {rows.length === 0 && <Text style={{ paddingVertical: 16, fontSize: 14, fontFamily: font.regular, color: c.muted }}>{q.trim() ? "Ningún cliente coincide." : "No tienes clientes asignados."}</Text>}
        </View>
      )}
    </Screen>
  );
}
