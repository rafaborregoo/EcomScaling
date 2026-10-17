import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font, klaviyo } from "../lib/theme";
import { Sheet } from "./sheet";
import { BigNumber, ListRow, MetricList, Section } from "./ui";
import { withStore, type Org } from "./views";

// Campañas ya enviadas de Klaviyo con su resultado. Mismo contrato que KCampaign en
// apps/web/src/app/marketing/klaviyo-workspace.ts; cifras = las que Klaviyo se atribuye en el periodo.
type Stats = { revenue: number; conversions: number; recipients: number; delivered: number; opens_unique: number; clicks_unique: number; unsubscribes: number };
type Audience = { name: string };
type Campaign = {
  id: string;
  external_id: string;
  name: string;
  status: string | null;
  send_time: string | null;
  subject: string | null;
  preview_text: string | null;
  from_email: string | null;
  from_label: string | null;
  audiences: { included: Audience[]; excluded: Audience[] } | null;
  stats: Stats | null;
};

const eur = (v: number, d = 0) => fmtCurrency(v, "EUR", d);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (r: number | null, d = 1) => (r == null ? "—" : `${(r * 100).toFixed(d).replace(".", ",")} %`);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha");
const isSent = (status: string | null) => (status ?? "").toLowerCase().includes("sent");

const SORTS = [
  { key: "revenue", label: "Ingresos", value: (s: Stats) => s.revenue, show: (s: Stats) => eur(s.revenue), caption: "atribuidos" },
  { key: "clicks", label: "Clics", value: (s: Stats) => ratio(s.clicks_unique, s.delivered) ?? 0, show: (s: Stats) => pct(ratio(s.clicks_unique, s.delivered), 2), caption: "de clics" },
  { key: "opens", label: "Aperturas", value: (s: Stats) => ratio(s.opens_unique, s.delivered) ?? 0, show: (s: Stats) => pct(ratio(s.opens_unique, s.delivered)), caption: "de aperturas" },
  { key: "recent", label: "Recientes", value: () => 0, show: (s: Stats) => eur(s.revenue), caption: "atribuidos" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const PAGE = 5;

/** Todas las campañas enviadas del periodo: ordenables por éxito, con «Ver más» y ficha completa al tocar. */
export function SentCampaigns({ org, days }: { org: Org; days: number }) {
  const { data } = useApi<{ campaigns?: Campaign[] }>(withStore(org, `/v1/organizations/${org.id}/marketing/klaviyo?days=${days}`));
  const [sort, setSort] = useState<SortKey>("revenue");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Campaign | null>(null);

  const sent = (data?.campaigns ?? []).filter((x) => isSent(x.status));
  const by = SORTS.find((s) => s.key === sort)!;
  const list = [...sent].sort((a, b) =>
    sort === "recent" ? (b.send_time ?? "").localeCompare(a.send_time ?? "") : (b.stats ? by.value(b.stats) : -1) - (a.stats ? by.value(a.stats) : -1),
  );
  if (!data || sent.length === 0) return null;

  return (
    <>
      <Section flat title="Campañas enviadas" count={sent.length} hint="Ordenadas por lo que más han funcionado. Toca una para ver su ficha completa.">
        <View style={{ flexDirection: "row", gap: 18, paddingBottom: 4 }}>
          {SORTS.map((s) => {
            const on = s.key === sort;
            return (
              <Pressable key={s.key} onPress={() => { setSort(s.key); setShown(PAGE); }} hitSlop={6} style={{ paddingBottom: 3, borderBottomWidth: 2, borderBottomColor: on ? klaviyo.mint : "transparent" }}>
                <Text style={{ fontSize: 14, fontFamily: on ? font.semibold : font.regular, color: on ? c.ink : c.muted }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {list.slice(0, shown).map((x, i) => (
          <ListRow flat key={x.id} first={i === 0} onPress={() => setSelected(x)} right={<ChevronRight size={18} color={c.muted} />}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={{ fontSize: 16, fontFamily: font.medium, color: c.ink }}>{x.name}</Text>
                <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{`${day(x.send_time)}${x.subject ? ` · ${x.subject}` : ""}`}</Text>
              </View>
              {x.stats ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 17, fontFamily: font.semibold, color: klaviyo.mint }}>{by.show(x.stats)}</Text>
                  <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{by.caption}</Text>
                </View>
              ) : null}
            </View>
          </ListRow>
        ))}
        {shown < list.length && (
          <Pressable onPress={() => setShown((n) => n + 10)} style={{ paddingVertical: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: c.edge }}>
            <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{`Ver más · ${list.length - shown} restantes`}</Text>
          </Pressable>
        )}
      </Section>
      {selected && <CampaignCard org={org} camp={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

const names = (xs: Audience[] | undefined) => (xs?.length ? xs.map((a) => a.name).join(", ") : null);

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 12, fontFamily: font.semibold, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.ink }}>{value}</Text>
    </View>
  );
}

/** Ficha de una campaña enviada: resultado, interacción, entrega, envío y enlaces más clicados. */
function CampaignCard({ org, camp, onClose }: { org: Org; camp: Campaign; onClose: () => void }) {
  const s = camp.stats;
  const clicks = useApi<{ links?: Array<{ url: string; clicks: number; people: number }> }>(`/v1/organizations/${org.id}/marketing/klaviyo/campaigns/${encodeURIComponent(camp.external_id)}/clicks`);
  const links = (clicks.data?.links ?? []).slice(0, 8);
  const from = [camp.from_label, camp.from_email && `<${camp.from_email}>`].filter(Boolean).join(" ");

  return (
    <Sheet visible onClose={onClose} title={camp.name}>
      <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>{`Enviada el ${day(camp.send_time)}`}</Text>
      {s ? (
        <>
          <BigNumber label="Ingresos atribuidos por Klaviyo" value={eur(s.revenue)} />
          <MetricList
            title="Interacción"
            rows={[
              { label: "Aperturas únicas", value: `${fmtNum(s.opens_unique)} · ${pct(ratio(s.opens_unique, s.delivered))}` },
              { label: "Clics únicos", value: `${fmtNum(s.clicks_unique)} · ${pct(ratio(s.clicks_unique, s.delivered), 2)}` },
              { label: "Clics por apertura", value: pct(ratio(s.clicks_unique, s.opens_unique)) },
              { label: "Conversiones", value: fmtNum(s.conversions) },
              { label: "Ingreso por email", value: eur(ratio(s.revenue, s.recipients) ?? 0, 2) },
            ]}
          />
          <MetricList
            title="Entrega"
            rows={[
              { label: "Destinatarios", value: fmtNum(s.recipients) },
              { label: "Entregados", value: fmtNum(s.delivered) },
              { label: "Bajas", value: `${fmtNum(s.unsubscribes)} · ${pct(ratio(s.unsubscribes, s.delivered), 2)}` },
            ]}
          />
        </>
      ) : (
        <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Klaviyo aún no ha dado cifras de esta campaña en el periodo.</Text>
      )}
      {links.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>Enlaces más clicados</Text>
          {links.map((l) => (
            <View key={l.url} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: c.muted }}>{l.url.replace(/^https?:\/\/(www\.)?/, "")}</Text>
              <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{fmtNum(l.clicks)}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ gap: 12, paddingTop: 4 }}>
        <Field label="ASUNTO" value={camp.subject} />
        <Field label="TEXTO DE VISTA PREVIA" value={camp.preview_text} />
        <Field label="DE" value={from || null} />
        <Field label="PARA" value={names(camp.audiences?.included)} />
        <Field label="EXCLUYE" value={names(camp.audiences?.excluded)} />
      </View>
    </Sheet>
  );
}
