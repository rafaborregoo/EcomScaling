import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Building2, Menu, TriangleAlert, UserCheck, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Bootstrap } from "../lib/api";
import { useApi } from "../lib/use-api";
import { CAUTION, c, fmtCurrency, fmtNum, font, GOOD } from "../lib/theme";
import { matches, SearchBox } from "./consultor-clientes";
import { HomeContent, type DashTab } from "./dashboard";
import { Sheet } from "./sheet";
import { SettingsModal } from "./settings";
import { MetricList, Screen, Status, SubNav } from "./ui";

// Interfaz del ADMINISTRADOR de plataforma (Rafa): vigila la plataforma, no lleva clientes. Tres pestañas: Estado
// (servidor, worker, API, fallos por cliente), Consultores (carga y gasto de IA) y Clientes (quién los lleva y qué
// cuestan). Desde un cliente se abre su vista para dar soporte. El trabajo operativo con clientes es del consultor.
const MODULES = [
  { key: "estado", label: "Estado", Icon: Activity },
  { key: "consultores", label: "Consultores", Icon: UserCheck },
  { key: "clientes", label: "Clientes", Icon: Building2 },
] as const satisfies ReadonlyArray<{ key: string; label: string; Icon: LucideIcon }>;
type ModuleKey = (typeof MODULES)[number]["key"];

const WARN = CAUTION;
const usd = (v: number) => fmtCurrency(v, "USD", 2);

type ClientRef = { id: string; name: string };

// --- Datos ------------------------------------------------------------------------------------------

// Subconjunto de /v1/admin/platform-health (apps/api/src/platform-health.ts).
type Health = {
  host: { cpu_percent: number | null; memory_used_percent: number | null; disk_used_percent: number | null };
  application: { worker: { status: string }; slo: { status?: string; p95LatencyMs?: number | null; errorCount?: number; requestCount?: number } };
  alerts: Array<{ severity: "warning" | "critical"; key: string; message: string }>;
  customers: { affected_organizations: Array<{ organization_id: string; organization_name: string; sync_failures: number; agent_failures: number }> };
  feedback: { open_count: number; reports: Array<{ id: string; organization_name: string; message: string }> };
};

// Subconjunto de /v1/admin/consultants (apps/api/src/consultant.ts).
type Ai = { cost_usd: number; run_count: number };
type Consultants = {
  consultants: Array<{ id: string; full_name: string | null; is_active: boolean; assignments: Array<{ organization_id: string; display_name: string; status: string }>; ai: Ai }>;
  organizations: Array<{ id: string; display_name: string; status: string }>;
  organization_stats: Record<string, Ai>;
};

const pctColor = (v: number | null, warn: number, bad: number) => (v == null ? c.muted : v >= bad ? c.danger : v >= warn ? WARN : c.ink);
const pctText = (v: number | null) => (v == null ? "—" : `${Math.round(v)} %`);

// --- Pantallas --------------------------------------------------------------------------------------

function Estado({ onClient }: { onClient: (c: ClientRef) => void }) {
  const { data, error, reload, retry } = useApi<Health>("/v1/admin/platform-health");
  const worker = data?.application.worker.status;
  const slo = data?.application.slo;
  const bad = (data?.alerts ?? []).some((a) => a.severity === "critical");
  return (
    <Screen flat title="Estado" onRefresh={reload}>
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: bad ? c.danger : data.alerts.length ? WARN : GOOD }} />
            <Text style={{ fontSize: 22, fontFamily: font.semibold, color: c.ink }}>{bad ? "Hay algo roto" : data.alerts.length ? "Vigilar" : "Todo en orden"}</Text>
          </View>

          {data.alerts.map((a) => (
            <View key={a.key} style={{ flexDirection: "row", gap: 10 }}>
              <TriangleAlert size={18} color={a.severity === "critical" ? c.danger : WARN} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>{a.message}</Text>
            </View>
          ))}

          <MetricList
            rows={[
              { label: "CPU", value: pctText(data.host.cpu_percent), dot: pctColor(data.host.cpu_percent, 70, 90) },
              { label: "Memoria", value: pctText(data.host.memory_used_percent), dot: pctColor(data.host.memory_used_percent, 75, 90) },
              { label: "Disco", value: pctText(data.host.disk_used_percent), dot: pctColor(data.host.disk_used_percent, 70, 85) },
              { label: "Worker", value: worker ?? "—", dot: worker === "ok" || worker === "healthy" ? GOOD : worker ? c.danger : c.muted },
              { label: "API p95", value: slo?.p95LatencyMs != null ? `${Math.round(slo.p95LatencyMs)} ms` : "—", dot: slo?.status === "critical" ? c.danger : slo?.status === "degraded" ? WARN : GOOD },
              { label: "Errores API", value: slo?.requestCount ? `${fmtNum(slo.errorCount ?? 0)} / ${fmtNum(slo.requestCount)}` : "—" },
            ]}
          />

          {data.customers.affected_organizations.length > 0 && (
            <View>
              <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>CLIENTES CON FALLOS</Text>
              {data.customers.affected_organizations.slice(0, 10).map((o, i) => (
                <Pressable key={o.organization_id} onPress={() => onClient({ id: o.organization_id, name: o.organization_name })} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{o.organization_name}</Text>
                  {o.sync_failures > 0 && <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.danger }}>sync {o.sync_failures}</Text>}
                  {o.agent_failures > 0 && <Text style={{ fontSize: 14, fontFamily: font.semibold, color: WARN }}>IA {o.agent_failures}</Text>}
                </Pressable>
              ))}
            </View>
          )}

          {data.feedback.open_count > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>{`REPORTES DE CLIENTES · ${data.feedback.open_count}`}</Text>
              {data.feedback.reports.slice(0, 5).map((r) => (
                <View key={r.id} style={{ gap: 2 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.ink }}>{r.organization_name}</Text>
                  <Text numberOfLines={3} style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.muted }}>{r.message}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Consultores({ onClient }: { onClient: (c: ClientRef) => void }) {
  const { data, error, reload, retry } = useApi<Consultants>("/v1/admin/consultants");
  const [open, setOpen] = useState<string | null>(null);
  const current = data?.consultants.find((x) => x.id === open) ?? null;
  const list = [...(data?.consultants ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.ai.cost_usd - a.ai.cost_usd);
  return (
    <Screen flat title="Consultores" onRefresh={reload}>
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <View>
          {list.map((x, i) => (
            <Pressable key={x.id} onPress={() => setOpen(x.id)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.is_active ? GOOD : c.edge }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: font.semibold, color: x.is_active ? c.ink : c.muted }}>{x.full_name ?? "Sin nombre"}</Text>
                <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{`${x.assignments.length} cliente${x.assignments.length === 1 ? "" : "s"}`}</Text>
              </View>
              <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{usd(x.ai.cost_usd)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Sheet visible={!!current} onClose={() => setOpen(null)} title={current?.full_name ?? "Consultor"} count={current?.assignments.length}>
        {current?.assignments.map((a, i) => (
          <Pressable
            key={a.organization_id}
            onPress={() => {
              setOpen(null);
              onClient({ id: a.organization_id, name: a.display_name });
            }}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}
          >
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{a.display_name}</Text>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

function Clientes({ onClient }: { onClient: (c: ClientRef) => void }) {
  const { data, error, reload, retry } = useApi<Consultants>("/v1/admin/consultants");
  const [q, setQ] = useState("");
  // Quién lleva a cada cliente, por nombre.
  const owners = new Map<string, string[]>();
  for (const k of data?.consultants ?? []) for (const a of k.assignments) owners.set(a.organization_id, [...(owners.get(a.organization_id) ?? []), k.full_name ?? "—"]);
  const rows = (data?.organizations ?? []).filter((o) => !q.trim() || matches(o.display_name, q)).sort((a, b) => a.display_name.localeCompare(b.display_name));
  return (
    <Screen flat title="Clientes" onRefresh={reload}>
      <SearchBox value={q} onChange={setQ} />
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <View>
          {rows.map((o, i) => {
            const cost = data.organization_stats[o.id]?.cost_usd ?? 0;
            const who = owners.get(o.id)?.join(", ");
            return (
              <Pressable key={o.id} onPress={() => onClient({ id: o.id, name: o.display_name })} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{o.display_name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: who ? c.muted : c.danger }}>{who ?? "Sin consultor"}</Text>
                </View>
                <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>{usd(cost)}</Text>
              </Pressable>
            );
          })}
          {rows.length === 0 && <Text style={{ paddingVertical: 16, fontSize: 14, fontFamily: font.regular, color: c.muted }}>Ningún cliente coincide.</Text>}
        </View>
      )}
    </Screen>
  );
}

const CHANNELS = [
  { key: "todo", label: "Todo" },
  { key: "shopify", label: "Shopify" },
  { key: "meta", label: "Meta" },
  { key: "klaviyo", label: "Klaviyo" },
] as const satisfies ReadonlyArray<{ key: DashTab; label: string }>;

/** Vista de un cliente a pantalla completa, para dar soporte: sus cifras tal como las ve el consultor. */
function ClientView({ client, onClose }: { client: ClientRef | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<DashTab>("todo");
  if (!client) return null;
  const org = { id: client.id, name: client.name, isConsultant: true };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.edge }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontFamily: font.semibold, color: c.ink }}>{client.name}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
            <X size={24} color={c.ink} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <SubNav items={[...CHANNELS]} value={tab} onChange={setTab} />
        </View>
        <HomeContent tab={tab} org={org} nav={{ onTab: setTab, onMetrics: () => {} }} />
      </View>
    </Modal>
  );
}

// --- Shell ------------------------------------------------------------------------------------------

export function AdminShell({ boot, onSignOut }: { boot: Bootstrap; onSignOut: () => void }) {
  const insets = useSafeAreaInsets();
  const [module, setModule] = useState<ModuleKey>("estado");
  const [client, setClient] = useState<ClientRef | null>(null);
  const [settings, setSettings] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.edge, backgroundColor: c.bg }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 18, fontFamily: font.semibold, color: c.ink }}>Plataforma</Text>
        </View>
        <Pressable onPress={() => setSettings(true)} hitSlop={12} accessibilityLabel="Configuración">
          <Menu size={24} color={c.ink} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {module === "estado" && <Estado onClient={setClient} />}
        {module === "consultores" && <Consultores onClient={setClient} />}
        {module === "clientes" && <Clientes onClient={setClient} />}
      </View>

      <View style={{ flexDirection: "row", paddingTop: 8, paddingBottom: insets.bottom + 6, borderTopWidth: 1, borderTopColor: c.edge, backgroundColor: c.bg }}>
        {MODULES.map(({ key, label, Icon }) => {
          const on = key === module;
          return (
            <Pressable key={key} onPress={() => setModule(key)} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <Icon size={22} color={on ? c.accent : c.muted} strokeWidth={on ? 2.4 : 1.9} />
              <Text style={{ fontSize: 11, fontFamily: on ? font.semibold : font.regular, color: on ? c.accent : c.muted }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ClientView client={client} onClose={() => setClient(null)} />
      <SettingsModal visible={settings} onClose={() => setSettings(false)} boot={boot} org={null} isConsultant onSignOut={onSignOut} onStore={() => {}} />
    </View>
  );
}
