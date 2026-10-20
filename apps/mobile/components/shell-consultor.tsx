import { useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Keyboard, PanResponder, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Briefcase, ChartColumn, House, Megaphone, Menu, MessageSquare, Users } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Bootstrap } from "../lib/api";
import { byUrgency, useWorkbench } from "../lib/cartera";
import { onPushOpened } from "../lib/push";
import { c, font } from "../lib/theme";
import { AskCopilot } from "./analista";
import { CopilotoModule } from "./copiloto";
import { ClientList } from "./consultor-clientes";
import { Comparar } from "./consultor-comparar";
import { ReviewQueue } from "./consultor-revision";
import { ReviewedButton, SinceReview } from "./marcar-revisado";
import { ConsultorTrabajo } from "./consultor-trabajo";
import { PortfolioToday } from "./consultor-hoy";
import type { OpenTarget } from "./consultor-hoy";
import { HomeContent, type DashTab } from "./dashboard";
import { MarketingModule } from "./marketing";
import { MensajesModule, WriteToClient } from "./mensajes";
import { METRICAS_SECTIONS, MetricasModule, type MetricasSection } from "./metricas";
import { ContextBar, type ClientRef } from "./selector-contexto";
import { NavPill } from "./nav-pill";
import { SettingsModal } from "./settings";
import { SubNav } from "./ui";
import type { Org } from "./views";

// Interfaz del CONSULTOR: trabaja sobre una cartera de clientes. Dos niveles: arriba, DÓNDE está (todos los clientes
// o un cliente y su tienda); abajo, QUÉ hace. Cambiar de cliente no cambia de pestaña: sigues en la misma pantalla
// con otro cliente. El canal (Todo, Shopify, Meta, Klaviyo) es un filtro dentro de la pantalla, no la navegación.
const MODULES = [
  { key: "hoy", label: "Hoy", Icon: House },
  { key: "clientes", label: "Clientes", Icon: Users },
  { key: "trabajo", label: "Trabajo", Icon: Briefcase },
  { key: "marketing", label: "Marketing", Icon: Megaphone },
  { key: "mensajes", label: "Mensajes", Icon: MessageSquare },
] as const satisfies ReadonlyArray<{ key: string; label: string; Icon: LucideIcon }>;
// El Copiloto vive dentro de la pestaña de chat (Mensajes): dos páginas, Clientes y Copiloto.
type ModuleKey = (typeof MODULES)[number]["key"] | "copiloto";

const CHANNELS = [
  { key: "todo", label: "Todo" },
  { key: "shopify", label: "Shopify" },
  { key: "meta", label: "Meta" },
  { key: "klaviyo", label: "Klaviyo" },
] as const satisfies ReadonlyArray<{ key: DashTab; label: string }>;

// Alto de la barra Clientes/Copiloto sobre el chat: el teclado empuja esa cantidad de más.
const CHAT_NAV = 44;
const STORE_KEY = "activeConnectionByOrg";
const RECENTS_KEY = "recentClients";
const MAX_RECENTS = 5;

export function ConsultantShell({ boot, onSignOut }: { boot: Bootstrap; onSignOut: () => void }) {
  const insets = useSafeAreaInsets();
  const [client, setClient] = useState<ClientRef | null>(null);
  // Tienda activa por cliente (vacío = todas) y últimos clientes abiertos; se recuerdan entre sesiones.
  const [stores, setStores] = useState<Record<string, string>>({});
  const [recents, setRecents] = useState<ClientRef[]>([]);
  const [module, setModule] = useState<ModuleKey>("hoy");
  const [channel, setChannel] = useState<DashTab>("todo");
  const [section, setSection] = useState<MetricasSection>("todo");
  const [cartera, setCartera] = useState<"estado" | "rentabilidad">("estado");
  const [reviewTick, setReviewTick] = useState(0);
  const [mkt, setMkt] = useState<"revisar" | "contenido">("revisar");
  const [settings, setSettings] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [copilotSeed, setCopilotSeed] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  // Aviso tocado: se abre el cliente al que pertenece en cuanto la cartera dice cómo se llama.
  const [pushed, setPushed] = useState<{ orgId: string; kind: string } | null>(null);
  const workbench = useWorkbench().data;
  const portfolio = workbench?.portfolio;

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((raw) => raw && setStores(JSON.parse(raw) as Record<string, string>)).catch(() => {});
    SecureStore.getItemAsync(RECENTS_KEY).then((raw) => raw && setRecents(JSON.parse(raw) as ClientRef[])).catch(() => {});
    // Un mensaje lleva a Mensajes; el resto de avisos, a la mesa de la cartera.
    const stopPush = onPushOpened((kind, organizationId) => {
      setClient(null);
      setModule(kind === "message" ? "mensajes" : "hoy");
      if (organizationId) setPushed({ orgId: organizationId, kind });
    });
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      stopPush();
      show.remove();
      hide.remove();
    };
  }, []);

  const org: Org | null = useMemo(() => (client ? { ...client, isConsultant: true, connectionId: stores[client.id] ?? "" } : null), [client, stores]);

  const remember = <T,>(key: string, value: T) => SecureStore.setItemAsync(key, JSON.stringify(value)).catch(() => {});
  /** Cambia de cliente (y de tienda) sin tocar la pestaña ni el canal: la pantalla es la misma, con otro cliente. */
  const pick = (next: ClientRef | null, connectionId?: string) => {
    setClient(next);
    setThread(null);
    if (!next) return;
    if (connectionId !== undefined) {
      const s = { ...stores, [next.id]: connectionId };
      setStores(s);
      remember(STORE_KEY, s);
    }
    const r = [next, ...recents.filter((x) => x.id !== next.id)].slice(0, MAX_RECENTS);
    setRecents(r);
    remember(RECENTS_KEY, r);
  };
  const open = (next: ClientRef, target: OpenTarget) => {
    pick(next);
    setThread(target === "mensajes" ? next.id : null);
    setModule(target === "mensajes" ? "mensajes" : "hoy");
  };
  /** Abre el chat del cliente, con un borrador si viene de algo concreto (una alerta). */
  const writeTo = (orgId: string, text?: string) => {
    setThread(orgId);
    setDraft(text ?? null);
    setModule("mensajes");
  };
  const goTo = (key: ModuleKey) => {
    setDraft(null);
    if (key !== "copiloto") setCopilotSeed(null);
    if (key !== "mensajes") setThread(null);
    setModule(key);
  };
  const askCopilot = (question: string) => {
    setCopilotSeed(question);
    setModule("copiloto");
  };
  useEffect(() => {
    if (!pushed || !portfolio) return;
    const target = portfolio.find((p) => p.organization_id === pushed.orgId);
    if (target) open({ id: target.organization_id, name: target.organization_name }, pushed.kind === "message" ? "mensajes" : "hoy");
    setPushed(null);
  }, [pushed, portfolio]);
  // Deslizar la cabecera a izquierda o derecha pasa al cliente siguiente o anterior de la cartera, por urgencia:
  // es como se repasa la cartera por la mañana. Solo con un cliente elegido; el cuerpo queda libre para gráficos.
  // «3/12» junto al nombre: dice que la cartera es una secuencia que se recorre deslizando.
  const ordered = useMemo(() => byUrgency(portfolio ?? []), [portfolio]);
  const at = client ? ordered.findIndex((p) => p.organization_id === client.id) : -1;
  const position = at >= 0 && ordered.length > 1 ? `${at + 1}/${ordered.length}` : null;
  const step = useRef<(dir: 1 | -1) => void>(() => {});
  step.current = (dir) => {
    if (!client || !portfolio?.length) return;
    const list = byUrgency(portfolio);
    const at = list.findIndex((p) => p.organization_id === client.id);
    const next = list[(at + dir + list.length) % list.length];
    if (!next || next.organization_id === client.id) return;
    Haptics.selectionAsync().catch(() => {});
    pick({ id: next.organization_id, name: next.organization_name });
  };
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 60) step.current(g.dx < 0 ? 1 : -1);
      },
    }),
  ).current;
  // Números en el nav: lo que espera en cada pestaña, de toda la cartera.
  const badges: Partial<Record<ModuleKey, number>> = workbench
    ? { hoy: workbench.summary.critical_alerts, mensajes: workbench.summary.unread_threads }
    : {};
  const headerHeight = insets.top + 52;
  // Pestañas que necesitan un cliente: sin él, se elige ahí mismo.
  const picker = (title: string) => <ClientList title={title} onPick={(next) => pick(next)} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View {...swipe.panHandlers} style={{ zIndex: 10, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: c.edge, backgroundColor: c.bg }}>
        <ContextBar org={org} recents={recents} onPick={pick} position={position} />
        <Pressable onPress={() => setSettings(true)} hitSlop={12} accessibilityLabel="Configuración">
          <Menu size={24} color={c.ink} />
        </Pressable>
      </View>

      <WriteToClient.Provider value={writeTo}>
      <AskCopilot.Provider value={askCopilot}>
        <View style={{ flex: 1 }}>
          {module === "hoy" &&
            (org ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16, paddingHorizontal: 20, paddingTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <SubNav items={[...CHANNELS]} value={channel} onChange={setChannel} />
                  </View>
                  <Pressable onPress={() => writeTo(org.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Escribir a ${org.name}`} style={{ paddingBottom: 6 }}>
                    <MessageSquare size={22} color={c.muted} strokeWidth={1.9} />
                  </Pressable>
                  <ReviewedButton orgId={org.id} onReviewed={() => setReviewTick((n) => n + 1)} />
                </View>
                <View style={{ paddingHorizontal: 20 }}>
                  {/* Se vuelve a montar al marcar revisado: lee la mesa ya actualizada en la caché. */}
                  <SinceReview key={reviewTick} orgId={org.id} />
                </View>
                <HomeContent
                  tab={channel}
                  org={org}
                  nav={{
                    onTab: (tab) => setChannel(tab),
                    onMetrics: (s) => {
                      setSection(s);
                      setModule("clientes");
                    },
                  }}
                />
              </>
            ) : (
              <PortfolioToday onOpen={open} />
            ))}
          {module === "clientes" &&
            (org ? (
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                  <SubNav items={[...METRICAS_SECTIONS]} value={section} onChange={setSection} />
                </View>
                <MetricasModule org={org} section={section} />
              </>
            ) : (
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                  <SubNav
                    items={[
                      { key: "estado", label: "Estado" },
                      { key: "rentabilidad", label: "Rentabilidad" },
                    ]}
                    value={cartera}
                    onChange={setCartera}
                  />
                </View>
                {cartera === "estado" ? picker("Clientes") : <Comparar onPick={(next) => pick(next)} />}
              </>
            ))}
          {module === "trabajo" && <ConsultorTrabajo org={org} onOpen={open} />}
          {module === "marketing" &&
            (org ? (
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                  <SubNav
                    items={[
                      { key: "revisar", label: "Revisar" },
                      { key: "contenido", label: "Contenido" },
                    ]}
                    value={mkt}
                    onChange={setMkt}
                  />
                </View>
                {mkt === "revisar" ? <ReviewQueue org={org} /> : <MarketingModule org={org} />}
              </>
            ) : (
              <ReviewQueue org={null} />
            ))}
          {(module === "mensajes" || module === "copiloto") && (
            <>
              <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                <SubNav
                  items={[
                    { key: "mensajes", label: "Clientes" },
                    { key: "copiloto", label: "Copiloto" },
                  ]}
                  value={module}
                  onChange={(key) => goTo(key)}
                />
              </View>
              {module === "copiloto" ? (
                org ? <CopilotoModule org={org} offset={headerHeight + CHAT_NAV} seed={copilotSeed} /> : picker("Copiloto")
              ) : (
                <MensajesModule key={`${thread ?? org?.id ?? "todos"}:${draft ?? ""}`} isConsultant offset={headerHeight + CHAT_NAV} openOrg={thread ?? org?.id ?? null} draft={draft} />
              )}
            </>
          )}
        </View>
      </AskCopilot.Provider>
      </WriteToClient.Provider>

      {!keyboard && (
        <NavPill
          active={module === "copiloto" ? "mensajes" : module}
          onPress={(k) => goTo(k as ModuleKey)}
          items={MODULES.map((m) => ({
            key: m.key,
            // Con un cliente abierto, «Clientes» es su ficha de métricas: la pestaña lo dice.
            ...(m.key === "clientes" && org ? { label: "Métricas", Icon: ChartColumn } : { label: m.label, Icon: m.Icon }),
            badge: badges[m.key],
            danger: m.key === "hoy",
          }))}
        />
      )}

      <SettingsModal visible={settings} onClose={() => setSettings(false)} boot={boot} org={org} isConsultant onSignOut={onSignOut} onStore={(id) => org && pick(client, id)} />
    </View>
  );
}
