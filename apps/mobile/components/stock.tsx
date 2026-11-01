import { useState } from "react";
import { Image, Text, View } from "react-native";
import { Hourglass, PackageX } from "lucide-react-native";
import { c, fmtNum, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { SummaryRow } from "./ui";

// /shopify/stock-forecast: solo productos activos que se venden con regularidad, con stock sincronizado, y que ya
// están agotados o se agotan en los próximos `horizon_days`. Lo repuesto o lo que no se vende no viene.
type Item = {
  product_id: string;
  store_name: string | null;
  title: string;
  image_url: string | null;
  available: number;
  daily_sales: number;
  days_of_cover: number;
  status: "out" | "soon";
  sku_list: string[];
  latest_inventory_sync_at: string;
  inventory_levels: Array<{
    variant_id: string;
    variant_title: string | null;
    sku: string | null;
    location_id: string;
    location_name: string | null;
    available_quantity: number | null;
    updated_at: string | null;
  }>;
};
export type StockForecast = {
  period_days: number;
  horizon_days: number;
  out: number;
  soon: number;
  items: Item[];
};

export const stockCount = (s: StockForecast | null | undefined) =>
  s ? s.out + s.soon : 0;

const daily = (v: number) =>
  v >= 10 ? fmtNum(Math.round(v)) : v.toFixed(1).replace(".", ",");
const readAge = (iso: string) => {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(iso)) / 3_600_000),
  );
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.floor(hours / 24)} d`;
};

function Thumb({ uri }: { uri: string | null }) {
  const box = {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: c.surface,
  } as const;
  return uri ? (
    <Image source={{ uri }} style={box} />
  ) : (
    <View style={[box, { borderWidth: 1, borderColor: c.edge }]} />
  );
}

// Izquierda: qué producto y a qué ritmo se vende. Derecha, en color: cuándo se acaba (o que ya se acabó).
function Row({ item }: { item: Item }) {
  const out = item.status === "out";
  const color = out ? c.danger : c.warning;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 6,
      }}
    >
      <Thumb uri={item.image_url} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}
        >
          {item.title}
        </Text>
        {item.store_name ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}
          >
            {item.store_name}
          </Text>
        ) : null}
        <Text
          style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}
        >
          {item.sku_list.slice(0, 2).join(", ") || "SKU sin dato"} · lectura{" "}
          {readAge(item.latest_inventory_sync_at)}
        </Text>
        {item.inventory_levels.slice(0, 3).map((level) => (
          <Text
            key={`${level.variant_id}:${level.location_id}`}
            numberOfLines={1}
            style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}
          >
            {level.variant_title || "Variante"} ·{" "}
            {level.location_name || "Ubicación sin dato"}:{" "}
            {level.available_quantity == null
              ? "sin lectura"
              : `${fmtNum(level.available_quantity)} uds`}
          </Text>
        ))}
        {item.inventory_levels.length > 3 ? (
          <Text
            style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}
          >
            y {item.inventory_levels.length - 3} niveles más
          </Text>
        ) : null}
        <Text
          style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}
        >
          {daily(item.daily_sales)} / día
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 17, fontFamily: font.semibold, color }}>
          {out ? "0" : `${Math.max(1, Math.round(item.days_of_cover))} d`}
        </Text>
        {!out && (
          <Text
            style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}
          >
            {fmtNum(item.available)} uds
          </Text>
        )}
      </View>
    </View>
  );
}

function Group({
  Icon,
  color,
  title,
  items,
}: {
  Icon: typeof PackageX;
  color: string;
  title: string;
  items: Item[];
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingBottom: 4,
        }}
      >
        <Icon size={16} color={color} />
        <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>
          {title}
        </Text>
        <Text style={{ fontSize: 15, fontFamily: font.semibold, color }}>
          {items.length}
        </Text>
      </View>
      {items.map((item) => (
        <Row key={item.product_id} item={item} />
      ))}
    </View>
  );
}

/** Fila «Stock» de Para hoy y su hoja. Sin nada que reponer no ocupa sitio. */
export function StockAlert({
  stock,
}: {
  stock: StockForecast | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!stock || stockCount(stock) === 0) return null;
  const parts = [
    stock.out && `${stock.out} agotado${stock.out > 1 ? "s" : ""}`,
    stock.soon && `${stock.soon} se agota${stock.soon > 1 ? "n" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <SummaryRow
        title="Reponer stock"
        summary={parts}
        color={stock.out ? c.danger : c.warning}
        dot={stock.out ? c.danger : c.warning}
        onPress={() => setOpen(true)}
      />

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Reponer stock"
        count={stockCount(stock)}
      >
        <Group
          Icon={PackageX}
          color={c.danger}
          title="Agotados"
          items={stock.items.filter((i) => i.status === "out")}
        />
        <Group
          Icon={Hourglass}
          color={c.warning}
          title={`Se agotan en ${stock.horizon_days} días`}
          items={stock.items.filter((i) => i.status === "soon")}
        />
        <Text
          style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}
        >
          Ritmo de venta de los últimos {stock.period_days} días.
        </Text>
      </Sheet>
    </>
  );
}
