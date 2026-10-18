import { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartColumn, House, Megaphone, Menu, MessageSquare, Sparkles } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Bootstrap } from "../lib/api";
import { onPushOpened } from "../lib/push";
import { c, font } from "../lib/theme";
import { AskCopilot } from "./analista";
import { CopilotoModule } from "./copiloto";
import { DashboardSelector, HeaderSelect, HomeContent, type DashTab } from "./dashboard";
import { MarketingModule } from "./marketing";
import { MensajesModule } from "./mensajes";
import { METRICAS_SECTIONS, MetricasModule, type MetricasSection } from "./metricas";
import { SettingsModal } from "./settings";
import { Note } from "./ui";
import type { Org } from "./views";

// Interfaz del CLIENTE (dueño de una tienda): su tienda, sus cifras, su consultor. Los 5 módulos del nav inferior
// pasaron por el juez de alcance (ver README). El consultor y el administrador tienen su propia interfaz.
const MODULES = [
  { key: "inicio", label: "Inicio", Icon: House },
  { key: "metricas", label: "Métricas", Icon: ChartColumn },
  { key: "marketing", label: "Marketing", Icon: Megaphone },
  { key: "copiloto", label: "Copiloto", Icon: Sparkles },
  { key: "mensajes", label: "Mensajes", Icon: MessageSquare },
] as const satisfies ReadonlyArray<{ key: string; label: string; Icon: LucideIcon }>;
type ModuleKey = (typeof MODULES)[number]["key"];
const STORE_KEY = "activeConnectionByOrg";

export function ClientShell({ boot, onSignOut }: { boot: Bootstrap; onSignOut: () => void }) {
  const insets = useSafeAreaInsets();
  const membership = boot.memberships.find((x) => x.organization);
  const baseOrg: Org | null = membership?.organization ? { id: membership.organization_id, name: membership.organization.display_name, isConsultant: false } : null;
  // Tienda activa por cliente (vacío = todas); se recuerda entre sesiones.
  const [stores, setStores] = useState<Record<string, string>>({});
  const [module, setModule] = useState<ModuleKey>("inicio");
  const [dashTab, setDashTab] = useState<DashTab>("todo");
  const [metricasTab, setMetricasTab] = useState<MetricasSection>("todo");
  const [settings, setSettings] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  // Pregunta que llega desde una métrica (A29 → "Preguntar al Copiloto"); se gasta al salir del Copiloto.
  const [copilotSeed, setCopilotSeed] = useState<string | null>(null);
  const askCopilot = (question: string) => {
    setCopilotSeed(question);
    setModule("copiloto");
  };
  const goTo = (key: ModuleKey) => {
    if (key !== "copiloto") setCopilotSeed(null);
    setModule(key);
  };

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((raw) => raw && setStores(JSON.parse(raw) as Record<string, string>)).catch(() => {});
    // Tocar un aviso lleva a donde se resuelve: los mensajes a Mensajes; alertas y tareas a «Para hoy» de Inicio.
    const stopPush = onPushOpened((kind) => {
      if (kind === "message") {
        setModule("mensajes");
        return;
      }
      setModule("inicio");
      setDashTab("todo");
    });
    // Con el teclado abierto el nav estorba: se esconde.
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      stopPush();
      show.remove();
      hide.remove();
    };
  }, []);

  const org = useMemo(() => (baseOrg ? { ...baseOrg, connectionId: stores[baseOrg.id] ?? "" } : null), [baseOrg?.id, baseOrg?.name, stores]);
  const pickStore = (connectionId: string) => {
    if (!baseOrg) return;
    const next = { ...stores, [baseOrg.id]: connectionId };
    setStores(next);
    SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next)).catch(() => {});
  };
  const headerHeight = insets.top + 52;
  const needsOrg = <View style={{ padding: 20 }}><Note text="Tu cuenta no tiene ninguna tienda asignada." /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ zIndex: 10, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.edge, backgroundColor: c.bg }}>
        {/* Sin logo: el título (o el selector de la vista) ocupa la izquierda. */}
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          {module === "inicio" ? (
            <DashboardSelector tab={dashTab} onChange={setDashTab} />
          ) : module === "metricas" ? (
            <HeaderSelect items={METRICAS_SECTIONS} value={metricasTab} onChange={setMetricasTab} />
          ) : (
            <Text style={{ fontSize: 18, fontFamily: font.semibold, color: c.ink }}>{MODULES.find((m) => m.key === module)!.label}</Text>
          )}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Pressable onPress={() => setSettings(true)} hitSlop={12} accessibilityLabel="Configuración">
            <Menu size={24} color={c.ink} />
          </Pressable>
        </View>
      </View>

      <AskCopilot.Provider value={askCopilot}>
        <View style={{ flex: 1 }}>
          {module === "inicio" && (
            <HomeContent
              tab={dashTab}
              org={org}
              nav={{
                onTab: setDashTab,
                onMetrics: (section) => {
                  setMetricasTab(section);
                  setModule("metricas");
                },
              }}
            />
          )}
          {module === "metricas" && (org ? <MetricasModule org={org} section={metricasTab} /> : needsOrg)}
          {module === "marketing" && (org ? <MarketingModule org={org} /> : needsOrg)}
          {module === "copiloto" && <CopilotoModule org={org} offset={headerHeight} seed={copilotSeed} />}
          {module === "mensajes" && <MensajesModule isConsultant={false} offset={headerHeight} />}
        </View>
      </AskCopilot.Provider>

      {!keyboard && (
        <View style={{ flexDirection: "row", paddingTop: 8, paddingBottom: insets.bottom + 6, borderTopWidth: 1, borderTopColor: c.edge, backgroundColor: c.bg }}>
          {MODULES.map(({ key, label, Icon }) => {
            const on = key === module;
            return (
              <Pressable key={key} onPress={() => goTo(key)} style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Icon size={22} color={on ? c.accent : c.muted} strokeWidth={on ? 2.4 : 1.9} />
                <Text style={{ fontSize: 11, fontFamily: on ? font.semibold : font.regular, color: on ? c.accent : c.muted }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <SettingsModal visible={settings} onClose={() => setSettings(false)} boot={boot} org={org} isConsultant={false} onSignOut={onSignOut} onStore={pickStore} />
    </View>
  );
}
