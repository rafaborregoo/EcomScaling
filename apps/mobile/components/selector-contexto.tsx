import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown, ChevronLeft, Store, Users } from "lucide-react-native";
import { byUrgency, STATUS, useWorkbench } from "../lib/cartera";
import { useApi } from "../lib/use-api";
import { c, font } from "../lib/theme";
import { matches, SearchBox } from "./consultor-clientes";
import { Sheet } from "./sheet";
import type { Org } from "./views";

type Connection = { id: string; provider_account_name: string | null; provider_account_id: string | null };
export type ClientRef = { id: string; name: string };

export const storeName = (s: Connection) => s.provider_account_name ?? s.provider_account_id ?? "Tienda";
export const useStores = (orgId: string | null) => useApi<{ connections: Connection[] }>(orgId ? `/v1/organizations/${orgId}/shopify/connections` : null).data?.connections ?? [];

/**
 * Dónde estás: "Todos los clientes" o "Cliente · Tienda". Va fijo en la cabecera del consultor; tocarlo abre la
 * hoja para cambiar de cliente y de tienda sin salir de la pantalla en la que estás.
 */
export function ContextBar({ org, recents, onPick, position }: { org: Org | null; recents: ClientRef[]; onPick: (client: ClientRef | null, connectionId?: string) => void; position?: string | null }) {
  const [open, setOpen] = useState(false);
  const stores = useStores(org?.id ?? null);
  const status = useWorkbench().data?.portfolio.find((p) => p.organization_id === org?.id)?.status;
  const store = stores.find((s) => s.id === org?.connectionId);
  const label = org ? (store ? `${org.name} · ${storeName(store)}` : org.name) : "Todos los clientes";

  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
      {org && (
        <Pressable onPress={() => onPick(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver a todos los clientes">
          <ChevronLeft size={24} color={c.ink} />
        </Pressable>
      )}
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Cambiar de cliente. Ahora: ${label}`} style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        {org ? status === "urgente" && <View accessibilityLabel="Urgente" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} /> : <Users size={18} color={c.ink} />}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontFamily: font.semibold, color: c.ink }}>{label}</Text>
        <ChevronDown size={18} color={c.ink} strokeWidth={2.25} />
      </Pressable>
      {position && <Text accessibilityLabel={`Cliente ${position.replace("/", " de ")}. Desliza para cambiar`} style={{ marginLeft: "auto", fontSize: 12, fontFamily: font.regular, color: c.muted }}>{position}</Text>}
      <ContextSheet
        visible={open}
        org={org}
        recents={recents}
        onClose={() => setOpen(false)}
        onPick={(client, connectionId) => {
          setOpen(false);
          onPick(client, connectionId);
        }}
      />
    </View>
  );
}

function ContextSheet({ visible, org, recents, onClose, onPick }: { visible: boolean; org: Org | null; recents: ClientRef[]; onClose: () => void; onPick: (client: ClientRef | null, connectionId?: string) => void }) {
  const { data } = useWorkbench();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const searching = q.trim().length > 0;
  const clients = data ? byUrgency(data.portfolio).filter((r) => !searching || matches(r.organization_name, q)) : [];
  const recent = recents.filter((r) => r.id !== org?.id).slice(0, 4);
  // Un cliente sale una sola vez: si ya está en Recientes no se repite en la lista de abajo.
  const inRecent = new Set(searching ? [] : recent.map((r) => r.id));

  const row = (id: string, name: string, status: keyof typeof STATUS, key = id) => (
    <PickRow key={key} id={id} name={name} status={status} org={org} expanded={expanded === id} onToggle={() => setExpanded(expanded === id ? null : id)} onPick={onPick} />
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Cliente">
      <SearchBox value={q} onChange={setQ} />
      {!searching && (
        <Pressable onPress={() => onPick(null)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
          <Users size={18} color={c.ink} />
          <Text style={{ flex: 1, fontSize: 15, fontFamily: org ? font.medium : font.semibold, color: c.ink }}>Todos los clientes</Text>
          {!org && <Check size={18} color={c.ink} />}
        </Pressable>
      )}
      {!searching && recent.length > 0 && (
        <View>
          <Text style={{ paddingBottom: 2, fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>RECIENTES</Text>
          {recent.map((r) => row(r.id, r.name, data?.portfolio.find((p) => p.organization_id === r.id)?.status ?? "vigilar", `r-${r.id}`))}
        </View>
      )}
      <View>
        {!searching && recent.length > 0 && <Text style={{ paddingBottom: 2, fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>CLIENTES</Text>}
        {clients.filter((r) => !inRecent.has(r.organization_id)).map((r) => row(r.organization_id, r.organization_name, r.status))}
        {data && clients.length === 0 && <Text style={{ paddingVertical: 12, fontSize: 14, fontFamily: font.regular, color: c.muted }}>Ningún cliente coincide.</Text>}
      </View>
    </Sheet>
  );
}

/** Un cliente no se elige sin tienda: con una sola, tocarlo la elige; con varias, despliega las suyas. */
function PickRow({ id, name, status, org, expanded, onToggle, onPick }: { id: string; name: string; status: keyof typeof STATUS; org: Org | null; expanded: boolean; onToggle: () => void; onPick: (client: ClientRef, connectionId: string) => void }) {
  const stores = useStores(id);
  const current = org?.id === id;
  const press = () => (stores.length === 1 ? onPick({ id, name }, stores[0].id) : onToggle());
  return (
    <View>
      <Pressable onPress={press} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.edge }}>
        <View accessibilityLabel={status === "urgente" ? "Urgente" : undefined} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === "urgente" ? c.danger : "transparent" }} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: current ? font.semibold : font.medium, color: c.ink }}>{name}</Text>
        {current && <Check size={18} color={c.ink} />}
        {stores.length > 1 && <ChevronDown size={16} color={c.muted} />}
      </Pressable>
      {(expanded || (current && stores.length > 1)) && (
        <View style={{ paddingLeft: 22, paddingBottom: 6 }}>
          {stores.map((st) => {
            const on = current && org?.connectionId === st.id;
            return (
              <Pressable key={st.id} onPress={() => onPick({ id, name }, st.id)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                <Store size={14} color={c.muted} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: on ? font.semibold : font.regular, color: c.ink }}>{storeName(st)}</Text>
                {on && <Check size={16} color={c.ink} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
