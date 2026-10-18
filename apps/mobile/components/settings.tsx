import { useState, type ReactNode } from "react";
import { Animated, Linking, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Check, ChevronLeft, ChevronRight, CreditCard, HelpCircle, Plug, Shield, Sparkles, User, UserCheck } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { apiSend, type Bootstrap } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useApi } from "../lib/use-api";
import { c, font } from "../lib/theme";
import { useSwipeDown } from "./sheet";
import { ListCard, ListRow, Note, RowMeta, RowTitle, Status } from "./ui";
import type { Org } from "./views";

const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "";

// Configuración de la web (apps/web/src/app/configuracion), ajustada al móvil: lo que se consulta o se cambia en segundos.
// Costes, objetivos, equipo y roles, reglas de alertas y datos de la tienda se quedan en la web.
type Page = "perfil" | "notificaciones" | "seguridad" | "integraciones" | "copiloto" | "consultor" | "plan" | "ayuda";

const ROLE_LABEL: Record<string, string> = { platform_admin: "Administrador de plataforma", consultant: "Consultor", client: "Cliente", owner: "Propietario", manager: "Responsable", member: "Miembro" };

type Props = { visible: boolean; onClose: () => void; boot: Bootstrap | null; org: Org | null; isConsultant: boolean; onSignOut: () => void; onStore: (connectionId: string) => void };

export function SettingsModal({ visible, onClose, boot, org, isConsultant, onSignOut, onStore }: Props) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page | null>(null);
  const close = () => {
    setPage(null);
    onClose();
  };

  const back = page ? () => setPage(null) : close;
  const swipe = useSwipeDown(back);

  const item = (key: Page, label: string, Icon: LucideIcon, first = false) => (
    <ListRow key={key} first={first} onPress={() => setPage(key)} right={<ChevronRight size={18} color={c.muted} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon size={20} color={c.ink} />
        <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{label}</Text>
      </View>
    </ListRow>
  );

  const titles: Record<Page, string> = { perfil: "Perfil", notificaciones: "Notificaciones", seguridad: "Seguridad", integraciones: "Integraciones", copiloto: "Copiloto IA", consultor: "Tu consultor", plan: "Plan", ayuda: "Ayuda y legal" };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back}>
      <Animated.View style={[{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }, swipe.style]}>
        <View {...swipe.panHandlers} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.edge }}>
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Volver">
            <ChevronLeft size={24} color={c.ink} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: font.semibold, color: c.ink }}>{page ? titles[page] : "Configuración"}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {!page && (
            <>
              {/* El consultor cambia de tienda en el selector de su cabecera. */}
              {org && !isConsultant && <StorePicker org={org} onPick={onStore} />}
              <ListCard title="Tú">
                {item("perfil", "Perfil", User, true)}
                {item("notificaciones", "Notificaciones", Bell)}
                {item("seguridad", "Seguridad", Shield)}
              </ListCard>
              {org && (
                <ListCard title={isConsultant ? `Cliente: ${org.name}` : "Tu tienda"}>
                  {item("integraciones", "Integraciones", Plug, true)}
                  {item("copiloto", "Copiloto IA", Sparkles)}
                  {!isConsultant && item("consultor", "Tu consultor", UserCheck)}
                  {!isConsultant && item("plan", "Plan", CreditCard)}
                </ListCard>
              )}
              <ListCard>{item("ayuda", "Ayuda y legal", HelpCircle, true)}</ListCard>
              <Pressable onPress={onSignOut} style={{ borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: c.edge }}>
                <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.danger }}>Cerrar sesión</Text>
              </Pressable>
            </>
          )}
          {page === "perfil" && <Perfil boot={boot} />}
          {page === "notificaciones" && <Notificaciones isConsultant={isConsultant} />}
          {page === "seguridad" && <Seguridad />}
          {page === "integraciones" && org && <Integraciones org={org} />}
          {page === "copiloto" && org && <CopilotoIA org={org} />}
          {page === "consultor" && org && <Consultor org={org} />}
          {page === "plan" && org && <Plan org={org} />}
          {page === "ayuda" && <Ayuda />}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// --- Páginas -------------------------------------------------------------------

type ShopifyConnection = { id: string; provider_account_name: string | null; provider_account_id: string | null };

/** Tienda con la que se ven las cifras de toda la app. Vacío = todas las tiendas del cliente (igual que el selector de la web). */
function StorePicker({ org, onPick }: { org: Org; onPick: (connectionId: string) => void }) {
  const { data } = useApi<{ connections: ShopifyConnection[] }>(`/v1/organizations/${org.id}/shopify/connections`);
  const stores = data?.connections ?? [];
  if (stores.length < 2) return null;
  const rows = [{ id: "", name: "Todas las tiendas" }, ...stores.map((s) => ({ id: s.id, name: s.provider_account_name ?? s.provider_account_id ?? "Tienda" }))];
  return (
    <ListCard title="Tienda">
      {rows.map((r, i) => (
        <ListRow key={r.id || "todas"} first={i === 0} onPress={() => onPick(r.id)} right={(org.connectionId ?? "") === r.id ? <Check size={20} color={c.ink} /> : null}>
          <RowTitle>{r.name}</RowTitle>
        </ListRow>
      ))}
    </ListCard>
  );
}

function Value({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.muted }}>{children}</Text>;
}

function Perfil({ boot }: { boot: Bootstrap | null }) {
  if (!boot) return <Status error={null} loading />;
  return (
    <ListCard>
      <ListRow first right={<Value>{boot.profile.full_name ?? "—"}</Value>}><RowTitle>Nombre</RowTitle></ListRow>
      <ListRow right={<Value>{boot.user.email ?? "—"}</Value>}><RowTitle>Email</RowTitle></ListRow>
      <ListRow right={<Value>{ROLE_LABEL[boot.profile.platform_role] ?? boot.profile.platform_role}</Value>}><RowTitle>Rol</RowTitle></ListRow>
      {boot.memberships.filter((m) => m.organization).slice(0, 6).map((m) => (
        <ListRow key={m.organization_id} right={<Value>{ROLE_LABEL[m.role] ?? m.role}</Value>}><RowTitle>{m.organization!.display_name}</RowTitle></ListRow>
      ))}
    </ListCard>
  );
}

// ---- Notificaciones: mismas categorías y API que la web (/v1/me/notification-settings). La campana y el push comparten el interruptor.
type EmailMode = "instant" | "digest" | "off";
type Preference = { category: string; in_app: boolean; email: EmailMode };
type NotifSettings = { preferences: Preference[]; settings: { quiet_enabled: boolean; quiet_from: number; quiet_to: number }; email: string | null };

const CLIENT_LABELS: Record<string, string> = {
  alert_critical: "Alertas críticas de tu tienda",
  alert: "Otras alertas",
  task_assigned: "Tareas que te asignan",
  message: "Mensajes de tu consultor",
  campaign_review: "Campañas para revisar",
  integration: "Integraciones que dejan de sincronizar",
  other: "Otros avisos",
};
const CONSULTANT_LABELS: Record<string, string> = {
  alert_critical: "Alertas críticas de tus clientes",
  alert: "Otras alertas de tus clientes",
  task_assigned: "Tareas que te asignan",
  message: "Mensajes de tus clientes",
  campaign_review: "Campañas y piezas para revisar",
  integration: "Integraciones caídas en tu cartera",
  client: "Altas y cambios de tus clientes",
  other: "Otros avisos",
};
const EMAIL_LABEL: Record<EmailMode, string> = { instant: "Al momento", digest: "En el resumen", off: "No" };
const NEXT_MODE: Record<EmailMode, EmailMode> = { instant: "digest", digest: "off", off: "instant" };

function Notificaciones({ isConsultant }: { isConsultant: boolean }) {
  const { data, error, retry } = useApi<NotifSettings>("/v1/me/notification-settings");
  const [local, setLocal] = useState<NotifSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const current = local ?? data;
  const labels = isConsultant ? CONSULTANT_LABELS : CLIENT_LABELS;

  async function save(body: { preferences?: Array<{ category: string; in_app?: boolean; email?: EmailMode }>; settings?: { quiet_enabled: boolean } }) {
    if (!current) return;
    // Optimista: se ve el cambio al momento y se deshace si la API lo rechaza.
    setLocal({
      ...current,
      preferences: current.preferences.map((p) => ({ ...p, ...(body.preferences?.find((b) => b.category === p.category) ?? {}) })),
      settings: { ...current.settings, ...(body.settings ?? {}) },
    });
    setSaveError(null);
    try {
      setLocal(await apiSend<NotifSettings>("PUT", "/v1/me/notification-settings", body));
    } catch (e) {
      setLocal(null);
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  if (!current) return <Status error={error} loading={!error} retry={retry} />;
  return (
    <>
      <ListCard title="Avisos en la app y push">
        {current.preferences.map((p, i) => (
          <ListRow key={p.category} first={i === 0} right={<Switch value={p.in_app} onValueChange={(v) => save({ preferences: [{ category: p.category, in_app: v }] })} trackColor={{ true: c.accent }} />}>
            <RowTitle>{labels[p.category] ?? p.category}</RowTitle>
          </ListRow>
        ))}
      </ListCard>
      <ListCard title="Por email">
        {current.preferences.map((p, i) => (
          <ListRow key={p.category} first={i === 0} onPress={() => save({ preferences: [{ category: p.category, email: NEXT_MODE[p.email] }] })} right={<Text style={{ fontSize: 14, fontFamily: font.medium, color: p.email === "off" ? c.muted : c.accent }}>{EMAIL_LABEL[p.email]}</Text>}>
            <RowTitle>{labels[p.category] ?? p.category}</RowTitle>
          </ListRow>
        ))}
      </ListCard>
      <ListCard>
        <ListRow first right={<Switch value={current.settings.quiet_enabled} onValueChange={(v) => save({ settings: { quiet_enabled: v } })} trackColor={{ true: c.accent }} />}>
          <RowTitle>Silencio nocturno</RowTitle>
          <RowMeta>{`De ${current.settings.quiet_from}:00 a ${current.settings.quiet_to}:00 · solo pasan las críticas`}</RowMeta>
        </ListRow>
      </ListCard>
      {saveError && <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{saveError}</Text>}
    </>
  );
}

function Seguridad() {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function change() {
    if (pass.length < 8) return setMsg({ ok: false, text: "La contraseña debe tener al menos 8 caracteres." });
    if (pass !== again) return setMsg({ ok: false, text: "Las contraseñas no coinciden." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setPass("");
    setAgain("");
    setMsg({ ok: true, text: "Contraseña cambiada." });
  }

  const input = { borderWidth: 1, borderColor: c.edge, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: font.regular, color: c.ink } as const;
  return (
    <ListCard title="Cambiar contraseña">
      <View style={{ padding: 16, gap: 12 }}>
        <TextInput style={input} placeholder="Nueva contraseña" placeholderTextColor={c.muted} secureTextEntry value={pass} onChangeText={setPass} autoComplete="new-password" />
        <TextInput style={input} placeholder="Repite la contraseña" placeholderTextColor={c.muted} secureTextEntry value={again} onChangeText={setAgain} autoComplete="new-password" />
        {msg && <Text style={{ fontSize: 14, fontFamily: font.regular, color: msg.ok ? c.accent : c.danger }}>{msg.text}</Text>}
        <Pressable onPress={change} disabled={busy} style={{ borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: busy ? c.muted : c.accent }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>{busy ? "Guardando..." : "Guardar"}</Text>
        </Pressable>
      </View>
    </ListCard>
  );
}

// ---- Integraciones: estado de cada conexión (solo lectura; conectar y reconectar se hace en la web, con OAuth).
type Integrations = { providers: Array<{ id: string; name: string; connection: { status: string; last_sync_at: string | null } | null }> };

function ago(iso: string | null) {
  if (!iso) return "sin sincronizar";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `hace ${Math.max(1, m)} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
}

function Integraciones({ org }: { org: Org }) {
  const { data, error, retry } = useApi<Integrations>(`/v1/organizations/${org.id}/integrations`);
  if (!data) return <Status error={error} loading={!error} retry={retry} />;
  return (
    <>
      <ListCard>
        {data.providers.map((p, i) => {
          const status = p.connection?.status;
          const bad = status === "error" || status === "revoked";
          return (
            <ListRow key={p.id} first={i === 0}>
              <RowTitle>{p.name}</RowTitle>
              <RowMeta tone={bad ? "bad" : p.connection ? "good" : undefined}>{!p.connection ? "Sin conectar" : bad ? "Hay que reconectar" : `Conectada · ${ago(p.connection.last_sync_at)}`}</RowMeta>
            </ListRow>
          );
        })}
      </ListCard>
      <Note text="Conectar o reconectar una integración se hace en la web." />
    </>
  );
}

// ---- Copiloto IA: saldo del mes y qué análisis corren solos (/ai-settings).
type Saldo = { granted: number; remaining: number; days_to_renewal: number; exhausted: boolean; can_upgrade?: boolean };
type AiSettings = { can_edit: boolean; groups: Array<{ group: string; enabled: boolean }> };
const GROUP_LABEL: Record<string, string> = {
  lectura: "Lectura de tus cifras",
  tareas: "Propuesta de tareas",
  stock: "Vigilancia de stock",
  email: "Analista de email",
  planes: "Planes semanal y mensual",
};

function CopilotoIA({ org }: { org: Org }) {
  const saldo = useApi<Saldo>(`/v1/organizations/${org.id}/copilot/saldo`);
  const ai = useApi<AiSettings>(`/v1/organizations/${org.id}/ai-settings`);
  const [error, setError] = useState<string | null>(null);

  async function toggle(group: string, enabled: boolean) {
    setError(null);
    try {
      await apiSend("PUT", `/v1/organizations/${org.id}/ai-settings`, { group, enabled });
      await ai.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  const s = saldo.data;
  const percent = s && s.granted > 0 ? Math.round((s.remaining / s.granted) * 100) : 0;
  return (
    <>
      <ListCard title="Saldo de este mes">
        {s ? (
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 28, fontFamily: font.semibold, color: s.exhausted ? c.danger : c.ink }}>{percent} %</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface }}>
              <View style={{ height: 6, borderRadius: 3, width: `${percent}%`, backgroundColor: s.exhausted ? c.danger : c.accent }} />
            </View>
            <RowMeta>{`Se renueva en ${s.days_to_renewal} días`}</RowMeta>
            {(s.exhausted || percent < 20) &&
              (s.can_upgrade ? (
                <Pressable onPress={() => Linking.openURL(`${webUrl}/planes`)} style={{ alignSelf: "flex-start", marginTop: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: c.accent }}>
                  <Text style={{ fontSize: 14, fontFamily: font.semibold, color: "#fff" }}>Mejorar plan</Text>
                </Pressable>
              ) : (
                <RowMeta>Para ampliar el saldo, avisa al propietario del plan o a tu consultor.</RowMeta>
              ))}
          </View>
        ) : (
          <Status error={saldo.error} loading={!saldo.error} retry={saldo.retry} />
        )}
      </ListCard>
      {ai.data && (
        <ListCard title="Análisis automáticos">
          {ai.data.groups.map((g, i) => (
            <ListRow key={g.group} first={i === 0} right={<Switch value={g.enabled} disabled={!ai.data!.can_edit} onValueChange={(v) => toggle(g.group, v)} trackColor={{ true: c.accent }} />}>
              <RowTitle>{GROUP_LABEL[g.group] ?? g.group}</RowTitle>
            </ListRow>
          ))}
        </ListCard>
      )}
      {error && <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text>}
    </>
  );
}

function Consultor({ org }: { org: Org }) {
  const { data, error, retry } = useApi<{ consultant: { full_name: string | null; is_primary: boolean } | null }>(`/v1/organizations/${org.id}/my-consultant`);
  if (!data) return <Status error={error} loading={!error} retry={retry} />;
  return (
    <ListCard>
      <ListRow first>
        <RowTitle>{data.consultant?.full_name ?? "Sin consultor asignado"}</RowTitle>
        {data.consultant ? <RowMeta>{data.consultant.is_primary ? "Consultor principal" : "Consultor"}</RowMeta> : null}
      </ListRow>
    </ListCard>
  );
}

// ---- Plan: solo lectura. Cobro, tarjeta y facturas se gestionan en la web (Stripe).
type Billing = { plan_code: string | null; status: string | null; next_payment_at: string | null; amount: number | null; currency: string | null; interval: string | null; cancel_at_period_end: boolean };
const INTERVAL: Record<string, string> = { month: "al mes", year: "al año" };

function Plan({ org }: { org: Org }) {
  const { data, error, retry } = useApi<Billing>(`/v1/organizations/${org.id}/billing`);
  if (!data) return <Status error={error} loading={!error} retry={retry} />;
  const next = data.next_payment_at ? new Date(data.next_payment_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
  return (
    <>
      <ListCard>
        <ListRow first right={<Value>{data.plan_code ?? "—"}</Value>}><RowTitle>Plan</RowTitle></ListRow>
        <ListRow right={<Value>{data.status ?? "—"}</Value>}><RowTitle>Estado</RowTitle></ListRow>
        {data.amount != null && data.currency ? <ListRow right={<Value>{`${new Intl.NumberFormat("es-ES", { style: "currency", currency: data.currency }).format(data.amount)} ${INTERVAL[data.interval ?? ""] ?? ""}`}</Value>}><RowTitle>Importe</RowTitle></ListRow> : null}
        <ListRow right={<Value>{data.cancel_at_period_end ? "Se cancela" : next}</Value>}><RowTitle>Próximo cobro</RowTitle></ListRow>
      </ListCard>
      {webUrl !== "" && (
        <Pressable onPress={() => Linking.openURL(`${webUrl}/configuracion?section=plan`)}>
          <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>Gestionar facturación en la web</Text>
        </Pressable>
      )}
    </>
  );
}

const LEGAL: Array<[string, string]> = [
  ["Ayuda", "/ayuda"],
  ["Política de privacidad", "/politica-privacidad"],
  ["Condiciones del servicio", "/condiciones"],
  ["Aviso legal", "/aviso-legal"],
  ["Cookies", "/cookies"],
];

function Ayuda() {
  if (!webUrl) return <Note text="Configura EXPO_PUBLIC_WEB_URL para abrir estas páginas." />;
  return (
    <ListCard>
      {LEGAL.map(([label, path], i) => (
        <ListRow key={path} first={i === 0} onPress={() => Linking.openURL(`${webUrl}${path}`)} right={<ChevronRight size={18} color={c.muted} />}>
          <RowTitle>{label}</RowTitle>
        </ListRow>
      ))}
    </ListCard>
  );
}
