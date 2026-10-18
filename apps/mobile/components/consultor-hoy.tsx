import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { ProfitStoreRow, ProfitTier } from "@e-nora/contracts";
import { useApi } from "../lib/use-api";
import { CAUTION, c, font, GOOD } from "../lib/theme";
import { StoreSheet } from "./consultor-tienda";
import { TopBar } from "./inicio";
import { AllDone, Delta, ListRow, RowMeta, RowTitle, Screen, Status } from "./ui";

export type OpenTarget = "hoy" | "mensajes";

// /v1/consultant/profitability: la misma lectura que Clientes › Rentabilidad, ya calculada en SQL. `stores` trae una
// fila por tienda; aquí solo se ordena y se pinta.
type Profit = { stores: ProfitStoreRow[]; failed_stores: Array<{ store_id: string }>; truncated: boolean };

// Orden: lo que pide intervenir primero. Sin colores: la posición ya dice dónde mirar.
const TIER: Record<ProfitTier, string> = { pierde: "Pierde dinero", datos: "Faltan datos", bajo: "Margen bajo", ok: "Rentable" };
const RANK: Record<ProfitTier, number> = { pierde: 0, datos: 1, bajo: 2, ok: 3 };

// Color de la cifra de margen: dice el nivel de un vistazo sin añadir otra columna.
const TONE: Record<ProfitTier, string> = { pierde: c.danger, bajo: CAUTION, datos: c.muted, ok: GOOD };
// Cinco filas a la vista; a partir de ahí, la caja hace scroll por dentro.
const ROW = 68;
const VISIBLE = 5;

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);

/**
 * Hoy del consultor sin cliente elegido. Empieza por el ranking de salud de las tiendas de toda la cartera:
 * la peor arriba (pierde dinero, luego margen bajo), y dentro de cada nivel el margen más bajo primero.
 * Los importes no se comparan entre tiendas (monedas distintas): solo ratios.
 */
export function PortfolioToday({ onOpen }: { onOpen: (client: { id: string; name: string }, target: OpenTarget) => void }) {
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState<ProfitStoreRow | null>(null);
  const { data, error, reload, retry } = useApi<Profit>(`/v1/consultant/profitability?days=${days}`);
  const ranked = data ? [...data.stores].sort((a, b) => RANK[a.tier] - RANK[b.tier] || a.margin_pct - b.margin_pct) : [];

  return (
    <Screen flat title="Hoy" onRefresh={reload}>
      <TopBar name="" options={[7, 30, 90]} days={days} onChange={setDays} />
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <>
        <View style={{ borderWidth: 1, borderColor: c.edge, borderRadius: 16, overflow: "hidden", maxHeight: ROW * VISIBLE }}>
         <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={ranked.length > VISIBLE}>
          {ranked.map((s, i) => (
            <ListRow
              key={s.store_id}
              first={i === 0}
              onPress={() => setOpen(s)}
              right={
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ fontSize: 17, fontFamily: font.semibold, color: TONE[s.tier] }}>{pct(s.margin_pct)}</Text>
                  <Delta value={s.revenue_change_pct} />
                </View>
              }
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Text style={{ width: 20, fontSize: 15, fontFamily: font.medium, color: c.muted }}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <RowTitle>{s.shop_name}</RowTitle>
                  <RowMeta>{`${s.organization_name} · ${TIER[s.tier]}`}</RowMeta>
                </View>
              </View>
            </ListRow>
          ))}
          {ranked.length === 0 && <View style={{ padding: 16 }}><AllDone text="Sin tiendas conectadas" /></View>}
         </ScrollView>
        </View>
          {(data.failed_stores.length > 0 || data.truncated) && (
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{data.truncated ? "Mostrando solo las primeras 150 tiendas." : `${data.failed_stores.length} tienda${data.failed_stores.length > 1 ? "s" : ""} sin leer.`}</Text>
          )}
        </>
      )}
      {open && <StoreSheet store={open} days={days} onClose={() => setOpen(null)} onOpenClient={() => { onOpen({ id: open.organization_id, name: open.organization_name }, "hoy"); setOpen(null); }} />}
    </Screen>
  );
}
