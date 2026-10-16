import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useApi } from "../lib/use-api";
import { c, fmtNum, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { Status, SummaryRow } from "./ui";

export type StockSummary = { tracked_items: number; low_stock_items: number; out_of_stock_items: number };

// Subconjunto de /shopify/catalog/products (ver apps/web/src/app/shopify/catalog-types.ts).
type Product = {
  id: string;
  title: string;
  primary_image_url: string | null;
  metrics?: { stock_available: number | null; variants_total: number; variants_out: number; variants_low: number } | null;
};
type Catalog = { total: number; products: Product[] };

// Lectura del agente de stock (solo lectura, se muestra sola como en la web).
type Finding = { title: string; evidence: string };
type StockDiagnostic = {
  output?: {
    headline?: string;
    answer?: string;
    findings?: Finding[];
    recommendations?: Array<{ action: string }>;
    proposed_writes?: Array<{ title: string; related_product_id?: string | null }>;
  };
} | null;

const MAX_FINDINGS = 4;

function Thumb({ uri }: { uri: string | null }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: c.surface }} />
  ) : (
    <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.edge }} />
  );
}

function ProductRow({ p, kind }: { p: Product; kind: "out" | "low" }) {
  const m = p.metrics;
  let detail = kind === "out" ? "Agotado" : "Stock bajo";
  if (m) {
    if (kind === "out") detail = m.variants_total > 1 ? `${m.variants_out} de ${m.variants_total} variantes agotadas` : "Agotado";
    else detail = `${m.variants_low > 1 ? `${m.variants_low} variantes con stock bajo` : "Stock bajo"}${m.stock_available != null ? ` · quedan ${fmtNum(m.stock_available)} uds` : ""}`;
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
      <Thumb uri={p.primary_image_url} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{p.title}</Text>
        <Text style={{ fontSize: 13, fontFamily: font.regular, color: kind === "out" ? c.danger : c.warning }}>{detail}</Text>
      </View>
    </View>
  );
}

function Group({ title, kind, data }: { title: string; kind: "out" | "low"; data: Catalog }) {
  if (data.total === 0) return null;
  return (
    <View>
      <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{title} · {data.total}</Text>
      {data.products.map((p) => (
        <ProductRow key={p.id} p={p} kind={kind} />
      ))}
      {data.total > data.products.length && (
        <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>y {data.total - data.products.length} más en la web</Text>
      )}
    </View>
  );
}

export function StockAlert({ orgId, stock }: { orgId: string; stock: StockSummary }) {
  const [open, setOpen] = useState(false);
  const base = `/v1/organizations/${orgId}`;
  const out = useApi<Catalog>(open ? `${base}/shopify/catalog/products?filter=out&sort=stock` : null);
  const low = useApi<Catalog>(open ? `${base}/shopify/catalog/products?filter=low&sort=stock` : null);
  const ai = useApi<StockDiagnostic>(open ? `${base}/ai/stock-planner?days=30` : null);
  const { out_of_stock_items: nOut, low_stock_items: nLow } = stock;
  if (nOut + nLow === 0) return null;

  const names = new Map([...(out.data?.products ?? []), ...(low.data?.products ?? [])].map((p) => [p.id, p.title]));
  const o = ai.data?.output;
  const summary = o?.headline ?? o?.answer;
  const findings = (o?.findings ?? []).slice(0, MAX_FINDINGS);
  const actions = (o?.proposed_writes ?? []).filter((w) => w.related_product_id && names.has(w.related_product_id)).slice(0, 3);
  const recs = (o?.recommendations ?? []).slice(0, 3);
  const line = { fontSize: 14, lineHeight: 21, fontFamily: font.regular, color: c.ink } as const;

  return (
    <>
      <SummaryRow title="Stock en riesgo" summary={`${nOut} agotados · ${nLow} bajos`} color={c.warning} dot={c.warning} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Stock en riesgo">
        <Status error={out.error ?? low.error} loading={!out.data || !low.data} retry={() => { out.retry(); low.retry(); }} />
        {out.data && <Group title="Agotados" kind="out" data={out.data} />}
        {low.data && <Group title="Stock bajo" kind="low" data={low.data} />}

        {summary ? (
          <View style={{ borderRadius: 12, padding: 14, backgroundColor: c.accentTint, gap: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.accent }}>Análisis del agente de stock</Text>
            <Text style={line}>{summary}</Text>
            {findings.map((f) => (
              <Text key={f.title} style={line}>
                <Text style={{ fontFamily: font.semibold }}>{f.title}. </Text>
                {f.evidence}
              </Text>
            ))}
            {actions.map((w) => (
              <Text key={w.title} style={line}>
                • <Text style={{ fontFamily: font.semibold }}>{names.get(w.related_product_id!)}: </Text>
                {w.title}
              </Text>
            ))}
            {actions.length === 0 && recs.map((r) => <Text key={r.action} style={line}>• {r.action}</Text>)}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
