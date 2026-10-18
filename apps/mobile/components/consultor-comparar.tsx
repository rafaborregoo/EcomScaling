import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight, TriangleAlert } from "lucide-react-native";
import { compareRows, type ProfitClientRow, type ProfitTier } from "@e-nora/contracts";
import { useApi } from "../lib/use-api";
import { CAUTION, c, fmtCurrency, font, GOOD } from "../lib/theme";
import { TopBar } from "./inicio";
import { Delta, Screen, Status, SubNav } from "./ui";

// /v1/consultant/profitability (apps/api/src/consultant-profitability.ts): la rentabilidad de cada cliente, ya
// calculada en SQL y sumada por la API; aquí solo se ordena y se pinta. Es la misma lectura del panel de la web.
type Profit = { clients: ProfitClientRow[]; failed_stores: Array<{ store_id: string }>; truncated: boolean };

const TIER: Record<ProfitTier, { label: string; color: string }> = {
  pierde: { label: "Pierde dinero", color: c.danger },
  datos: { label: "Faltan datos", color: c.muted },
  bajo: { label: "Margen bajo", color: CAUTION },
  ok: { label: "Rentable", color: GOOD },
};

const money = (v: number | null, cur: string | null, d = 0) => (v == null || !cur ? "—" : fmtCurrency(v, cur, d));
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);
const worstFirst = (key: (r: ProfitClientRow) => number | null, desc = false) => (a: ProfitClientRow, b: ProfitClientRow) => {
  const x = key(a);
  const y = key(b);
  if (x === null || y === null) return Number(x === null) - Number(y === null);
  return desc ? y - x : x - y;
};

// Cada vista ordena por lo peor primero, que es lo que el consultor viene a buscar. Los importes no se ordenan entre
// clientes (monedas distintas): solo ratios.
const VIEWS = {
  beneficio: { label: "Beneficio", sort: compareRows },
  margen: { label: "Margen", sort: worstFirst((r) => r.margin_pct) },
  ventas: { label: "Ventas", sort: worstFirst((r) => r.revenue_change_pct) },
  cac: { label: "CAC", sort: worstFirst((r) => (r.cac != null && r.cac_target ? r.cac / r.cac_target : null), true) },
} as const;
type ViewKey = keyof typeof VIEWS;

/** El número grande de cada fila depende de la vista elegida; lo demás es contexto en una línea. */
function Figure({ r, view }: { r: ProfitClientRow; view: ViewKey }) {
  const big = { fontSize: 17, fontFamily: font.semibold, color: c.ink } as const;
  if (view === "margen") return <Text style={{ ...big, color: r.margin_target != null && r.margin_pct != null && r.margin_pct < r.margin_target ? CAUTION : c.ink }}>{pct(r.margin_pct)}</Text>;
  if (view === "ventas") return <Delta value={r.revenue_change_pct} size={17} />;
  if (view === "cac") return <Text style={{ ...big, color: r.cac != null && r.cac_target != null && r.cac > r.cac_target ? c.danger : c.ink }}>{money(r.cac, r.currency_code, 2)}</Text>;
  return <Text style={{ ...big, color: r.net_profit != null && r.net_profit < 0 ? c.danger : c.ink }}>{`${r.tier === "datos" && r.net_profit != null ? "≈ " : ""}${money(r.net_profit, r.currency_code)}`}</Text>;
}

/** Comparativa de la cartera: qué clientes pierden dinero, cuáles tienen el margen bajo o el CAC disparado. */
export function Comparar({ onPick }: { onPick: (client: { id: string; name: string }) => void }) {
  const [days, setDays] = useState(30);
  const [view, setView] = useState<ViewKey>("beneficio");
  const { data, error, reload, retry } = useApi<Profit>(`/v1/consultant/profitability?days=${days}`);
  const rows = data ? [...data.clients].sort(VIEWS[view].sort) : [];

  return (
    <Screen flat title="Rentabilidad" onRefresh={reload}>
      <TopBar name="" options={[7, 30, 90]} days={days} onChange={setDays} />
      <SubNav items={(Object.keys(VIEWS) as ViewKey[]).map((key) => ({ key, label: VIEWS[key].label }))} value={view} onChange={setView} />
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <View>
          {rows.map((r, i) => {
            const t = TIER[r.tier];
            const blocking = r.flags.find((f) => f.blocking);
            return (
              <Pressable key={r.organization_id} onPress={() => onPick({ id: r.organization_id, name: r.name })} accessibilityRole="button" accessibilityLabel={`${r.name}, ${t.label}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{r.name}</Text>
                  {blocking ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <TriangleAlert size={13} color={c.muted} />
                      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontFamily: font.regular, color: c.muted }}>{blocking.label}</Text>
                    </View>
                  ) : (
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: r.tier === "pierde" ? c.danger : c.muted }}>{`${t.label} · ${pct(r.margin_pct)}${r.margin_target != null ? ` de ${pct(r.margin_target)}` : ""}`}</Text>
                  )}
                </View>
                <Figure r={r} view={view} />
                <ChevronRight size={18} color={c.muted} />
              </Pressable>
            );
          })}
          {rows.length === 0 && <Text style={{ paddingVertical: 16, fontSize: 14, fontFamily: font.regular, color: c.muted }}>Sin clientes con tienda conectada.</Text>}
          {(data.failed_stores.length > 0 || data.truncated) && (
            <Text style={{ paddingTop: 12, fontSize: 13, fontFamily: font.regular, color: c.muted }}>{data.truncated ? "Mostrando solo las primeras 150 tiendas." : `${data.failed_stores.length} tienda${data.failed_stores.length > 1 ? "s" : ""} sin leer.`}</Text>
          )}
        </View>
      )}
    </Screen>
  );
}
