import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { FlowsSection } from "./flows";
import { EstudioModal } from "./estudio";
import { MiniPreview } from "./estudio-canvas";
import { ListCard, ListRow, Note, PeriodChips, RowMeta, RowTitle, Screen, SubNav, Status, SummaryRow } from "./ui";
import { withStore, type Org } from "./views";

// Subconjunto de /marketing/klaviyo (ver apps/web/src/app/marketing/klaviyo-workspace.ts). Importes en EUR atribuidos por Klaviyo.
type Stats = { revenue: number; recipients: number; opens_unique: number; clicks_unique: number };
type Audience = { id: string; name: string; size: number | null };
type Campaign = {
  id: string;
  name: string;
  status: string | null;
  send_time: string | null;
  subject: string | null;
  preview_text: string | null;
  from_email: string | null;
  from_label: string | null;
  template_id: string | null;
  audiences: { included: Audience[]; excluded: Audience[] } | null;
  stats: Stats | null;
};
type Flow = { id: string; name: string; status: string | null; trigger_type: string | null; stats: Stats | null };
type StudioDraft = { id: string; status: "draft" | "pending_approval" | "approved" | "rejected" | "published"; content_type: string; request: { channel?: string } | null; template_name: string; subject: string; html: string; updated_at: string };
const DRAFT_STATUS: Record<StudioDraft["status"], string> = { draft: "Borrador", pending_approval: "En revisión", approved: "Aprobada", rejected: "Con cambios", published: "Publicada" };

type Workspace = {
  connected: boolean;
  campaigns?: Campaign[];
  flows?: Flow[];
  account?: { default_from_email: string | null; default_from_label: string | null };
  audiences?: { lists: Array<{ id: string; name: string; size: number | null }>; segments: Array<{ id: string; name: string; size: number | null }> };
};

const SECTIONS = [
  { key: "hoy", label: "Programación" },
  { key: "campanas", label: "Campañas" },
  { key: "flows", label: "Flows" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const DAY_MS = 86_400_000;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const eur = (v: number) => fmtCurrency(v, "EUR");

// Mismo mapeo que klaviyoCampaignStatus / flowStatus de la web.
function campaignStatus(status: string | null): { key: "draft" | "scheduled" | "sending" | "sent" | "cancelled"; label: string } {
  const v = (status ?? "").toLowerCase();
  if (v.includes("cancel")) return { key: "cancelled", label: "Cancelada" };
  if (v.includes("scheduled") || v.includes("preparing to schedule")) return { key: "scheduled", label: "Programada" };
  if (v.includes("sending") || v.includes("queued") || v.includes("adding") || v.includes("preparing")) return { key: "sending", label: "Enviándose" };
  if (v.includes("sent")) return { key: "sent", label: "Enviada" };
  return { key: "draft", label: "Borrador" };
}
function flowStatus(status: string | null) {
  const v = (status ?? "").toLowerCase();
  return v === "live" ? { key: "live", label: "Activo" } : v === "manual" ? { key: "manual", label: "Manual" } : { key: "draft", label: "Borrador" };
}

function when(iso: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  const hh = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}`;
}

function CampaignRow({ camp, first }: { camp: Campaign; first: boolean }) {
  const st = campaignStatus(camp.status);
  const sent = st.key === "sent" && camp.stats;
  return (
    <ListRow first={first} right={sent ? <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{eur(camp.stats!.revenue)}</Text> : null}>
      <RowTitle>{camp.name}</RowTitle>
      <RowMeta tone={st.key === "cancelled" ? "bad" : st.key === "scheduled" || st.key === "sending" ? "good" : undefined}>{`${st.label} · ${when(camp.send_time)}`}</RowMeta>
    </ListRow>
  );
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const audienceLine = (list: Audience[]) => list.map((a) => (a.size != null ? `${a.name} (${fmtNum(a.size)})` : a.name)).join(", ");
const toneOf = (key: string) => (key === "cancelled" ? "bad" : key === "scheduled" || key === "sending" ? "good" : undefined);

/** El HTML del email, tal como lo guarda el servidor (ya saneado). Sin JavaScript y sin navegación: es solo una imagen viva. */
function EmailPreview({ orgId, templateId }: { orgId: string; templateId: string | null }) {
  const { data, error } = useApi<{ html: string | null }>(templateId ? `/v1/organizations/${orgId}/marketing/klaviyo/templates/${encodeURIComponent(templateId)}/html` : null);
  if (!templateId) return <RowMeta>Esta campaña aún no tiene plantilla.</RowMeta>;
  if (error) return <RowMeta tone="bad">No se pudo cargar la vista previa.</RowMeta>;
  if (!data) return <Status error={null} loading />;
  if (!data.html) return <RowMeta>Sin vista previa de este email.</RowMeta>;
  return (
    <View style={{ height: 520, borderWidth: 1, borderColor: c.edge, borderRadius: 12, overflow: "hidden" }}>
      <WebView
        originWhitelist={["about:*"]}
        source={{ html: data.html }}
        javaScriptEnabled={false}
        nestedScrollEnabled
        onShouldStartLoadWithRequest={(req) => req.url === "about:blank"}
        style={{ backgroundColor: "#fff" }}
      />
    </View>
  );
}

const field = (label: string, value: string | null | undefined, big?: boolean) =>
  value ? (
    <View key={label} style={{ gap: 2 }}>
      <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: big ? 18 : 15, lineHeight: big ? 24 : 21, fontFamily: big ? font.semibold : font.regular, color: c.ink }}>{value}</Text>
    </View>
  ) : null;

/** Hoja con todo lo que se va a enviar: asunto, texto de vista previa, remitente, destinatarios y el email. */
function CampaignSheet({ orgId, camp, onClose }: { orgId: string; camp: Campaign | null; onClose: () => void }) {
  if (!camp) return null;
  const st = campaignStatus(camp.status);
  const from = [camp.from_label, camp.from_email && `<${camp.from_email}>`].filter(Boolean).join(" ");
  return (
    <Sheet visible onClose={onClose} title={camp.name}>
      <RowMeta tone={toneOf(st.key)}>{`${st.label} · ${when(camp.send_time)}`}</RowMeta>
      {field("Asunto", camp.subject ?? "Sin asunto", true)}
      {field("Texto de vista previa", camp.preview_text)}
      {field("De", from)}
      {field("Para", audienceLine(camp.audiences?.included ?? []))}
      {field("Excluye", audienceLine(camp.audiences?.excluded ?? []))}
      {st.key === "sent" && camp.stats && field("Ingresos atribuidos por Klaviyo", eur(camp.stats.revenue))}
      <EmailPreview orgId={orgId} templateId={camp.template_id} />
    </Sheet>
  );
}

/** Programación: qué sale y cuándo. Ventana de 7, 15 o 30 días que se desplaza de una en una con las flechas. */
function Programacion({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const [span, setSpan] = useState(7);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const today = dayStart(new Date());
  // Con 7 días la ventana es la semana natural (lunes a domingo); con 15 o 30, desde hoy.
  const base = span === 7 ? new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS) : today;
  const start = new Date(base.getTime() + offset * span * DAY_MS);
  const end = new Date(start.getTime() + span * DAY_MS);
  const last = new Date(end.getTime() - DAY_MS);

  const scheduled = campaigns.filter((x) => x.send_time && campaignStatus(x.status).key !== "draft");
  const inWindow = scheduled.filter((x) => new Date(x.send_time!) >= start && new Date(x.send_time!) < end).sort((a, b) => a.send_time!.localeCompare(b.send_time!));
  const drafts = campaigns.filter((x) => campaignStatus(x.status).key === "draft");
  const next = scheduled.filter((x) => new Date(x.send_time!).getTime() >= Date.now()).sort((a, b) => a.send_time!.localeCompare(b.send_time!))[0];

  const byDay = new Map<string, Campaign[]>();
  for (const x of inWindow) {
    const k = dayStart(new Date(x.send_time!)).toISOString();
    byDay.set(k, [...(byDay.get(k) ?? []), x]);
  }

  return (
    <>
      <PeriodChips options={[7, 15, 30]} value={span} onChange={(d) => { setSpan(d); setOffset(0); }} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={12} accessibilityLabel="Periodo anterior"><ChevronLeft size={26} color={c.ink} /></Pressable>
        <Pressable onPress={() => setOffset(0)} disabled={offset === 0} style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 17, fontFamily: font.semibold, color: c.ink }}>{`${shortDate(start)} – ${shortDate(last)}`}</Text>
          {offset !== 0 && <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.accent }}>Volver a hoy</Text>}
        </Pressable>
        <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={12} accessibilityLabel="Periodo siguiente"><ChevronRight size={26} color={c.ink} /></Pressable>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>Envíos en este periodo</Text>
        <Text style={{ fontSize: 40, fontFamily: font.semibold, color: c.ink }}>{fmtNum(inWindow.length)}</Text>
        {next?.send_time && <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>{`Próximo: ${next.name} · ${when(next.send_time)}`}</Text>}
      </View>

      {inWindow.length === 0 ? (
        <RowMeta>No hay envíos en estas fechas.</RowMeta>
      ) : (
        [...byDay.entries()].map(([k, list]) => {
          const d = new Date(k);
          return (
            <ListCard flat key={k} title={`${DAYS[d.getDay()][0].toUpperCase()}${DAYS[d.getDay()].slice(1)} ${shortDate(d)}`}>
              {list.map((x) => {
                const st = campaignStatus(x.status);
                return (
                  <ListRow
                    flat
                    key={x.id}
                    onPress={() => setSelected(x)}
                    right={
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{clock(x.send_time!)}</Text>
                        <RowMeta tone={toneOf(st.key)}>{st.label}</RowMeta>
                      </View>
                    }
                  >
                    <RowTitle>{x.name}</RowTitle>
                    <RowMeta>{x.subject ?? "Sin asunto"}</RowMeta>
                  </ListRow>
                );
              })}
            </ListCard>
          );
        })
      )}

      {drafts.length > 0 && <SummaryRow title="Borradores sin programar" summary={fmtNum(drafts.length)} onPress={() => setDraftsOpen(true)} />}

      <Sheet visible={draftsOpen} onClose={() => setDraftsOpen(false)} title={`Borradores (${drafts.length})`}>
        {drafts.map((x, i) => (
          <ListRow flat key={x.id} first={i === 0} onPress={() => { setDraftsOpen(false); setSelected(x); }}>
            <RowTitle>{x.name}</RowTitle>
            <RowMeta>{x.subject ?? "Sin asunto"}</RowMeta>
          </ListRow>
        ))}
      </Sheet>

      <CampaignSheet orgId={orgId} camp={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/** Marketing = "qué hay que mandar": lo de hoy y lo próximo, las campañas y los flows. Solo lectura. */
export function MarketingModule({ org }: { org: Org }) {
  const [section, setSection] = useState<Section>("hoy");
  const { data, error, reload, retry } = useApi<Workspace>(withStore(org, `/v1/organizations/${org.id}/marketing/klaviyo?days=30`));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const drafts = useApi<{ drafts?: StudioDraft[] }>(`/v1/organizations/${org.id}/marketing/drafts`);
  const myDrafts = (drafts.data?.drafts ?? [])
    .filter((d) => d.content_type !== "popup" && (d.request?.channel ?? "email_klaviyo") === "email_klaviyo" && d.status !== "published")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const nav: ReactNode = <SubNav items={[...SECTIONS]} value={section} onChange={setSection} />;
  const campaigns = data?.campaigns ?? [];
  const flows = data?.flows ?? [];

  return (
    <Screen flat title="Marketing" subtitle={org.name} onRefresh={async () => void (await Promise.all([reload(), drafts.reload()]))}>
      {nav}
      {data?.connected && (
        <Pressable onPress={() => setCreating(true)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, backgroundColor: c.ink }}>
          <Plus size={18} color="#fff" />
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>Nueva campaña</Text>
        </Pressable>
      )}
      <Status error={error} loading={!data} retry={retry} />
      {data && !data.connected && <Note text="Klaviyo no está conectado. Se conecta desde la web." />}
      {data?.connected && section === "hoy" && <Programacion orgId={org.id} campaigns={campaigns} />}
      {data?.connected && section === "campanas" && myDrafts.length > 0 && (
        <ListCard flat title={`Borradores · ${myDrafts.length}`}>
          {myDrafts.map((d) => (
            <ListRow flat key={d.id} first={false} onPress={() => { setEditing(d.id); setCreating(true); }} right={<ChevronRight size={18} color={c.muted} />}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {d.html ? <MiniPreview html={d.html} /> : <View style={{ width: 72, height: 96, borderRadius: 8, borderWidth: 1, borderColor: c.edge }} />}
                <View style={{ flex: 1 }}>
                  <RowTitle>{d.template_name || d.subject || "Sin nombre"}</RowTitle>
                  <RowMeta tone={d.status === "rejected" ? "warn" : d.status === "approved" ? "good" : undefined}>{`${DRAFT_STATUS[d.status]} · ${d.subject || "Sin asunto"}`}</RowMeta>
                </View>
              </View>
            </ListRow>
          ))}
        </ListCard>
      )}
      {data?.connected && section === "campanas" && (
        <ListCard title={`Campañas · ${campaigns.length}`}>
          {[...campaigns].sort((a, b) => (b.send_time ?? "").localeCompare(a.send_time ?? "")).slice(0, 30).map((x, i) => <CampaignRow key={x.id} camp={x} first={i === 0} />)}
          {campaigns.length === 0 && <ListRow first><RowMeta>No hay campañas.</RowMeta></ListRow>}
        </ListCard>
      )}
      {data?.connected && section === "flows" && <FlowsSection orgId={org.id} flows={flows} account={data.audiences ? { lists: data.audiences.lists, segments: data.audiences.segments } : undefined} />}
      {creating && <EstudioModal org={org} workspace={data ?? null} openDraftId={editing} onClose={() => { setCreating(false); setEditing(null); void drafts.reload(); }} onDone={reload} />}
    </Screen>
  );
}
