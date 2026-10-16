import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDown, ArrowUp, ChevronRight, Copy, Layers, Palette, Plus, Sparkles, Trash2, Undo2, X } from "lucide-react-native";
import { apiGet, apiSend, type ApiError } from "../lib/api";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, font } from "../lib/theme";
import {
  BLOCK_LABEL,
  SYSTEM_TEMPLATES,
  blankBlocks,
  brandFromProfile,
  buildMarketingBrief,
  collectMergeTokens,
  defaultBrand,
  emailPlainText,
  emptyDesign,
  isHttpUrl,
  newBlock,
  normalizeDesign,
  renderEmailHtml,
  reviewPiece,
  snippet,
  type BlockType,
  type Check,
  type StudioBlock,
  type StudioDesign,
  type StudioProduct,
} from "../lib/studio";
import { Sheet } from "./sheet";
import { Choice, DateField, Field, ImageField, Scroll, Section, Stepper, Toggle, labelStyle, type ImageOption } from "./estudio-campos";
import { BlockEditor, type BlockCtx } from "./estudio-bloques";
import { Canvas, MiniPreview } from "./estudio-canvas";
import { EstudioChat, type ChatMsg } from "./estudio-chat";
import { applyStudioOps, studioChatBody, type StudioChatOp } from "../lib/studio";
import { ListCard, ListRow, RowMeta, RowTitle, Status, SubNav } from "./ui";
import type { Org } from "./views";

// Estudio de contenido en el móvil: el mismo modelo que el de la web (bloques -> HTML de email), así una pieza
// guardada en un sitio se abre en el otro. Solo el canal de email; Meta, Instagram y popup siguen en la web.

type Header = { name: string; subject: string; preheader: string; fromName: string; replyTo: string };
type Piece = { design: StudioDesign; header: Header };
type Ref = { id: string; status: DraftStatus };
type DraftStatus = "draft" | "pending_approval" | "approved" | "rejected" | "published";
type Draft = {
  id: string;
  status: DraftStatus;
  content_type: string;
  request: { channel?: string; design?: unknown } | null;
  template_name: string;
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string | null;
  html: string;
  blocks: unknown[];
  updated_at: string;
};
type ApiProduct = { product_id: string; title: string; price: number | string | null; currency_code: string | null; image_url: string | null; product_url: string | null };
type Audience = { id: string; name: string; size: number | null };
export type StudioWorkspace = {
  account?: { default_from_email: string | null; default_from_label: string | null };
  audiences?: { lists: Audience[]; segments: Audience[] };
} | null;

const EMPTY_HEADER: Header = { name: "", subject: "", preheader: "", fromName: "", replyTo: "" };
const STATUS_LABEL: Record<DraftStatus, string> = { draft: "Borrador", pending_approval: "En revisión", approved: "Aprobada", rejected: "Con cambios", published: "Publicada" };
const isEmailDraft = (d: Draft) => d.content_type !== "popup" && (d.request?.channel ?? "email_klaviyo") === "email_klaviyo";

const toProduct = (row: ApiProduct): StudioProduct => ({
  id: row.product_id,
  title: row.title,
  price: row.price === null ? "" : fmtCurrency(Number(row.price), row.currency_code ?? "EUR", 2),
  image: row.image_url ?? "",
  url: row.product_url ?? "",
});

export function EstudioModal({ org, workspace, openDraftId, onClose, onDone }: { org: Org; workspace: StudioWorkspace; openDraftId?: string | null; onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const base = `/v1/organizations/${org.id}`;
  const brandQ = useApi<{ profile: Record<string, unknown> | null }>(`${base}/marketing/brand-profile`);
  const bestQ = useApi<{ products: ApiProduct[] }>(`${base}/marketing/studio/products?source=best`);
  const draftsQ = useApi<{ drafts?: Draft[] }>(`${base}/marketing/drafts`);
  const brandBase = useMemo(() => brandFromProfile(brandQ.data?.profile ?? null, org.name), [brandQ.data, org.name]);
  const best = useMemo(() => (bestQ.data?.products ?? []).map(toProduct), [bestQ.data]);
  const storeUrl = useMemo(() => {
    const first = best.find((p) => isHttpUrl(p.url));
    return first ? new URL(first.url).origin : "";
  }, [best]);
  const fromLabel = workspace?.account?.default_from_label ?? org.name;

  const [piece, setPiece] = useState<Piece | null>(null);
  const [ref, setRef] = useState<Ref | null>(null);
  const [tab, setTab] = useState<"diseno" | "email" | "revision" | "vista">("diseno");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [uploads, setUploads] = useState<ImageOption[]>([]);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [testing, setTesting] = useState<string | null>(null);

  const pieceRef = useRef<Piece | null>(null);
  const refRef = useRef<Ref | null>(null);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const past = useRef<Piece[]>([]);
  const lastPush = useRef(0);
  const [canUndo, setCanUndo] = useState(false);

  const setAll = (next: Piece | null, nextRef: Ref | null) => {
    pieceRef.current = next;
    refRef.current = nextRef;
    past.current = [];
    dirty.current = false;
    setPiece(next);
    setRef(nextRef);
    setSelectedId(null);
    setCanUndo(false);
    setChat([]);
    setAiOpen(false);
    setSave("idle");
    setTab("diseno");
  };

  const update = useCallback((mutate: (p: Piece) => Piece) => {
    const cur = pieceRef.current;
    if (!cur) return;
    const next = mutate(cur);
    if (next === cur) return;
    const now = Date.now();
    if (now - lastPush.current > 700) {
      past.current = [...past.current.slice(-39), cur];
      setCanUndo(true);
    }
    lastPush.current = now;
    pieceRef.current = next;
    dirty.current = true;
    setPiece(next);
    setRev((r) => r + 1);
  }, []);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    lastPush.current = 0;
    pieceRef.current = prev;
    dirty.current = true;
    setPiece(prev);
    setRev((r) => r + 1);
    setCanUndo(past.current.length > 0);
  };

  const design = piece?.design;
  const header = piece?.header ?? EMPTY_HEADER;
  const changeDesign = (fn: (d: StudioDesign) => StudioDesign) => update((p) => ({ ...p, design: fn(p.design) }));
  const changeHeader = (key: keyof Header, value: string) => update((p) => ({ ...p, header: { ...p.header, [key]: value } }));
  const patchBlock = (id: string, props: Record<string, unknown>) =>
    changeDesign((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, props: { ...b.props, ...props } } as StudioBlock) : b)) }));

  // ---------------------------------------------------------------- guardar

  const payload = (p: Piece) => {
    const name = p.header.name.trim() || p.header.subject.trim();
    const html = renderEmailHtml(p.design, { preheader: p.header.preheader, campaign: name || "nora" });
    return {
      channel: "email",
      name,
      from_name: p.header.fromName,
      reply_to: p.header.replyTo.trim() || null,
      design: p.design,
      store_id: null,
      subject: p.header.subject,
      preheader: p.header.preheader,
      html,
      plain_text: emailPlainText(p.design),
      blocks: p.design.blocks,
      personalization_tokens: collectMergeTokens(html, p.header.subject, p.header.preheader),
    };
  };

  const saveNow = useCallback(async (): Promise<Ref | null> => {
    const cur = pieceRef.current;
    if (!cur || cur.design.blocks.length === 0) return refRef.current;
    if (inFlight.current) return null;
    inFlight.current = true;
    dirty.current = false;
    setSave("saving");
    const existing = refRef.current;
    try {
      const body = await apiSend<{ draft: { id: string; status: DraftStatus } }>(existing ? "PUT" : "POST", `${base}/marketing/studio/drafts${existing ? `/${existing.id}` : ""}`, payload(cur), 30_000);
      const next = { id: body.draft.id, status: body.draft.status };
      refRef.current = next;
      setRef(next);
      setSave("saved");
      setSaveError(null);
      return next;
    } catch (e) {
      dirty.current = true;
      setSave("error");
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar.");
      return null;
    } finally {
      inFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void saveNow(), 1200);
    return () => clearTimeout(t);
  }, [rev, saveNow]);

  async function close() {
    if (dirty.current) await saveNow();
    if (refRef.current) draftsQ.reload();
    setAll(null, null);
    onClose();
  }

  // ---------------------------------------------------------------- empezar

  function start(blocks: StudioBlock[], headerPatch: Partial<Header> = {}) {
    setAll({ design: { ...emptyDesign(brandBase), blocks }, header: { ...EMPTY_HEADER, fromName: fromLabel, ...headerPatch } }, null);
    dirty.current = true;
    setRev((r) => r + 1);
  }

  const openDraft = useCallback(
    (d: Draft, asCopy = false) => {
      const design = normalizeDesign(d.request?.design, { aiBlocks: d.blocks, html: d.html, brand: brandBase });
      setAll(
        { design, header: { name: asCopy ? `${d.template_name || d.subject} (copia)` : d.template_name || "", subject: d.subject || "", preheader: d.preheader || "", fromName: d.from_name || fromLabel, replyTo: d.reply_to || "" } },
        asCopy ? null : { id: d.id, status: d.status },
      );
      if (asCopy) {
        dirty.current = true;
        setRev((r) => r + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brandBase, fromLabel],
  );

  // Borrador a abrir: el que pide quien nos llama o el que acaba de importarse de Klaviyo (espera a que llegue a la lista).
  const [wanted, setWanted] = useState<string | null>(openDraftId ?? null);
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || opened.current === wanted) return;
    const d = draftsQ.data?.drafts?.find((x) => x.id === wanted);
    if (!d) return;
    opened.current = wanted;
    openDraft(d);
  }, [wanted, draftsQ.data, openDraft]);

  // ---------------------------------------------------------------- bloques

  const insertIndex = () => {
    if (!design) return 0;
    const i = design.blocks.findIndex((b) => b.id === selectedId);
    if (i > -1) return i + 1;
    const footer = design.blocks.findIndex((b) => b.type === "footer");
    return footer > -1 ? footer : design.blocks.length;
  };
  function addBlock(type: BlockType) {
    const extra = type === "products" ? { items: best.slice(0, 3) } : type === "header" ? { logo: design?.brand.logo ?? "" } : type === "button" || type === "hero" ? { url: storeUrl } : {};
    const block = newBlock(type, extra as never);
    const at = insertIndex();
    changeDesign((d) => ({ ...d, blocks: [...d.blocks.slice(0, at), block, ...d.blocks.slice(at)] }));
    setAddOpen(false);
    setSelectedId(block.id);
  }
  function move(id: string, dir: -1 | 1) {
    changeDesign((d) => {
      const blocks = [...d.blocks];
      const i = blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return d;
      [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
      return { ...d, blocks };
    });
  }
  function duplicate(id: string) {
    changeDesign((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      if (i < 0) return d;
      const copy = { ...structuredClone(d.blocks[i]!), id: newBlock("spacer").id } as StudioBlock;
      return { ...d, blocks: [...d.blocks.slice(0, i + 1), copy, ...d.blocks.slice(i + 1)] };
    });
    setSelectedId(null);
  }
  function remove(id: string) {
    changeDesign((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    setSelectedId(null);
  }

  // ---------------------------------------------------------------- IA

  const sendChat = async (text: string, model: string) => {
    const cur = pieceRef.current;
    if (!cur) return;
    const history = chat.filter((m) => !m.error).map(({ role, text: body }) => ({ role, text: body }));
    setChat((m) => [...m, { role: "user", text }]);
    setChatBusy(true);
    try {
      const data = await apiSend<{ answer: string; ops: StudioChatOp[] }>("POST", `${base}/marketing/studio/ai-chat`, studioChatBody({ message: text, history, design: cur.design, header: cur.header, selectedId, connectionId: null, model }), 120_000);
      let labels: string[] = [];
      let touched: string[] = [];
      if (data.ops.length) {
        lastPush.current = 0; // cada respuesta es un solo paso de deshacer
        update((p) => {
          const out = applyStudioOps(p.design, p.header, data.ops);
          labels = out.labels;
          touched = out.touched;
          return { ...p, design: out.design, header: { ...p.header, subject: out.header.subject, preheader: out.header.preheader } };
        });
        if (touched[0]) setSelectedId(touched[0]);
      }
      setChat((m) => [...m, { role: "assistant", text: data.answer, labels }]);
    } catch (e) {
      const err = e as ApiError;
      setChat((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "No se pudo hablar con la IA.", error: true, ...(err.status === 402 ? { upgrade: err.canUpgrade ? ("yes" as const) : ("ask" as const) } : {}) }]);
    } finally {
      setChatBusy(false);
    }
  };

  // ---------------------------------------------------------------- imágenes y productos

  const images: ImageOption[] = useMemo(() => {
    const list: ImageOption[] = [];
    const seen = new Set<string>();
    const add = (src: string, label: string) => {
      if (src && !seen.has(src) && isHttpUrl(src)) {
        seen.add(src);
        list.push({ src, label });
      }
    };
    uploads.forEach((u) => add(u.src, u.label));
    best.forEach((p) => add(p.image, p.title));
    design?.blocks.forEach((b) => {
      if (b.type === "image") add(b.props.src, b.props.alt || "Imagen del email");
      if (b.type === "hero") add(b.props.img, b.props.alt || "Portada");
    });
    return list;
  }, [uploads, best, design]);

  const ctx: BlockCtx | null = design
    ? {
        orgId: org.id,
        brand: design.brand,
        images,
        onUploaded: (img) => setUploads((u) => [img, ...u]),
        loadProducts: async (source, q = "") => {
          const params = new URLSearchParams({ source });
          if (q.trim()) params.set("q", q.trim());
          try {
            return (await apiGet<{ products: ApiProduct[] }>(`${base}/marketing/studio/products?${params}`)).products.map(toProduct);
          } catch {
            return [];
          }
        },
      }
    : null;

  // ---------------------------------------------------------------- revisión

  const html = useMemo(() => (design ? renderEmailHtml(design, { preheader: header.preheader, campaign: header.name || header.subject || "nora" }) : ""), [design, header.preheader, header.name, header.subject]);
  const canvasHtml = useMemo(() => (design ? renderEmailHtml(design, { preheader: header.preheader, campaign: header.name || header.subject || "nora", blockIds: true }) : ""), [design, header.preheader, header.name, header.subject]);
  const checks: Check[] = design ? reviewPiece("email", design, { subject: header.subject, preheader: header.preheader }, html.length) : [];
  const blocked = checks.some((k) => k.state === "bad");
  const pending = checks.filter((k) => k.state !== "ok").length;

  function fix(action: string) {
    if (action.startsWith("select:")) {
      setSelectedId(action.slice(7));
      setTab("diseno");
    } else if (action.startsWith("tab:")) setTab("email");
    else if (action === "utm") changeDesign((d) => ({ ...d, blocks: d.blocks.map((b) => (b.type === "button" || b.type === "hero" ? ({ ...b, props: { ...b.props, utm: true } } as StudioBlock) : b)) }));
    else if (action === "footer") changeDesign((d) => ({ ...d, blocks: [...d.blocks, newBlock("footer")] }));
  }

  async function sendTest() {
    if (!header.subject.trim()) {
      setTab("email");
      setTesting("Escribe el asunto antes de mandar la prueba.");
      return;
    }
    setTesting("Enviando…");
    try {
      const r = await apiSend<{ sent_to: string }>("POST", `${base}/marketing/studio/test-send`, { subject: header.subject, html }, 30_000);
      setTesting(`Prueba enviada a ${r.sent_to}, con datos de ejemplo.`);
    } catch (e) {
      setTesting(e instanceof Error ? e.message : "No se pudo enviar la prueba.");
    }
  }

  // ---------------------------------------------------------------- UI

  const saveLabel = save === "saving" ? "Guardando…" : save === "saved" ? "Guardado" : save === "error" ? "Sin guardar" : "";
  const selected = design?.blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Cerrar"><X size={24} color={c.ink} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 17, fontFamily: font.semibold, color: c.ink }}>{piece ? header.name || header.subject || "Nueva campaña" : "Nueva campaña"}</Text>
            {piece && <Text style={{ fontSize: 12, fontFamily: font.regular, color: save === "error" ? c.danger : c.muted }}>{[ref ? STATUS_LABEL[ref.status] : "Sin guardar", saveLabel].filter(Boolean).join(" · ")}</Text>}
          </View>
          {piece && canUndo && <Pressable onPress={undo} hitSlop={12} accessibilityLabel="Deshacer"><Undo2 size={22} color={c.ink} /></Pressable>}
        </View>

        {!piece || !ctx || !design ? (
          <Launcher org={org} best={best} brandBase={brandBase} storeUrl={storeUrl} drafts={(draftsQ.data?.drafts ?? []).filter(isEmailDraft)} loading={!draftsQ.data} start={start} openDraft={openDraft} base={base} fromLabel={fromLabel} setAll={setAll} markDirty={() => { dirty.current = true; setRev((r) => r + 1); }} onImported={async (id) => { await draftsQ.reload(); setWanted(id); }} />
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{ paddingHorizontal: 20 }}>
              <SubNav items={[{ key: "diseno", label: "Diseño" }, { key: "email", label: "Email" }, { key: "revision", label: pending ? `Revisión · ${pending}` : "Revisión" }, { key: "vista", label: "Vista" }]} value={tab} onChange={setTab} />
            </View>

            {tab === "diseno" && (
              <View style={{ flex: 1 }}>
                <View style={{ flex: selected || aiOpen ? 0.4 : 1 }}>
                  <Canvas html={canvasHtml} selectedId={selectedId} onSelect={setSelectedId} />
                </View>

                {aiOpen ? (
                  <EstudioChat base={base} messages={chat} busy={chatBusy} canUndo={canUndo} onSend={(t, model) => void sendChat(t, model)} onUndo={undo} onClose={() => setAiOpen(false)} />
                ) : selected ? (
                  <View style={{ flex: 0.6, borderTopWidth: 1, borderTopColor: c.edge, backgroundColor: c.bg }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.edge }}>
                      <Text style={{ flex: 1, fontSize: 16, fontFamily: font.semibold, color: c.ink }}>{BLOCK_LABEL[selected.type]}</Text>
                      <Pressable onPress={() => move(selected.id, -1)} hitSlop={8} accessibilityLabel="Subir"><ArrowUp size={20} color={c.ink} /></Pressable>
                      <Pressable onPress={() => move(selected.id, 1)} hitSlop={8} accessibilityLabel="Bajar"><ArrowDown size={20} color={c.ink} /></Pressable>
                      <Pressable onPress={() => duplicate(selected.id)} hitSlop={8} accessibilityLabel="Duplicar"><Copy size={19} color={c.ink} /></Pressable>
                      <Pressable onPress={() => remove(selected.id)} hitSlop={8} accessibilityLabel="Eliminar"><Trash2 size={19} color={c.danger} /></Pressable>
                      <Pressable onPress={() => setSelectedId(null)} hitSlop={8} accessibilityLabel="Cerrar edición"><X size={22} color={c.ink} /></Pressable>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
                      <BlockEditor block={selected} ctx={ctx} patch={(props) => patchBlock(selected.id, props)} />
                    </ScrollView>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.edge }}>
                    <ToolButton Icon={Plus} label="Añadir" onPress={() => setAddOpen(true)} />
                    <ToolButton Icon={Layers} label={`Bloques · ${design.blocks.length}`} onPress={() => setStructureOpen(true)} />
                    <ToolButton Icon={Palette} label="Marca" onPress={() => setBrandOpen(true)} />
                    <ToolButton Icon={Sparkles} label="IA" onPress={() => setAiOpen(true)} />
                  </View>
                )}
              </View>
            )}

            {tab === "email" && (
              <Scroll>
                <Section title="Bandeja de entrada">
                  <Field label="Asunto" value={header.subject} onChange={(v) => changeHeader("subject", v)} counter={`${header.subject.trim().length} · ideal 20–50`} hint="En el móvil se ven unos 35 caracteres." />
                  <Field label="Vista previa" value={header.preheader} onChange={(v) => changeHeader("preheader", v)} hint="Se lee justo después del asunto." />
                </Section>
                <Section title="Remitente">
                  <Field label="Nombre" value={header.fromName} onChange={(v) => changeHeader("fromName", v)} />
                  <Field label="Email de respuesta" value={header.replyTo} onChange={(v) => changeHeader("replyTo", v)} keyboard="email-address" placeholder="Opcional" />
                </Section>
                <Section title="Interno">
                  <Field label="Nombre de la campaña" value={header.name} onChange={(v) => changeHeader("name", v)} placeholder="Cómo la reconoces tú" />
                </Section>
              </Scroll>
            )}

            {tab === "revision" && (
              <Scroll>
                {saveError && <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{saveError}</Text>}
                {checks.map((k) => (
                  <View key={k.title} style={{ flexDirection: "row", gap: 12, borderTopWidth: 1, borderTopColor: c.edge, paddingTop: 14 }}>
                    <View style={{ marginTop: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: k.state === "ok" ? c.accent : k.state === "warn" ? c.warning : c.danger }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{k.title}</Text>
                      <Text style={{ fontSize: 13, lineHeight: 19, fontFamily: font.regular, color: c.muted }}>{k.detail}</Text>
                      {k.fix && (
                        <Pressable onPress={() => fix(k.fix!.action)} style={{ paddingTop: 4 }}>
                          <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>{k.fix.label}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </Scroll>
            )}

            {tab === "vista" && (
              <View style={{ flex: 1, padding: 20, gap: 12 }}>
                <View style={{ flex: 1, borderWidth: 1, borderColor: c.edge, borderRadius: 12, overflow: "hidden" }}>
                  <WebView originWhitelist={["about:*"]} source={{ html }} javaScriptEnabled={false} onShouldStartLoadWithRequest={(r) => r.url === "about:blank"} style={{ backgroundColor: "#fff" }} />
                </View>
                <Pressable onPress={sendTest} style={{ alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.accent }}>Enviarme una prueba al correo</Text>
                </Pressable>
                {testing ? <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted, textAlign: "center" }}>{testing}</Text> : null}
              </View>
            )}

            {!(tab === "diseno" && (selected || aiOpen)) && <View style={{ padding: 20, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: c.edge }}>
              <Pressable onPress={async () => { if (dirty.current) await saveNow(); setSendOpen(true); }} style={{ borderRadius: 12, paddingVertical: 16, alignItems: "center", backgroundColor: c.ink }}>
                <Text style={{ fontSize: 16, fontFamily: font.semibold, color: "#fff" }}>Programar o enviar</Text>
              </Pressable>
            </View>}

            <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Añadir bloque">
              {(Object.keys(BLOCK_LABEL) as BlockType[]).map((t) => (
                <ListRow flat key={t} first={false} onPress={() => addBlock(t)} right={<Plus size={18} color={c.muted} />}>
                  <RowTitle>{BLOCK_LABEL[t]}</RowTitle>
                </ListRow>
              ))}
            </Sheet>

            <Sheet visible={structureOpen} onClose={() => setStructureOpen(false)} title={`Bloques · ${design.blocks.length}`}>
              {design.blocks.map((b, i) => (
                <ListRow
                  flat
                  key={b.id}
                  first={i === 0}
                  onPress={() => { setStructureOpen(false); setSelectedId(b.id); }}
                  right={
                    <View style={{ flexDirection: "row", gap: 16 }}>
                      <Pressable onPress={() => move(b.id, -1)} hitSlop={8} disabled={i === 0}><ArrowUp size={20} color={i === 0 ? c.edge : c.ink} /></Pressable>
                      <Pressable onPress={() => move(b.id, 1)} hitSlop={8} disabled={i === design.blocks.length - 1}><ArrowDown size={20} color={i === design.blocks.length - 1 ? c.edge : c.ink} /></Pressable>
                    </View>
                  }
                >
                  <RowTitle>{BLOCK_LABEL[b.type]}</RowTitle>
                  <RowMeta>{snippet(b) || "Sin contenido"}</RowMeta>
                </ListRow>
              ))}
            </Sheet>

            <BrandSheet visible={brandOpen} onClose={() => setBrandOpen(false)} design={design} ctx={ctx} onChange={(brand) => changeDesign((d) => ({ ...d, brand }))} />

            <SendSheet
              visible={sendOpen}
              onClose={() => setSendOpen(false)}
              base={base}
              header={header}
              workspace={workspace}
              checks={checks}
              blocked={blocked}
              ensureApproved={async () => {
                let r = dirty.current ? await saveNow() : refRef.current;
                if (!r) throw new Error(saveError ?? "No se pudo guardar la pieza.");
                if (r.status === "draft" || r.status === "rejected") {
                  await apiSend("POST", `${base}/marketing/drafts/${r.id}/submit`, undefined, 20_000);
                  r = { ...r, status: "pending_approval" };
                }
                if (r.status === "pending_approval") {
                  await apiSend("POST", `${base}/marketing/drafts/${r.id}/decision`, { decision: "approved" }, 20_000);
                  r = { ...r, status: "approved" };
                }
                refRef.current = r;
                setRef(r);
                return r.id;
              }}
              onSent={() => {
                onDone();
                void close();
              }}
            />
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

function ToolButton({ Icon, label, onPress }: { Icon: typeof Plus; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", gap: 4, paddingHorizontal: 12 }}>
      <Icon size={22} color={c.ink} />
      <Text style={{ fontSize: 12, fontFamily: font.medium, color: c.ink }}>{label}</Text>
    </Pressable>
  );
}

// --- Marca ------------------------------------------------------------------------------

function BrandSheet({ visible, onClose, design, ctx, onChange }: { visible: boolean; onClose: () => void; design: StudioDesign; ctx: BlockCtx; onChange: (b: StudioDesign["brand"]) => void }) {
  const b = design.brand;
  const hex = (label: string, key: "primary" | "accent" | "text" | "bg" | "card") => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: b[key], borderWidth: 1, borderColor: c.edge }} />
      <View style={{ flex: 1 }}>
        <Field label={label} value={b[key]} onChange={(v) => onChange({ ...b, [key]: v.startsWith("#") || v === "" ? v : `#${v}` })} />
      </View>
    </View>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title="Marca y colores">
      <Field label="Logo (texto)" value={b.logo} onChange={(v) => onChange({ ...b, logo: v })} />
      <ImageField label="Logo (imagen)" value={b.logoUrl} images={ctx.images} orgId={ctx.orgId} onUploaded={ctx.onUploaded} onChange={(src) => onChange({ ...b, logoUrl: src })} />
      {hex("Principal", "primary")}
      {hex("Acento", "accent")}
      {hex("Texto", "text")}
      {hex("Fondo", "bg")}
      {hex("Tarjeta", "card")}
      <Choice label="Letra de los títulos" value={b.head} options={[{ value: "serif", label: "Con serifa" }, { value: "sans", label: "Sin serifa" }]} onChange={(v) => onChange({ ...b, head: v })} />
      <Stepper label="Redondeo" value={b.radius} min={0} max={24} step={2} suffix=" px" onChange={(v) => onChange({ ...b, radius: v })} />
    </Sheet>
  );
}

// --- Programar o enviar ----------------------------------------------------------------

function SendSheet({ visible, onClose, base, header, workspace, checks, blocked, ensureApproved, onSent }: { visible: boolean; onClose: () => void; base: string; header: Header; workspace: StudioWorkspace; checks: Check[]; blocked: boolean; ensureApproved: () => Promise<string>; onSent: () => void }) {
  const lists = workspace?.audiences?.lists ?? [];
  const segments = workspace?.audiences?.segments ?? [];
  const audiences = [...lists.map((a) => ({ ...a, kind: "lista" })), ...segments.map((a) => ({ ...a, kind: "segmento" }))];
  const [included, setIncluded] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [smart, setSmart] = useState(true);
  const [when, setWhen] = useState<"now" | "later">("later");
  const [sendAt, setSendAt] = useState(() => {
    const d = new Date(Date.now() + 2 * 3_600_000);
    d.setMinutes(0, 0, 0);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
  });
  const [fromEmail, setFromEmail] = useState(workspace?.account?.default_from_email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const reach = audiences.filter((a) => included.includes(a.id)).reduce((n, a) => n + (a.size ?? 0), 0);
  const timeOk = when === "now" || Date.parse(sendAt) >= Date.now() + 5 * 60_000;
  const ready = !blocked && included.length > 0 && /\S+@\S+\.\S+/.test(fromEmail) && header.subject.trim().length > 0 && timeOk;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const draftId = await ensureApproved();
      await apiSend(
        "POST",
        `${base}/marketing/klaviyo/campaigns`,
        {
          draftId,
          name: header.name || header.subject,
          subject: header.subject,
          previewText: header.preheader,
          fromEmail,
          fromLabel: header.fromName || fromEmail,
          includedAudiences: included,
          excludedAudiences: excluded,
          sendAt: when === "now" ? null : new Date(sendAt).toISOString(),
          smartSending: smart,
        },
        60_000,
      );
      setDone(when === "now" ? "Se está enviando desde Klaviyo." : `Programada para el ${new Date(sendAt).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo programar.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Sheet visible={visible} onClose={onSent} title="Listo">
        <Text style={{ fontSize: 16, lineHeight: 24, fontFamily: font.regular, color: c.ink }}>{done}</Text>
        <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Podrás verla en Programación y cancelarla desde la web hasta la hora de envío.</Text>
        <Pressable onPress={onSent} style={{ borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: c.ink }}><Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>Cerrar</Text></Pressable>
      </Sheet>
    );

  return (
    <Sheet visible={visible} onClose={onClose} title="Programar o enviar">
      {blocked && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.danger }}>Antes de enviarla hay que arreglar:</Text>
          {checks.filter((k) => k.state === "bad").map((k) => <Text key={k.title} style={{ fontSize: 14, fontFamily: font.regular, color: c.ink }}>{`• ${k.title}`}</Text>)}
        </View>
      )}
      <View style={{ gap: 2 }}>
        <Text style={labelStyle}>Asunto</Text>
        <Text style={{ fontSize: 16, fontFamily: font.semibold, color: header.subject.trim() ? c.ink : c.danger }}>{header.subject.trim() || "Falta el asunto (pestaña Email)"}</Text>
      </View>
      <Field label="Email del remitente" value={fromEmail} onChange={setFromEmail} keyboard="email-address" />

      <Text style={labelStyle}>{`Envía a${reach ? ` · ${reach.toLocaleString("es-ES")} perfiles` : ""}`}</Text>
      {audiences.length === 0 && <RowMeta>Aún no hay listas ni segmentos sincronizados.</RowMeta>}
      {audiences.map((a) => (
        <Pressable key={a.id} onPress={() => toggle(included, setIncluded, a.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: included.includes(a.id) ? c.ink : c.edge, backgroundColor: included.includes(a.id) ? c.ink : c.bg, alignItems: "center", justifyContent: "center" }}>
            {included.includes(a.id) && <Text style={{ color: "#fff", fontSize: 13 }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 15, fontFamily: font.regular, color: c.ink }}>{`${a.name} · ${a.kind}${a.size != null ? ` · ${a.size.toLocaleString("es-ES")}` : ""}`}</Text>
        </Pressable>
      ))}
      {audiences.length > 0 && <Text style={labelStyle}>Excluir (opcional)</Text>}
      {audiences.map((a) => (
        <Pressable key={`x-${a.id}`} onPress={() => toggle(excluded, setExcluded, a.id)} disabled={included.includes(a.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, opacity: included.includes(a.id) ? 0.35 : 1 }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: excluded.includes(a.id) ? c.danger : c.edge, backgroundColor: excluded.includes(a.id) ? c.danger : c.bg, alignItems: "center", justifyContent: "center" }}>
            {excluded.includes(a.id) && <Text style={{ color: "#fff", fontSize: 13 }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 15, fontFamily: font.regular, color: c.ink }}>{a.name}</Text>
        </Pressable>
      ))}

      <Choice label="Cuándo" value={when} options={[{ value: "later", label: "Programar" }, { value: "now", label: "Enviar ahora" }]} onChange={setWhen} />
      {when === "later" && <DateField label="Fecha y hora de envío" value={sendAt} withTime onChange={setSendAt} />}
      {when === "later" && !timeOk && <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.danger }}>Tiene que ser al menos dentro de 5 minutos.</Text>}
      <Toggle label="Envío inteligente (no repetir a quien ya recibió un email hace poco)" value={smart} onChange={setSmart} />

      {error ? <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.danger }}>{error}</Text> : null}
      <Pressable disabled={!ready || busy} onPress={go} style={{ borderRadius: 12, paddingVertical: 16, alignItems: "center", backgroundColor: ready ? c.ink : c.edge }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontFamily: font.semibold, color: ready ? "#fff" : c.muted }}>{when === "now" ? "Enviar ahora" : "Programar envío"}</Text>}
      </Pressable>
      <Text style={{ fontSize: 12, lineHeight: 18, fontFamily: font.regular, color: c.muted }}>Se envía desde la cuenta de Klaviyo de la tienda. Tu consultor podrá verla y dejarte apuntes, pero no tiene que aprobarla.</Text>
    </Sheet>
  );
}

// --- Empezar ---------------------------------------------------------------------------

const OBJECTIVES = [
  { value: "launch", label: "Lanzamiento" },
  { value: "offer", label: "Oferta" },
  { value: "newsletter", label: "Novedades" },
  { value: "winback", label: "Recuperar clientes" },
  { value: "welcome", label: "Bienvenida" },
];
const TONES = [
  { value: "warm", label: "Cercano" },
  { value: "formal", label: "Profesional" },
  { value: "fun", label: "Divertido" },
];

function Launcher({ org, best, brandBase, storeUrl, drafts, loading, start, openDraft, base, fromLabel, setAll, markDirty, onImported }: { org: Org; best: StudioProduct[]; brandBase: ReturnType<typeof defaultBrand>; storeUrl: string; drafts: Draft[]; loading: boolean; start: (blocks: StudioBlock[], h?: Partial<Header>) => void; openDraft: (d: Draft, asCopy?: boolean) => void; base: string; fromLabel: string; setAll: (p: Piece | null, r: Ref | null) => void; markDirty: () => void; onImported: (draftId: string) => void }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [brief, setBrief] = useState({ objective: "launch", tone: "warm", offer: "", audience: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  void org;
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const tpl = useApi<{ templates: Array<{ id: string; name: string; editor_type: string | null; updated: string | null }> }>(importOpen ? `${base}/klaviyo/templates` : null);

  async function importTemplate(templateId: string) {
    setImporting(templateId);
    setError(null);
    try {
      const r = await apiSend<{ draft_id: string }>("POST", `${base}/klaviyo/templates/import`, { templateId }, 60_000);
      setImportOpen(false);
      onImported(r.draft_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar la plantilla.");
    } finally {
      setImporting(null);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{ draft: Draft }>(
        "POST",
        `${base}/marketing/drafts`,
        {
          content_type: "campaign",
          channel: "email_klaviyo",
          store_id: null,
          brief: buildMarketingBrief({ channel: "email_klaviyo", objective: brief.objective, audience: brief.audience, offer: brief.offer, tone: brief.tone, cta: "", instructions: brief.instructions }),
          brand_colors: { primary: brandBase.primary, background: brandBase.bg, text: brandBase.text },
        },
        180_000,
      );
      const d = res.draft;
      const design = normalizeDesign(d.request?.design, { aiBlocks: d.blocks, html: d.html, brand: brandBase });
      // La IA escribe el cuerpo; cabecera, marca y pie legal los pone el estudio.
      const blocks = [...(design.blocks[0]?.type === "header" ? [] : [newBlock("header", { logo: design.brand.logo })]), ...design.blocks, ...(design.blocks.some((b) => b.type === "footer") ? [] : [newBlock("footer")])];
      setAll({ design: { ...design, blocks }, header: { name: d.template_name || "", subject: d.subject || "", preheader: d.preheader || "", fromName: d.from_name || fromLabel, replyTo: d.reply_to || "" } }, { id: d.id, status: d.status });
      markDirty();
      setAiOpen(false);
    } catch {
      setError("La IA tardó demasiado o se cortó la conexión. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Scroll>
        <ListCard flat title="Empezar con una plantilla">
          {SYSTEM_TEMPLATES.map((t) => (
            <ListRow flat key={t.id} first={false} onPress={() => start(t.build({ brand: brandBase, storeUrl, products: best }), { subject: t.subject, preheader: t.preheader, name: t.name })} right={<ChevronRight size={18} color={c.muted} />}>
              <RowTitle>{t.name}</RowTitle>
              <RowMeta>{t.description}</RowMeta>
            </ListRow>
          ))}
          <ListRow flat first={false} onPress={() => start(blankBlocks(brandBase))} right={<ChevronRight size={18} color={c.muted} />}>
            <RowTitle>En blanco</RowTitle>
            <RowMeta>Cabecera y pie legal; el resto lo pones tú</RowMeta>
          </ListRow>
          <ListRow flat first={false} onPress={() => setImportOpen(true)} right={<ChevronRight size={18} color={c.muted} />}>
            <RowTitle>Importar de Klaviyo</RowTitle>
            <RowMeta>Trae una plantilla de tu cuenta como borrador</RowMeta>
          </ListRow>
          <ListRow flat first={false} onPress={() => setAiOpen(true)} right={<ChevronRight size={18} color={c.muted} />}>
            <RowTitle>Escribirla con IA</RowTitle>
            <RowMeta>Cuéntale qué quieres contar y propone el email</RowMeta>
          </ListRow>
        </ListCard>

        <ListCard flat title="Mis borradores">
          <Status error={null} loading={loading} />
          {!loading && drafts.length === 0 && <RowMeta>Aún no hay borradores de email.</RowMeta>}
          {drafts.map((d) => (
            <ListRow
              flat
              key={d.id}
              first={false}
              onPress={() => openDraft(d)}
              right={<Pressable onPress={() => openDraft(d, true)} hitSlop={8}><Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>Duplicar</Text></Pressable>}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {d.html ? <MiniPreview html={d.html} /> : <View style={{ width: 72, height: 96, borderRadius: 8, borderWidth: 1, borderColor: c.edge }} />}
                <View style={{ flex: 1 }}>
                  <RowTitle>{d.template_name || d.subject || "Sin nombre"}</RowTitle>
                  <RowMeta>{`${STATUS_LABEL[d.status]} · ${d.subject || "Sin asunto"}`}</RowMeta>
                </View>
              </View>
            </ListRow>
          ))}
        </ListCard>
      </Scroll>

      <Sheet visible={importOpen} onClose={() => setImportOpen(false)} title="Plantillas de Klaviyo">
        <Status error={tpl.error} loading={!tpl.data && !tpl.error} retry={tpl.retry} />
        {error ? <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text> : null}
        {tpl.data && tpl.data.templates.length === 0 && <RowMeta>Tu cuenta de Klaviyo no tiene plantillas.</RowMeta>}
        {tpl.data?.templates.map((t, i) => (
          <ListRow flat key={t.id} first={i === 0} onPress={() => void importTemplate(t.id)} right={importing === t.id ? <ActivityIndicator color={c.ink} /> : <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.accent }}>Importar</Text>}>
            <RowTitle>{t.name}</RowTitle>
            <RowMeta>{t.editor_type === "CODE" || !t.editor_type ? "HTML" : t.editor_type}</RowMeta>
          </ListRow>
        ))}
        <RowMeta>Se importa solo el HTML: se edita como un bloque de código, no con los bloques visuales.</RowMeta>
      </Sheet>

      <Sheet visible={aiOpen} onClose={() => setAiOpen(false)} title="Escribirla con IA">
        <Choice label="Objetivo" value={brief.objective} options={OBJECTIVES} onChange={(v) => setBrief({ ...brief, objective: v })} />
        <Choice label="Tono" value={brief.tone} options={TONES} onChange={(v) => setBrief({ ...brief, tone: v })} />
        <Field label="Oferta o producto" value={brief.offer} onChange={(v) => setBrief({ ...brief, offer: v })} multiline />
        <Field label="A quién va" value={brief.audience} onChange={(v) => setBrief({ ...brief, audience: v })} />
        <Field label="Indicaciones" value={brief.instructions} onChange={(v) => setBrief({ ...brief, instructions: v })} multiline hint="Lo que sí o no debe decir. No inventará precios ni datos." />
        {error ? <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text> : null}
        <Pressable onPress={generate} disabled={busy} style={{ borderRadius: 12, paddingVertical: 16, alignItems: "center", backgroundColor: c.ink }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontFamily: font.semibold, color: "#fff" }}>Escribir el email</Text>}
        </Pressable>
        {busy && <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted, textAlign: "center" }}>Puede tardar un minuto…</Text>}
      </Sheet>
    </>
  );
}

