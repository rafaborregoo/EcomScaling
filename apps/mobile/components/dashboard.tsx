import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { c, font } from "../lib/theme";
import { Cartera } from "./cartera";
import { Note } from "./ui";
import { KlaviyoView, MetaView, ShopifyView, TodoView, type HomeNav, type Org } from "./views";

// Mismas cuatro vistas que las pestañas del Dashboard de la web (todo, shopify, meta, klaviyo); el consultor suma Cartera.
const TABS = [
  { key: "cartera", label: "Cartera" },
  { key: "todo", label: "Todo" },
  { key: "shopify", label: "Shopify" },
  { key: "meta", label: "Meta" },
  { key: "klaviyo", label: "Klaviyo" },
] as const;
export type DashTab = (typeof TABS)[number]["key"];

export const DashboardSelector = ({ tab, onChange, isConsultant }: { tab: DashTab; onChange: (tab: DashTab) => void; isConsultant: boolean }) => (
  <HeaderSelect items={TABS.filter((t) => isConsultant || t.key !== "cartera")} value={tab} onChange={onChange} />
);

/** Selector del centro de la cabecera: el nombre de la vista con un chevron y una lista al tocarlo. Lo usan Inicio y Métricas. */
export function HeaderSelect<K extends string>({ items: tabs, value: tab, onChange }: { items: ReadonlyArray<{ key: K; label: string }>; value: K; onChange: (key: K) => void }) {
  const [open, setOpen] = useState(false);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  return (
    <View style={{ alignItems: "center", zIndex: 20 }}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 16, fontFamily: font.semibold, color: c.ink }}>{current.label}</Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={18} color={c.ink} strokeWidth={2.25} />
        </View>
      </Pressable>
      {open && (
        <View style={{ position: "absolute", top: 36, width: 170, borderRadius: 14, backgroundColor: c.bg, paddingVertical: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                onChange(t.key);
                setOpen(false);
              }}
              style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <Text style={{ fontSize: 15, fontFamily: t.key === tab ? font.semibold : font.regular, color: t.key === tab ? c.accent : c.ink }}>{t.label}</Text>
              {t.key === tab && <Check size={16} color={c.accent} strokeWidth={2.5} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Contenido de Inicio. El consultor sin cliente elegido ve la cartera, sea cual sea la vista. */
export function HomeContent({ tab, org, isConsultant, onPick, nav }: { tab: DashTab; org: Org | null; isConsultant: boolean; onPick: (org: { id: string; name: string }) => void; nav: HomeNav }) {
  if (isConsultant && (tab === "cartera" || !org)) return <Cartera onSelect={onPick} />;
  if (!org) return <View style={{ padding: 20 }}><Note text="Tu cuenta no tiene ninguna tienda asignada." /></View>;
  return tab === "shopify" ? <ShopifyView org={org} nav={nav} /> : tab === "meta" ? <MetaView org={org} nav={nav} /> : tab === "klaviyo" ? <KlaviyoView org={org} nav={nav} /> : <TodoView org={org} nav={nav} />;
}
