import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { ProfitStoreRow } from "@e-nora/contracts";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, font } from "../lib/theme";
import { sortAlerts, type Alert } from "./alerts";
import { ChartCard } from "./chart";
import { HomeContent, type DashTab } from "./dashboard";
import type { StockForecast } from "./stock";
import { MetricList, RowMeta, RowTitle, SubNav } from "./ui";
import type { Org } from "./views";

// Ficha de una tienda desde Hoy: pantalla completa. Los cuatro primeros apartados son las MISMAS vistas que ve el
// cliente (Todo, Shopify, Meta, Klaviyo: gráficos, cifras, stock, campañas), así el consultor ve lo que ve él.
// Rentabilidad y Avisos son lo propio del consultor.
const SECTIONS = [
  { key: "todo", label: "Todo" },
  { key: "shopify", label: "Shopify" },
  { key: "meta", label: "Meta" },
  { key: "klaviyo", label: "Klaviyo" },
  { key: "stock", label: "Stock" },
  { key: "rentabilidad", label: "Rentabilidad" },
  { key: "avisos", label: "Avisos" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);

export function StoreSheet({ store: s, days, onClose, onOpenClient }: { store: ProfitStoreRow; days: number; onClose: () => void; onOpenClient: () => void }) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("todo");
  const org: Org = useMemo(() => ({ id: s.organization_id, name: s.organization_name, isConsultant: true, connectionId: s.connection_id ?? "" }), [s]);
  // Dentro de la ficha, «ver más» de una vista solo cambia de apartado.
  const nav = { onTab: (tab: DashTab) => setSection(tab), onMetrics: (tab: DashTab) => setSection(tab) };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === "ios" ? 16 : Math.max(insets.top, 12) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 20, fontFamily: font.semibold, color: c.ink }}>{s.shop_name}</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{`${s.organization_name} · últimos ${days} días`}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
            <X size={24} color={c.ink} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <SubNav items={[...SECTIONS]} value={section} onChange={setSection} />
          </ScrollView>
        </View>

        <View style={{ flex: 1 }}>
          {(section === "todo" || section === "shopify" || section === "meta" || section === "klaviyo") && <HomeContent tab={section} org={org} nav={nav} />}
          {section === "stock" && <Stock s={s} />}
          {section === "rentabilidad" && <Rentabilidad s={s} days={days} />}
          {section === "avisos" && <Avisos s={s} />}
        </View>

        <Pressable onPress={onOpenClient} accessibilityRole="button" style={{ marginHorizontal: 20, marginBottom: Math.max(insets.bottom, 12), alignItems: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: c.accent }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>{`Abrir ${s.organization_name}`}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const body = { padding: 20, gap: 28, paddingBottom: 32 } as const;

/** Lo que el motor de rentabilidad sabe de la tienda: cifras, ventas por día, desglose por pedido y CAC. */
function Rentabilidad({ s, days }: { s: ProfitStoreRow; days: number }) {
  const cur = s.currency_code;
  const money = (v: number | null | undefined, d = 0) => (v == null || !cur ? "—" : fmtCurrency(v, cur, d));
  const end = new Date();
  const points = s.daily.map((y, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (s.daily.length - 1 - i));
    return { label: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), y };
  });
  const belowTarget = s.margin_target != null && s.margin_pct < s.margin_target;
  const cacOver = s.cac != null && s.cac_target != null && s.cac > s.cac_target;
  return (
    <ScrollView contentContainerStyle={body}>
      <MetricList
        rows={[
          { label: "Ventas", value: money(s.revenue), delta: s.revenue_change_pct },
          { label: "Beneficio neto", value: money(s.net_profit), delta: s.profit_change_pct, tone: s.net_profit < 0 ? "bad" : undefined, hint: s.net_profit < 0 ? "Pierde dinero" : undefined },
          { label: "Margen neto", value: pct(s.margin_pct), tone: belowTarget ? "warn" : undefined, hint: s.margin_target != null ? `Objetivo ${pct(s.margin_target)}` : undefined },
          { label: "Pedidos", value: s.orders.toLocaleString("es-ES") },
        ]}
      />
      {points.length > 1 && <ChartCard title={`Ventas por día · ${days} d`} tab={{ key: "daily", label: "Ventas por día", series: [{ name: "Ventas", color: "accent", points }], format: (v) => money(v), summary: money(s.daily.reduce((a, b) => a + b, 0)) }} />}
      <MetricList
        title="Cada pedido, de media"
        rows={[
          { label: "Ticket sin IVA", value: money(s.per_order.aov_ex_tax, 2) },
          { label: "Coste de producto", value: money(-s.per_order.cogs, 2) },
          { label: "Envío", value: money(-s.per_order.shipping, 2) },
          { label: "Comisiones", value: money(-s.per_order.fees, 2) },
          { label: "Publicidad", value: money(-s.per_order.ads, 2) },
          { label: "Gastos fijos", value: money(-s.per_order.fixed, 2) },
          { label: "Beneficio", value: money(s.per_order.profit, 2), tone: s.per_order.profit < 0 ? "bad" : undefined },
        ]}
      />
      <MetricList
        title="Captación"
        rows={[
          { label: "Inversión en anuncios", value: money(s.ads_spend) },
          { label: "Clientes nuevos", value: s.new_customers.toLocaleString("es-ES") },
          { label: "CAC", value: money(s.cac, 2), tone: cacOver ? "bad" : undefined, hint: s.cac_target != null ? `Objetivo ${money(s.cac_target, 2)}` : undefined },
          { label: "CAC de equilibrio", value: money(s.per_order.breakeven_cac, 2) },
        ]}
      />
    </ScrollView>
  );
}

/** Lo que hay que mirar: alertas de la tienda, datos que faltan, integraciones del cliente y palancas. */
function Avisos({ s }: { s: ProfitStoreRow }) {
  const base = `/v1/organizations/${s.organization_id}`;
  const ops = useApi<{ alerts: Array<Alert & { store_id?: string | null }> }>(`${base}/operations`);
  const integ = useApi<{ providers: Array<{ id: string; name: string; connection: { status: string; last_sync_at: string | null } | null }> }>(`${base}/integrations`);
  const alerts = sortAlerts(ops.data?.alerts ?? []).filter((a) => (a as { store_id?: string | null }).store_id === s.store_id);
  const money = (v: number) => (s.currency_code ? fmtCurrency(v, s.currency_code, 0) : "—");
  return (
    <ScrollView contentContainerStyle={body}>
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontFamily: font.semibold, color: c.ink }}>Alertas</Text>
        {!ops.data ? <RowMeta>{ops.error ?? "Cargando…"}</RowMeta> : alerts.length === 0 ? <RowMeta>Sin alertas activas en esta tienda.</RowMeta> : alerts.map((a) => (
          <View key={a.id} style={{ gap: 2 }}>
            <RowTitle>{a.title}</RowTitle>
            <RowMeta tone={a.severity === "critical" ? "bad" : a.severity === "high" ? "warn" : undefined}>{`${a.severity === "critical" ? "Crítica" : a.severity === "high" ? "Alta" : "Aviso"} · desde el ${new Date(a.first_detected_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}</RowMeta>
          </View>
        ))}
      </View>

      {s.flags.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 20, fontFamily: font.semibold, color: c.ink }}>Datos que faltan</Text>
          {s.flags.map((f) => (
            <View key={f.key} style={{ gap: 2 }}>
              <RowTitle>{f.label}</RowTitle>
              <RowMeta>{f.blocking ? "Invalida el beneficio hasta que se complete" : "Solo matiza el beneficio"}</RowMeta>
            </View>
          ))}
        </View>
      )}

      {integ.data && (
        <MetricList
          title="Integraciones del cliente"
          rows={integ.data.providers.map((p) => {
            const st = p.connection?.status;
            const bad = st === "error" || st === "revoked";
            return { label: p.name, value: !p.connection ? "Sin conectar" : bad ? "Reconectar" : "Conectada", tone: bad ? ("bad" as const) : undefined, hint: p.connection?.last_sync_at ? `Última sincronización ${new Date(p.connection.last_sync_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : undefined };
          })}
        />
      )}

      {s.levers.length > 0 && <MetricList title="Palancas" rows={s.levers.map((l) => ({ label: l.palanca, value: `${money(l.eur_mes)}/mes`, hint: l.regla }))} />}
    </ScrollView>
  );
}

/** Control y prevención de stock de la tienda: lo agotado y lo que se agota en los próximos días, al ritmo de venta actual. */
function Stock({ s }: { s: ProfitStoreRow }) {
  const scope = s.connection_id ? `?connectionId=${encodeURIComponent(s.connection_id)}` : "";
  const { data, error } = useApi<StockForecast>(`/v1/organizations/${s.organization_id}/shopify/stock-forecast${scope}`);
  const per = (v: number) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(".", ","));
  return (
    <ScrollView contentContainerStyle={body}>
      {!data ? (
        <RowMeta>{error ?? "Cargando…"}</RowMeta>
      ) : data.items.length === 0 ? (
        <RowMeta>{`Nada se agota en los próximos ${data.horizon_days} días.`}</RowMeta>
      ) : (
        <>
          <MetricList
            rows={[
              { label: "Agotados", value: String(data.out), tone: data.out > 0 ? "bad" : undefined },
              { label: `Se agotan en ${data.horizon_days} días`, value: String(data.soon), tone: data.soon > 0 ? "warn" : undefined },
            ]}
          />
          <MetricList
            title="Productos"
            rows={[...data.items]
              .sort((a, b) => (a.status === b.status ? a.days_of_cover - b.days_of_cover : a.status === "out" ? -1 : 1))
              .map((i) => ({
                label: i.title,
                value: i.status === "out" ? "Agotado" : `${Math.max(1, Math.round(i.days_of_cover))} d`,
                tone: i.status === "out" ? ("bad" as const) : ("warn" as const),
                hint: `${per(i.daily_sales)} / día · ${i.available} uds`,
              }))}
          />
        </>
      )}
    </ScrollView>
  );
}
