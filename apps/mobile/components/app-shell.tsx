import { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Image, Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartColumn, House, Megaphone, Menu, MessageSquare, Sparkles } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { apiGet, type Bootstrap } from "../lib/api";
import { clearApiCache } from "../lib/use-api";
import { registerForPush, unregisterPush } from "../lib/push";
import { c, font } from "../lib/theme";
import { CopilotoModule } from "./copiloto";
import { DashboardSelector, HeaderSelect, HomeContent, type DashTab } from "./dashboard";
import { MarketingModule } from "./marketing";
import { MensajesModule } from "./mensajes";
import { METRICAS_SECTIONS, MetricasModule, type MetricasSection } from "./metricas";
import { SettingsModal } from "./settings";
import { Note } from "./ui";
import type { Org } from "./views";

// Los 5 módulos del nav inferior. Cada uno pasó por el juez de alcance (ver README).
const MODULES = [
  { key: "inicio", label: "Inicio", Icon: House },
  { key: "metricas", label: "Métricas", Icon: ChartColumn },
  { key: "marketing", label: "Marketing", Icon: Megaphone },
  { key: "copiloto", label: "Copiloto", Icon: Sparkles },
  { key: "mensajes", label: "Mensajes", Icon: MessageSquare },
] as const satisfies ReadonlyArray<{ key: string; label: string; Icon: LucideIcon }>;
type ModuleKey = (typeof MODULES)[number]["key"];
const STORE_KEY = "activeConnectionByOrg";

export function AppShell() {
  const insets = useSafeAreaInsets();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [baseOrg, setOrg] = useState<Org | null>(null);
  // Tienda activa por cliente (vacío = todas); se recuerda entre sesiones.
  const [stores, setStores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [module, setModule] = useState<ModuleKey>("inicio");
  const [dashTab, setDashTab] = useState<DashTab>("todo");
  const [metricasTab, setMetricasTab] = useState<MetricasSection>("todo");
  const [settings, setSettings] = useState(false);
  const [keyboard, setKeyboard] = useState(false);

  const isConsultant = boot ? ["platform_admin", "consultant"].includes(boot.profile.platform_role) : false;

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((raw) => raw && setStores(JSON.parse(raw) as Record<string, string>)).catch(() => {});
    registerForPush();
    apiGet<Bootstrap>("/v1/bootstrap").then(
      (b) => {
        setBoot(b);
        if (["platform_admin", "consultant"].includes(b.profile.platform_role)) {
          setDashTab("cartera");
          return;
        }
        const m = b.memberships.find((x) => x.organization);
        if (m?.organization) setOrg({ id: m.organization_id, name: m.organization.display_name, isConsultant: false });
      },
      (e: Error) => setError(e.message),
    );
    // Con el teclado abierto el nav estorba: se esconde.
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const org = useMemo(() => (baseOrg ? { ...baseOrg, connectionId: stores[baseOrg.id] ?? "" } : null), [baseOrg, stores]);
  const pickStore = (connectionId: string) => {
    if (!baseOrg) return;
    const next = { ...stores, [baseOrg.id]: connectionId };
    setStores(next);
    SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next)).catch(() => {});
  };
  const headerHeight = insets.top + 52;
  const signOut = async () => {
    await unregisterPush();
    clearApiCache();
    await supabase.auth.signOut();
  };
  const needsOrg = <View style={{ padding: 20 }}><Note text={error ?? (isConsultant ? "Elige un cliente en Inicio, en Cartera." : "Tu cuenta no tiene ninguna tienda asignada.")} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ zIndex: 10, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.edge, backgroundColor: c.bg }}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Image source={require("../assets/logo-letras.png")} style={{ width: 84, height: 23 }} resizeMode="contain" accessibilityLabel="E-NORA" />
        </View>
        {module === "inicio" ? (
          <DashboardSelector tab={dashTab} onChange={setDashTab} isConsultant={isConsultant} />
        ) : module === "metricas" ? (
          <HeaderSelect items={METRICAS_SECTIONS} value={metricasTab} onChange={setMetricasTab} />
        ) : (
          <Text style={{ fontSize: 16, fontFamily: font.semibold, color: c.ink }}>{MODULES.find((m) => m.key === module)!.label}</Text>
        )}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Pressable onPress={() => setSettings(true)} hitSlop={12} accessibilityLabel="Configuración">
            <Menu size={24} color={c.ink} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {module === "inicio" && (
          <HomeContent
            tab={dashTab}
            org={org}
            isConsultant={isConsultant}
            onPick={(client) => {
              setOrg({ ...client, isConsultant: true });
              setDashTab("todo");
            }}
          />
        )}
        {module === "metricas" && (org ? <MetricasModule org={org} section={metricasTab} /> : needsOrg)}
        {module === "marketing" && (org ? <MarketingModule org={org} /> : needsOrg)}
        {module === "copiloto" && <CopilotoModule org={org} offset={headerHeight} />}
        {module === "mensajes" && <MensajesModule isConsultant={isConsultant} offset={headerHeight} />}
      </View>

      {!keyboard && (
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
      )}

      <SettingsModal visible={settings} onClose={() => setSettings(false)} boot={boot} org={org} isConsultant={isConsultant} onSignOut={signOut} onStore={pickStore} />
    </View>
  );
}
