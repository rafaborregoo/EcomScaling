"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { buildMarketingBrief } from "@/lib/marketing-brief";
import { formatMoney } from "@/lib/money";
import { Dialog, toast } from "@/components/ui";
import { useCopilotAsk } from "@/components/copilot-ask";
import { toChannel } from "@/components/marketing-channel";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { KWorkspace } from "../klaviyo-workspace";
import { KlaviyoImportPanel } from "../klaviyo-import-panel";
import { collectMergeTokens } from "../template-fields";
import { fmtDate } from "../format";
import {
  EmailCanvas,
  Icon,
  IgPreview,
  MetaPreview,
  PopupPreview,
  type DropPayload,
} from "./studio-canvas";
import {
  AiPanel,
  StudioChat,
  type ChatMsg,
  BlockInspector,
  Fields,
  LeftPanel,
  ReviewPanel,
  SECTIONS,
  setPath,
  type AiKind,
  type ImageOption,
  type LeftTab,
} from "./studio-panels";
import {
  SYSTEM_TEMPLATES,
  blankBlocks,
  brandFromProfile,
  emailPlainText,
  emptyDesign,
  isHttpUrl,
  newBlock,
  normalizeDesign,
  renderEmailHtml,
  renderPopupHtml,
  renderSocialHtml,
  reviewPiece,
  withUtm,
  type BlockType,
  type StudioBlock,
  type StudioBrand,
  type StudioChannel,
  type StudioDesign,
  type StudioProduct,
} from "./studio-design";
import { applyStudioOps, studioChatBody, type StudioChatOp } from "./studio-ai-ops";
import s from "./studio.module.css";

type Header = { name: string; subject: string; preheader: string; fromName: string; replyTo: string };
type Piece = { design: StudioDesign; header: Header };
type DraftRef = { id: string; status: MarketingDraft["status"] };
type SaveState = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

const EMPTY_HEADER: Header = { name: "", subject: "", preheader: "", fromName: "", replyTo: "" };

const CHANNELS: Array<[StudioChannel, string, string]> = [
  ["email", "Email", "mail"],
  ["meta", "Meta Ads", "meta"],
  ["ig", "Instagram", "insta"],
  ["popup", "Popup", "popup"],
];

const STATUS_LABEL: Record<MarketingDraft["status"], string> = {
  draft: "Borrador",
  pending_approval: "En revisión",
  approved: "Aprobada",
  rejected: "Con cambios pedidos",
  published: "Publicada",
};

/** Canal del estudio a partir de un borrador guardado. */
export function studioChannelOf(draft: Pick<MarketingDraft, "request" | "content_type">): StudioChannel {
  const channel = draft.request?.channel;
  if (channel === "meta_ads") return "meta";
  if (channel === "instagram_organic") return "ig";
  return draft.content_type === "popup" ? "popup" : "email";
}

type ApiProduct = {
  product_id: string;
  title: string;
  price: number | string | null;
  currency_code: string | null;
  image_url: string | null;
  image_alt: string | null;
  product_url: string | null;
};

function toProduct(row: ApiProduct): StudioProduct {
  return {
    id: row.product_id,
    title: row.title,
    price: row.price === null ? "" : formatMoney(Number(row.price), row.currency_code),
    image: row.image_url ?? "",
    url: row.product_url ?? "",
  };
}

/** Líneas de una lista ("- …", "1. …", "• …"); si no hay lista, el texto entero. */
export function parseSuggestions(text: string): string[] {
  const items = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^([-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-*•]|\d+[.)])\s+/, "").replace(/^\*\*|\*\*$/g, "").replace(/^[«"“]|[»"”]$/g, "").trim())
    .filter(Boolean);
  return items.length ? items.slice(0, 6) : [text.trim()];
}

function fieldsFromLegacy(draft: MarketingDraft, channel: StudioChannel, design: StudioDesign): StudioDesign {
  if ((draft.request?.design as { version?: unknown } | undefined)?.version === 2) return design;
  const button = (draft.blocks as Array<{ type?: string; content?: string; href?: string }>).find((block) => block?.type === "button");
  if (channel === "meta") {
    return { ...design, meta: { ...design.meta, texts: [draft.plain_text || ""], headline: draft.subject, desc: draft.preheader, cta: button?.content || design.meta.cta, url: button?.href || "" } };
  }
  if (channel === "ig") return { ...design, ig: { ...design.ig, caption: draft.plain_text || "" } };
  if (channel === "popup") return { ...design, popup: { ...design.popup, title: draft.subject, text: draft.plain_text } };
  return design;
}

export function ContentStudio({
  organizationId,
  connectionId,
  storeName,
  workspace,
  drafts,
  campaignTarget,
  onClearCampaignTarget,
  openRequest,
  startTemplate = null,
  onTemplateStarted,
  aiReady,
  onDraftsChanged,
  onCreated,
}: {
  organizationId: string;
  connectionId: string | null;
  storeName: string;
  workspace: KWorkspace | undefined;
  drafts: MarketingDraft[];
  campaignTarget: CampaignItem | null;
  onClearCampaignTarget: () => void;
  /** Pieza a abrir; `nonce` cambia en cada petición. */
  openRequest: { draft: MarketingDraft; nonce: number; asCopy?: boolean } | null;
  /** Plantilla de sistema con la que empezar (enlace desde la Biblioteca). */
  startTemplate?: string | null;
  onTemplateStarted?: () => void;
  aiReady: boolean;
  onDraftsChanged: () => void;
  onCreated: (draftId: string, channel: StudioChannel) => void;
}) {
  const askCopilot = useCopilotAsk();
  const connectionQuery = connectionId ? `connection_id=${encodeURIComponent(connectionId)}` : "";
  const brandQuery = useCachedQuery<{ profile: Record<string, unknown> | null }>(
    `/v1/organizations/${organizationId}/marketing/brand-profile${connectionId ? `?store_connection_id=${encodeURIComponent(connectionId)}` : ""}`,
  );
  const orgBrandQuery = useCachedQuery<{ profile: Record<string, unknown> | null }>(
    connectionId ? `/v1/organizations/${organizationId}/marketing/brand-profile` : null,
  );
  const bestQuery = useCachedQuery<{ products: ApiProduct[] }>(`/v1/organizations/${organizationId}/marketing/studio/products?source=best${connectionQuery ? `&${connectionQuery}` : ""}`);
  const brandBase: StudioBrand = brandFromProfile(brandQuery.data?.profile ?? orgBrandQuery.data?.profile ?? null, storeName);
  const bestProducts = (bestQuery.data?.products ?? []).map(toProduct);
  const storeUrl = (() => {
    const first = bestProducts.find((product) => isHttpUrl(product.url));
    return first ? new URL(first.url).origin : "";
  })();

  const [channel, setChannel] = useState<StudioChannel>("email");
  const [piece, setPiece] = useState<Piece>(() => ({ design: emptyDesign(), header: EMPTY_HEADER }));
  const [refs, setRefs] = useState<Partial<Record<StudioChannel, DraftRef>>>({});
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [finalView, setFinalView] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("bloques");
  const [rightTab, setRightTab] = useState<string>("email");
  const [pane, setPane] = useState<"left" | "center" | "right">("center");
  const [uploads, setUploads] = useState<ImageOption[]>([]);
  const [suggestions, setSuggestions] = useState<{ kind: AiKind; items: string[] } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [launcher, setLauncher] = useState(false);
  const [startMode, setStartMode] = useState<"brief" | "plantilla" | "repetir" | "klaviyo" | "blanco">("plantilla");
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [brief, setBrief] = useState({ channel: "email_klaviyo", objective: "launch", tone: "warm", offer: "", audience: "", instructions: "" });

  // Copias síncronas del estado: el autoguardado corre fuera del render y
  // necesita lo último aunque React no haya pintado todavía.
  const pieceRef = useRef(piece);
  const refsRef = useRef(refs);
  const dirty = useRef(new Set<StudioChannel>());
  const inFlight = useRef(new Set<StudioChannel>());
  const past = useRef<Piece[]>([]);
  const future = useRef<Piece[]>([]);
  const lastPush = useRef(0);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const forceHistory = () => setHistory({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 });

  const { design, header } = piece;
  const selected = design.blocks.find((block) => block.id === selectedId) ?? null;

  // ---------------------------------------------------------------- cambios

  const change = useCallback(
    (mutate: (current: Piece) => Piece, forChannel?: StudioChannel) => {
      const current = pieceRef.current;
      const next = mutate(current);
      if (next === current) return;
      const now = Date.now();
      // Escribir seguido cuenta como un solo paso de deshacer.
      if (now - lastPush.current > 700) {
        past.current = [...past.current.slice(-79), current];
        future.current = [];
        forceHistory();
      }
      lastPush.current = now;
      pieceRef.current = next;
      setPiece(next);
      dirty.current.add(forChannel ?? channel);
      setRevision((value) => value + 1);
    },
    [channel],
  );
  const changeDesign = (mutate: (current: StudioDesign) => StudioDesign) => change((current) => ({ ...current, design: mutate(current.design) }));
  const changeHeader = (key: keyof Header, value: string) => change((current) => ({ ...current, header: { ...current.header, [key]: value } }));
  const patchBlock = (id: string, props: Record<string, unknown>) =>
    changeDesign((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id ? ({ ...block, props: { ...block.props, ...props } } as StudioBlock) : block)) }));

  function undo() {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(pieceRef.current);
    lastPush.current = 0;
    pieceRef.current = previous;
    setPiece(previous);
    dirty.current.add(channel);
    setRevision((value) => value + 1);
    forceHistory();
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(pieceRef.current);
    lastPush.current = 0;
    pieceRef.current = next;
    setPiece(next);
    dirty.current.add(channel);
    setRevision((value) => value + 1);
    forceHistory();
  }

  function load(next: Piece, nextRefs: Partial<Record<StudioChannel, DraftRef>>, nextChannel: StudioChannel) {
    past.current = [];
    future.current = [];
    dirty.current.clear();
    pieceRef.current = next;
    setPiece(next);
    refsRef.current = nextRefs;
    setRefs(nextRefs);
    setChannel(nextChannel);
    setSelectedId(null);
    setSuggestions(null);
    setRightTab(nextChannel === "email" ? "email" : "pieza");
    setSave({ kind: "idle" });
    forceHistory();
  }

  // ---------------------------------------------------------------- guardar

  function hasContent(target: StudioChannel, current: Piece) {
    const d = current.design;
    if (target === "email") return d.blocks.length > 0;
    if (target === "meta") return d.meta.texts.some((text) => text.trim()) || Boolean(d.meta.headline.trim());
    if (target === "ig") return Boolean(d.ig.caption.trim()) || d.ig.imgs.length > 0;
    return Boolean(d.popup.title.trim() || d.popup.text.trim());
  }

  const payloadFor = useCallback(
    (target: StudioChannel, current: Piece) => {
      const d = current.design;
      const h = current.header;
      const name = h.name.trim() || h.subject.trim() || (campaignTarget?.title ?? "");
      const base = { channel: target, name, from_name: h.fromName, reply_to: h.replyTo.trim() || null, design: d, store_id: connectionId };
      if (target === "email") {
        const html = renderEmailHtml(d, { preheader: h.preheader, campaign: name || "nora" });
        return { ...base, subject: h.subject, preheader: h.preheader, html, plain_text: emailPlainText(d), blocks: d.blocks, personalization_tokens: collectMergeTokens(html, h.subject, h.preheader) };
      }
      if (target === "meta") {
        const text = d.meta.texts[d.meta.active] ?? d.meta.texts[0] ?? "";
        return { ...base, subject: d.meta.headline || name, preheader: d.meta.desc, html: renderSocialHtml(d, "meta"), plain_text: text, blocks: [{ type: "button", content: d.meta.cta, href: d.meta.url }], personalization_tokens: [] };
      }
      if (target === "ig") {
        return { ...base, subject: (d.ig.caption.split("\n")[0] ?? "").slice(0, 255) || name, preheader: "", html: renderSocialHtml(d, "ig"), plain_text: [d.ig.caption, d.ig.hashtags].filter(Boolean).join("\n\n"), blocks: [], personalization_tokens: [] };
      }
      return { ...base, subject: d.popup.title || name, preheader: "", html: renderPopupHtml(d), plain_text: [d.popup.title, d.popup.text, d.popup.button].filter(Boolean).join("\n"), blocks: [], personalization_tokens: [] };
    },
    [campaignTarget, connectionId],
  );

  const saveChannel = useCallback(
    async (target: StudioChannel): Promise<DraftRef | null> => {
      const current = pieceRef.current;
      if (!hasContent(target, current)) {
        dirty.current.delete(target);
        return refsRef.current[target] ?? null;
      }
      if (inFlight.current.has(target)) return null;
      inFlight.current.add(target);
      dirty.current.delete(target);
      setSave({ kind: "saving" });
      const existing = refsRef.current[target];
      try {
        const response = await apiFetch(
          existing ? `/v1/organizations/${organizationId}/marketing/studio/drafts/${existing.id}` : `/v1/organizations/${organizationId}/marketing/studio/drafts`,
          { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadFor(target, current)) },
          30_000,
        );
        if (!response.ok) {
          const message = await readApiError(response);
          dirty.current.add(target);
          setSave({ kind: "error", message });
          return null;
        }
        const body = (await response.json()) as { draft: { id: string; status: MarketingDraft["status"] }; returned_to_draft?: boolean };
        const ref = { id: body.draft.id, status: body.draft.status };
        refsRef.current = { ...refsRef.current, [target]: ref };
        setRefs(refsRef.current);
        setSave({ kind: "saved" });
        if (!existing) onCreated(ref.id, target);
        if (body.returned_to_draft) toast.info("La pieza vuelve a borrador: lo aprobado era la versión anterior.");
        onDraftsChanged();
        return ref;
      } catch {
        dirty.current.add(target);
        setSave({ kind: "error", message: "Sin conexión. Se reintentará al seguir editando." });
        return null;
      } finally {
        inFlight.current.delete(target);
      }
    },
    [onCreated, onDraftsChanged, organizationId, payloadFor],
  );

  useEffect(() => {
    if (!dirty.current.size) return;
    const timer = window.setTimeout(() => {
      for (const target of [...dirty.current]) void saveChannel(target);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [revision, saveChannel]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty.current.size || inFlight.current.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ---------------------------------------------------------------- abrir piezas

  const openDraft = useCallback(
    (draft: MarketingDraft, asCopy = false) => {
      const target = studioChannelOf(draft);
      const normalized = normalizeDesign(draft.request?.design, { aiBlocks: draft.blocks, html: draft.html, brand: brandBase });
      load(
        {
          design: fieldsFromLegacy(draft, target, normalized),
          header: { name: draft.template_name || "", subject: draft.subject || "", preheader: draft.preheader || "", fromName: draft.from_name || "", replyTo: draft.reply_to || "" },
        },
        // Como copia: pieza nueva que parte de esta; la original no se toca.
        asCopy ? {} : { [target]: { id: draft.id, status: draft.status } },
        target,
      );
      if (asCopy) {
        dirty.current.add(target);
        setRevision((value) => value + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la marca solo sirve de base para diseños sin marca propia
    [],
  );

  const lastNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!openRequest || lastNonce.current === openRequest.nonce) return;
    lastNonce.current = openRequest.nonce;
    openDraft(openRequest.draft, openRequest.asCopy);
  }, [openDraft, openRequest]);

  // Plantilla de sistema pedida por enlace: espera a tener marca y productos
  // para que salga ya rellena.
  const startedTemplate = useRef<string | null>(null);
  useEffect(() => {
    if (!startTemplate || startedTemplate.current === startTemplate || bestQuery.isLoading || brandQuery.isLoading) return;
    const template = SYSTEM_TEMPLATES.find((item) => item.id === startTemplate);
    if (!template) return;
    startedTemplate.current = startTemplate;
    startFromBlocks(template.build({ brand: brandBase, storeUrl, products: bestProducts }), { subject: template.subject, preheader: template.preheader, name: template.name });
    onTemplateStarted?.();
  });

  // Desde "Escribir la pieza" de una campaña: el brief ya viene escrito.
  const briefedCampaign = useRef<string | null>(null);
  useEffect(() => {
    if (!campaignTarget || briefedCampaign.current === campaignTarget.id) return;
    briefedCampaign.current = campaignTarget.id;
    const campaignChannel = toChannel(campaignTarget.channel);
    setBrief((current) => ({
      ...current,
      channel: campaignChannel,
      instructions: [
        campaignTarget.title,
        `Fecha prevista: ${fmtDate(campaignTarget.starts_at)}`,
        campaignTarget.description,
      ].filter(Boolean).join("\n\n"),
    }));
    setChannel(campaignChannel === "meta_ads" ? "meta" : campaignChannel === "instagram_organic" ? "ig" : "email");
    setStartMode("brief");
    setLauncher(true);
  }, [campaignTarget]);

  // Una plantilla importada de Klaviyo se abre en cuanto aparece en la lista.
  /* eslint-disable react-hooks/set-state-in-effect -- apertura única cuando llega el borrador importado */
  useEffect(() => {
    if (!pendingOpenId) return;
    const draft = drafts.find((item) => item.id === pendingOpenId);
    if (!draft) return;
    setPendingOpenId(null);
    openDraft(draft);
  }, [drafts, openDraft, pendingOpenId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function startFromBlocks(blocks: StudioBlock[], headerPatch: Partial<Header> = {}) {
    const next: Piece = {
      design: { ...emptyDesign(brandBase), blocks },
      header: { ...EMPTY_HEADER, fromName: workspace?.account?.default_from_label ?? storeName, name: campaignTarget?.title ?? "", ...headerPatch },
    };
    load(next, {}, "email");
    dirty.current.add("email");
    setRevision((value) => value + 1);
    setLauncher(false);
  }

  // ---------------------------------------------------------------- bloques

  function insertAt(index: number, blocks: StudioBlock[]) {
    if (!blocks.length) return;
    changeDesign((current) => {
      const next = [...current.blocks];
      next.splice(index, 0, ...blocks);
      return { ...current, blocks: next };
    });
    setSelectedId(blocks[blocks.length - 1]!.id);
    if (blocks.length === 1) setRightTab("bloque");
  }
  function afterSelected() {
    const index = design.blocks.findIndex((block) => block.id === selectedId);
    if (index > -1) return index + 1;
    const footer = design.blocks.findIndex((block) => block.type === "footer");
    return footer > -1 ? footer : design.blocks.length;
  }
  function blockOf(type: BlockType, extra: Record<string, unknown> = {}) {
    if (type === "products") return newBlock("products", { items: bestProducts.slice(0, 3), ...extra });
    if (type === "header") return newBlock("header", { logo: design.brand.logo, ...extra });
    if (type === "button" || type === "hero") return newBlock(type, { url: storeUrl, ...extra });
    return newBlock(type, extra);
  }
  function blockAct(action: "up" | "down" | "dup" | "ai" | "del", id: string) {
    if (action === "ai") {
      setSelectedId(id);
      setRightTab("ia");
      setPane("right");
      return;
    }
    changeDesign((current) => {
      const blocks = [...current.blocks];
      const index = blocks.findIndex((block) => block.id === id);
      if (index < 0) return current;
      if (action === "up" && index > 0) [blocks[index - 1], blocks[index]] = [blocks[index]!, blocks[index - 1]!];
      else if (action === "down" && index < blocks.length - 1) [blocks[index + 1], blocks[index]] = [blocks[index]!, blocks[index + 1]!];
      else if (action === "dup") blocks.splice(index + 1, 0, { ...structuredClone(blocks[index]!), id: newBlock("spacer").id });
      else if (action === "del") blocks.splice(index, 1);
      else return current;
      return { ...current, blocks };
    });
    if (action === "del") {
      if (selectedId === id) setSelectedId(null);
      toast.info("Bloque borrado. Ctrl+Z para recuperarlo.");
    }
  }
  function onDrop(index: number, payload: DropPayload) {
    if (payload.kind === "new") insertAt(index, [blockOf(payload.type)]);
    else if (payload.kind === "section") insertAt(index, (SECTIONS[payload.key]?.blocks ?? []).map((type) => blockOf(type)));
    else if (payload.kind === "img") insertAt(index, [newBlock("image", { src: payload.src, alt: payload.alt })]);
    else {
      changeDesign((current) => {
        const from = current.blocks.findIndex((block) => block.id === payload.id);
        if (from < 0) return current;
        const blocks = [...current.blocks];
        const [moved] = blocks.splice(from, 1);
        blocks.splice(from < index ? index - 1 : index, 0, moved!);
        return { ...current, blocks };
      });
      setSelectedId(payload.id);
    }
  }

  // ---------------------------------------------------------------- imágenes y productos

  const images: ImageOption[] = [];
  const seen = new Set<string>();
  const addImage = (src: string, label: string) => {
    if (src && !seen.has(src) && (isHttpUrl(src) || src.startsWith("data:"))) {
      seen.add(src);
      images.push({ src, label });
    }
  };
  uploads.forEach((image) => addImage(image.src, image.label));
  bestProducts.forEach((product) => addImage(product.image, product.title));
  design.blocks.forEach((block) => {
    if (block.type === "image") addImage(block.props.src, block.props.alt || "Imagen del email");
    if (block.type === "hero") addImage(block.props.img, block.props.alt || "Portada");
  });

  async function upload(file: File): Promise<string | null> {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      });
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/assets`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, content_base64: dataUrl }) },
        60_000,
      );
      if (!response.ok) throw new Error(await readApiError(response));
      const { url } = (await response.json()) as { url: string };
      setUploads((current) => [{ src: url, label: file.name }, ...current]);
      toast.success("Imagen subida");
      return url;
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo subir la imagen.");
      return null;
    }
  }

  async function loadProducts(source: "best" | "new" | "search", q = ""): Promise<StudioProduct[]> {
    const params = new URLSearchParams({ source });
    if (q.trim()) params.set("q", q.trim());
    if (connectionId) params.set("connection_id", connectionId);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/studio/products?${params}`);
      if (!response.ok) throw new Error(await readApiError(response));
      return ((await response.json()) as { products: ApiProduct[] }).products.map(toProduct);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudieron cargar los productos.");
      return [];
    }
  }

  function currentImage() {
    if (channel === "meta") return design.meta.img;
    if (channel === "popup") return design.popup.img;
    if (channel === "ig") return design.ig.imgs[0] ?? null;
    if (selected?.type === "image") return selected.props.src;
    if (selected?.type === "hero") return selected.props.img;
    return null;
  }
  function pickImage(image: ImageOption) {
    if (channel === "meta") return changeDesign((current) => ({ ...current, meta: { ...current.meta, img: image.src } }));
    if (channel === "popup") return changeDesign((current) => ({ ...current, popup: { ...current.popup, img: image.src } }));
    if (channel === "ig")
      return changeDesign((current) => ({
        ...current,
        ig: { ...current.ig, imgs: current.ig.imgs.includes(image.src) ? current.ig.imgs.filter((src) => src !== image.src) : [...current.ig.imgs, image.src].slice(0, 10) },
      }));
    if (selected?.type === "image") return patchBlock(selected.id, { src: image.src, alt: selected.props.alt || image.label });
    if (selected?.type === "hero") return patchBlock(selected.id, { img: image.src, alt: selected.props.alt || image.label });
    insertAt(afterSelected(), [newBlock("image", { src: image.src, alt: image.label })]);
  }

  // ---------------------------------------------------------------- revisión

  const emailHtml = channel === "email" ? renderEmailHtml(design, { preheader: header.preheader, campaign: header.name || header.subject || "nora" }) : "";
  const checks = reviewPiece(channel, design, { subject: header.subject, preheader: header.preheader }, new Blob([emailHtml]).size);
  const pendingChecks = checks.filter((check) => check.state !== "ok").length;
  const blocked = checks.some((check) => check.state === "bad");

  function fix(action: string) {
    if (action.startsWith("select:")) {
      setSelectedId(action.slice(7));
      setRightTab("bloque");
      document.querySelector(`[data-block="${action.slice(7)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (action.startsWith("tab:")) return setRightTab(action.slice(4));
    if (action === "utm")
      return changeDesign((current) => ({ ...current, blocks: current.blocks.map((block) => (block.type === "button" || block.type === "hero" ? ({ ...block, props: { ...block.props, utm: true } } as StudioBlock) : block)) }));
    if (action === "footer") return insertAt(design.blocks.length, [newBlock("footer")]);
    if (action === "addvariant") {
      setRightTab("pieza");
      return changeDesign((current) => ({ ...current, meta: { ...current.meta, texts: [...current.meta.texts, ""], active: current.meta.texts.length } }));
    }
    if (action === "metautm") return changeDesign((current) => ({ ...current, meta: { ...current.meta, url: withUtm(current.meta.url, header.name || "meta", "paid_social", "meta") } }));
  }

  async function submitForReview() {
    const ref = refs[channel];
    if (ref && ref.status !== "draft") {
      toast.info(ref.status === "pending_approval" ? "Ya está en revisión." : "Cambia algo para volver a enviarla a revisión.");
      return;
    }
    if (blocked) {
      setRightTab("calidad");
      setPane("right");
      toast.danger(`Antes de enviarla: ${checks.find((check) => check.state === "bad")!.title.toLowerCase()}.`);
      return;
    }
    setSubmitting(true);
    try {
      const saved = dirty.current.has(channel) || !ref ? await saveChannel(channel) : ref;
      if (!saved) return;
      const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/drafts/${saved.id}/submit`, { method: "POST" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      refsRef.current = { ...refsRef.current, [channel]: { id: saved.id, status: "pending_approval" } };
      setRefs(refsRef.current);
      onDraftsChanged();
      toast.success("Enviada a revisión. La verás en Contenido.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendTest() {
    if (!header.subject.trim()) {
      setRightTab("email");
      toast.danger("Escribe el asunto antes de mandar la prueba.");
      return;
    }
    setTesting(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/studio/test-send`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: header.subject, html: emailHtml }) },
        30_000,
      );
      if (!response.ok) toast.danger(await readApiError(response));
      else toast.success(`Prueba enviada a ${((await response.json()) as { sent_to: string }).sent_to}, con datos de ejemplo.`);
    } finally {
      setTesting(false);
    }
  }

  // ---------------------------------------------------------------- IA

  function ask(kind: AiKind) {
    const target = selected;
    const brandName = design.brand.logo || storeName;
    const context =
      channel === "email"
        ? `Asunto actual: «${header.subject}». Preheader: «${header.preheader}». Contenido del email:\n${emailPlainText(design).slice(0, 2500)}`
        : channel === "meta"
          ? `Anuncio de Meta. Titular: «${design.meta.headline}». Texto: «${design.meta.texts[design.meta.active] ?? ""}».`
          : channel === "ig"
            ? `Publicación de Instagram. Texto: «${design.ig.caption}».`
            : `Popup de suscripción. Título: «${design.popup.title}». Texto: «${design.popup.text}».`;
    const list = "Devuelve cada propuesta en una línea que empiece por «- », sin comentarios entre medias.";
    const questions: Record<AiKind, string> = {
      subjects:
        channel === "email"
          ? `Propón 3 asuntos para este email de ${brandName}. Máximo 50 caracteres cada uno, sin palabras de spam ni urgencia falsa. Formato de cada línea: «- asunto | preheader». ${list}`
          : channel === "meta"
            ? `Propón 3 textos principales para este anuncio de ${brandName}, de 125 caracteres o menos. ${list}`
            : channel === "ig"
              ? `Propón 3 textos para esta publicación de Instagram de ${brandName}, con una primera línea que enganche. ${list}`
              : `Propón 3 títulos para este popup de ${brandName}, de 40 caracteres o menos. ${list}`,
      titles: `Propón 3 títulos alternativos a «${target?.type === "hero" ? target.props.title : target?.type === "heading" ? target.props.text : ""}» para este email de ${brandName}. Que digan el beneficio, máximo 60 caracteres. ${list}`,
      cta: `Propón 3 textos de botón alternativos a «${target?.type === "button" ? target.props.label : target?.type === "hero" ? target.props.cta : ""}». De 2 a 4 palabras, empezando por un verbo. ${list}`,
      shorter: `Reescribe este texto más corto sin perder lo importante y sin inventar datos: «${target?.type === "text" ? target.props.text : ""}». Da 2 versiones. ${list}`,
      tone: `Revisa el tono de esta pieza de ${brandName} contra su Guía de marca: qué encaja, qué no y qué cambiarías (frases concretas).`,
      free: `${prompt.trim()}\n\nSi propones textos para la pieza, pon cada uno en una línea que empiece por «- ».`,
    };
    askCopilot({
      question: `${questions[kind]}\n\n${context}\nObjetivo: ${design.objective}. Tono: ${design.tone}. No inventes precios, descuentos ni datos.`,
      focusLabel: header.name || "Pieza del estudio",
      reference: refsRef.current[channel]?.id
        ? { kind: "entity", entity: { type: "marketing_draft", id: refsRef.current[channel]!.id } }
        : { kind: "section", filters: { studioChannel: channel } },
      saveLabel: "Llevar al editor",
      savedLabel: "Llevado al editor.",
      saveAnswer: async (text) => {
        setSuggestions({ kind, items: kind === "tone" ? [text.trim()] : parseSuggestions(text) });
        setRightTab("ia");
      },
    });
  }

  async function sendChat(text: string) {
    const history = chat.filter((message) => !message.error).map(({ role, text: body }) => ({ role, text: body }));
    setChat((current) => [...current, { role: "user", text }]);
    setChatBusy(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/studio/ai-chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(studioChatBody({ message: text, history, design: pieceRef.current.design, header: pieceRef.current.header, selectedId, connectionId })),
        },
        120_000,
      );
      if (response.status === 402) {
        const body = (await response.json().catch(() => null)) as { message?: string; can_upgrade?: boolean } | null;
        setChat((current) => [...current, { role: "assistant", text: body?.message ?? "Se ha agotado el saldo de IA de este mes.", error: true, upgrade: body?.can_upgrade ? "yes" : "ask" }]);
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response));
      const data = (await response.json()) as { answer: string; ops: StudioChatOp[] };
      let labels: string[] = [];
      let touched: string[] = [];
      if (data.ops.length) {
        lastPush.current = 0; // cada respuesta es un solo paso de deshacer
        change((current) => {
          const out = applyStudioOps(current.design, current.header, data.ops);
          labels = out.labels;
          touched = out.touched;
          return { ...current, design: out.design, header: { ...current.header, subject: out.header.subject, preheader: out.header.preheader } };
        });
        if (touched[0]) setSelectedId(touched[0]);
      }
      setChat((current) => [...current, { role: "assistant", text: data.answer, labels }]);
    } catch (error) {
      setChat((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo hablar con la IA.", error: true }]);
    } finally {
      setChatBusy(false);
    }
  }

  function applySuggestion(text: string) {
    const kind = suggestions?.kind;
    if (kind === "subjects") {
      if (channel === "email") {
        const [subject, preheader] = text.split("|").map((part) => part.trim());
        change((current) => ({ ...current, header: { ...current.header, subject: subject ?? current.header.subject, preheader: preheader || current.header.preheader } }));
      } else if (channel === "meta") changeDesign((current) => ({ ...current, meta: { ...current.meta, texts: current.meta.texts.map((value, index) => (index === current.meta.active ? text : value)) } }));
      else if (channel === "ig") changeDesign((current) => ({ ...current, ig: { ...current.ig, caption: text } }));
      else changeDesign((current) => ({ ...current, popup: { ...current.popup, title: text } }));
    } else if (selected && (kind === "titles" || kind === "cta" || kind === "shorter")) {
      const key = kind === "titles" ? (selected.type === "hero" ? "title" : "text") : kind === "cta" ? (selected.type === "hero" ? "cta" : "label") : "text";
      patchBlock(selected.id, { [key]: text });
    } else if (kind === "free" && selected) {
      const key = selected.type === "button" ? "label" : selected.type === "hero" ? "title" : "text";
      patchBlock(selected.id, { [key]: text });
    }
    toast.success("Aplicado. Ctrl+Z para deshacer.");
  }

  async function generateFromBrief() {
    setGenerating(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: "campaign",
            channel: brief.channel,
            store_id: connectionId,
            brief: buildMarketingBrief({ channel: brief.channel, objective: brief.objective, audience: brief.audience, offer: brief.offer, tone: brief.tone, cta: "", instructions: brief.instructions }),
            ...(brief.channel === "email_klaviyo" ? { brand_colors: { primary: brandBase.primary, background: brandBase.bg, text: brandBase.text } } : {}),
          }),
        },
        180_000,
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const { draft } = (await response.json()) as { draft: Partial<MarketingDraft> & { id: string } };
      const full: MarketingDraft = {
        template_name: "",
        from_name: "",
        reply_to: null,
        ...draft,
        request: draft.request ?? { channel: brief.channel },
        blocks: draft.blocks ?? [],
        subject: draft.subject ?? "",
        preheader: draft.preheader ?? "",
        plain_text: draft.plain_text ?? "",
        html: draft.html ?? "",
      } as MarketingDraft;
      openDraft(full);
      const target = studioChannelOf(full);
      if (target === "email") {
        // La IA escribe el cuerpo; cabecera, marca y pie legal los pone el estudio.
        changeDesign((current) => ({
          ...current,
          blocks: [
            ...(current.blocks[0]?.type === "header" ? [] : [newBlock("header", { logo: current.brand.logo })]),
            ...current.blocks,
            ...(current.blocks.some((block) => block.type === "footer") ? [] : [newBlock("footer")]),
          ],
        }));
      }
      // La generación por brief ya persiste un borrador antes del guardado
      // manual del lienzo; enlázalo ahora para que no se pierda la relación
      // con el item del calendario.
      if (campaignTarget) onCreated(full.id, target);
      setLauncher(false);
      setRightTab("calidad");
      onDraftsChanged();
      toast.success("Pieza escrita por la IA. Revísala bloque a bloque.");
    } catch {
      toast.danger("La IA tardó demasiado o se cortó la conexión. Vuelve a intentarlo.");
    } finally {
      setGenerating(false);
    }
  }

  // ---------------------------------------------------------------- teclado

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !inField) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (inField || !selectedId || channel !== "email") return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        blockAct("del", selectedId);
      } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        blockAct(event.key === "ArrowUp" ? "up" : "down", selectedId);
      } else if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ---------------------------------------------------------------- render

  const ref = refs[channel];
  const status = ref?.status ?? "draft";
  const audiences = [
    ...(workspace?.audiences?.lists ?? []).map((list) => ({ id: list.id, name: list.name, size: list.size })),
    ...(workspace?.audiences?.segments ?? []).map((segment) => ({ id: segment.id, name: segment.name, size: segment.size })),
  ];
  const reach = audiences.filter((audience) => design.send.audiences.includes(audience.id)).reduce((sum, audience) => sum + (audience.size ?? 0), 0);
  const winners = drafts
    .filter((draft) => (draft.template_performance?.revenue ?? 0) > 0 && studioChannelOf(draft) === "email")
    .sort((a, b) => (b.template_performance?.revenue ?? 0) - (a.template_performance?.revenue ?? 0))
    .slice(0, 5);

  const rightTabs: Array<[string, string, number | undefined]> =
    channel === "email"
      ? [["bloque", "Bloque", undefined], ["email", "Email", undefined], ["calidad", "Revisión", pendingChecks], ["ia", "IA", undefined]]
      : [["pieza", "Pieza", undefined], ["calidad", "Revisión", pendingChecks], ["ia", "IA", undefined]];
  const activeRight = rightTabs.some(([key]) => key === rightTab) ? rightTab : rightTabs[0]![0];

  let rightBody: ReactNode = null;
  if (activeRight === "bloque") {
    rightBody = selected ? (
      <BlockInspector
        key={selected.id}
        block={selected}
        index={design.blocks.indexOf(selected)}
        total={design.blocks.length}
        design={design}
        pieceName={header.name || header.subject}
        images={images}
        onChange={(key, value) => patchBlock(selected.id, setPath(selected.props, key, value) as Record<string, unknown>)}
        onUpload={upload}
        onAct={blockAct}
        onAi={(kind) => ask(kind)}
        loadProducts={loadProducts}
      />
    ) : (
      <div className={s.card}>
        <b>Ningún bloque seleccionado</b>
        <p className={s.note}>Haz clic en cualquier parte del email para ver sus ajustes. Los textos se escriben directamente sobre el email.</p>
      </div>
    );
  } else if (activeRight === "email") {
    rightBody = (
      <>
        <Fields
          id="header"
          values={header}
          brand={design.brand}
          images={images}
          onUpload={upload}
          onChange={(key, value) => changeHeader(key as keyof Header, String(value))}
          schema={[
            { k: "subject", label: "Asunto", kind: "text", limit: 50 },
            { k: "preheader", label: "Preheader", kind: "text", limit: 90 },
            { k: "fromName", label: "Remitente", kind: "text" },
            { k: "replyTo", label: "Responder a (opcional)", kind: "text" },
          ]}
        />
        <button type="button" className={`${s.btn} ${s.sm}`} onClick={() => ask("subjects")} disabled={!aiReady}>
          <Icon name="spark" />
          Proponer asuntos con IA
        </button>
        <div className={s.f}>
          <span className={s.lbl}>
            Enviar a <span className={s.count}>{reach ? `~${reach.toLocaleString("es-ES")} personas` : ""}</span>
          </span>
          {audiences.length ? (
            <div className={s.opts}>
              {audiences.map((audience) => (
                <button
                  key={audience.id}
                  type="button"
                  className={s.opt}
                  aria-pressed={design.send.audiences.includes(audience.id)}
                  onClick={() =>
                    changeDesign((current) => ({
                      ...current,
                      send: {
                        ...current.send,
                        audiences: current.send.audiences.includes(audience.id) ? current.send.audiences.filter((id) => id !== audience.id) : [...current.send.audiences, audience.id],
                        exclude: current.send.exclude.filter((id) => id !== audience.id),
                      },
                    }))
                  }
                >
                  {audience.name}
                  {audience.size != null ? ` · ${audience.size.toLocaleString("es-ES")}` : ""}
                </button>
              ))}
            </div>
          ) : (
            <p className={s.note}>Conecta Klaviyo para elegir listas y segmentos.</p>
          )}
        </div>
        {audiences.length ? (
          <div className={s.f}>
            <span className={s.lbl}>Excluir</span>
            <div className={s.opts}>
              {audiences
                .filter((audience) => !design.send.audiences.includes(audience.id))
                .map((audience) => (
                  <button
                    key={audience.id}
                    type="button"
                    className={s.opt}
                    aria-pressed={design.send.exclude.includes(audience.id)}
                    onClick={() =>
                      changeDesign((current) => ({
                        ...current,
                        send: { ...current.send, exclude: current.send.exclude.includes(audience.id) ? current.send.exclude.filter((id) => id !== audience.id) : [...current.send.exclude, audience.id] },
                      }))
                    }
                  >
                    {audience.name}
                  </button>
                ))}
            </div>
          </div>
        ) : null}
        <Fields
          id="send"
          values={design}
          brand={design.brand}
          images={images}
          onUpload={upload}
          onChange={(key, value) => changeDesign((current) => setPath(current, key, value))}
          schema={[
            { k: "send.smart", label: "Smart Sending: no repetir a quien recibió un email hace menos de 16 h", kind: "toggle" },
            { k: "objective", label: "Objetivo", kind: "select", options: [["launch", "Lanzamiento"], ["conversion", "Conversión / ventas"], ["retention", "Retención / recompra"], ["engagement", "Engagement"], ["winback", "Reactivación"]] },
            { k: "tone", label: "Tono", kind: "select", options: [["brand", "Alineado con la marca"], ["direct", "Directo y orientado a venta"], ["educational", "Educativo"], ["warm", "Cercano y cálido"], ["urgent", "Urgente, sin presión artificial"]] },
          ]}
        />
        <p className={s.note}>Las audiencias y Smart Sending se usan al programar la campaña desde Campañas. Objetivo y tono los usa la IA.</p>
      </>
    );
  } else if (activeRight === "pieza") {
    const pieceSchema =
      channel === "meta"
        ? null
        : channel === "ig"
          ? [
              { k: "ig.caption", label: "Texto", kind: "textarea" as const, limit: 2200 },
              { k: "ig.hashtags", label: "Hashtags", kind: "text" as const },
              { k: "ig.firstComment", label: "Primer comentario", kind: "text" as const },
            ]
          : [
              { k: "popup.title", label: "Título", kind: "text" as const, limit: 40 },
              { k: "popup.text", label: "Texto", kind: "textarea" as const, limit: 120 },
              { k: "popup.placeholder", label: "Campo de email", kind: "text" as const },
              { k: "popup.button", label: "Botón", kind: "text" as const, limit: 25 },
              { k: "popup.img", label: "Imagen", kind: "image" as const },
              { k: "popup.trigger", label: "Cuándo aparece", kind: "select" as const, options: [["8s", "A los 8 segundos"], ["scroll", "Al bajar el 50 %"], ["exit", "Al ir a salir"]] as Array<[string, string]> },
              { k: "popup.consent", label: "Consentimiento", kind: "textarea" as const },
            ];
    rightBody = (
      <>
        {channel === "meta" ? (
          <>
            <div className={s.f}>
              <span className={s.lbl}>
                Texto principal <span className={s.count}>Meta prueba hasta 5</span>
              </span>
              {design.meta.texts.map((text, index) => (
                <div key={index} className={s.variant} data-on={design.meta.active === index}>
                  <span className={s.l}>{String.fromCharCode(65 + index)}</span>
                  <div>
                    <textarea
                      className={s.inp}
                      aria-label={`Texto ${String.fromCharCode(65 + index)}`}
                      value={text}
                      onFocus={() => changeDesign((current) => (current.meta.active === index ? current : { ...current, meta: { ...current.meta, active: index } }))}
                      onChange={(event) => changeDesign((current) => ({ ...current, meta: { ...current.meta, texts: current.meta.texts.map((value, i) => (i === index ? event.target.value : value)) } }))}
                    />
                    <span className={s.count} data-state={text.length > 125 ? "over" : undefined}>
                      {text.length}/125 · {text.length > 125 ? "se corta con «Ver más»" : "se ve entero"}
                    </span>
                  </div>
                  <button type="button" className={s.ibtn} aria-label="Quitar" disabled={design.meta.texts.length < 2} onClick={() => changeDesign((current) => ({ ...current, meta: { ...current.meta, texts: current.meta.texts.filter((_, i) => i !== index), active: 0 } }))}>
                    <Icon name="x" />
                  </button>
                </div>
              ))}
              {design.meta.texts.length < 5 ? (
                <button type="button" className={`${s.btn} ${s.sm}`} onClick={() => fix("addvariant")}>
                  <Icon name="plus" />
                  Añadir texto
                </button>
              ) : null}
            </div>
            <Fields
              id="meta"
              values={design}
              brand={design.brand}
              images={images}
              onUpload={upload}
              onChange={(key, value) => changeDesign((current) => setPath(current, key, value))}
              schema={[
                { k: "meta.headline", label: "Titular", kind: "text", limit: 40 },
                { k: "meta.desc", label: "Descripción", kind: "text", limit: 30 },
                { k: "meta.cta", label: "Botón", kind: "select", options: [["Comprar", "Comprar"], ["Más información", "Más información"], ["Ver más", "Ver más"], ["Registrarte", "Registrarte"]] },
                { k: "meta.url", label: "Enlace de destino", kind: "url" },
                { k: "meta.img", label: "Imagen", kind: "image" },
              ]}
            />
            <p className={s.note}>Cuando se apruebe, el plan de Meta se prepara desde Contenido y se crea en pausa: no se gasta nada hasta que lo actives.</p>
          </>
        ) : (
          <Fields id={channel} values={design} brand={design.brand} images={images} onUpload={upload} onChange={(key, value) => changeDesign((current) => setPath(current, key, value))} schema={pieceSchema!} />
        )}
        {channel === "ig" ? (
          <button
            type="button"
            className={s.btn}
            onClick={() =>
              navigator.clipboard
                ?.writeText([design.ig.caption, design.ig.hashtags].filter(Boolean).join("\n\n"))
                .then(() => toast.success("Texto copiado"), () => toast.danger("El navegador no deja copiar desde aquí."))
            }
          >
            <Icon name="copy" />
            Copiar texto para Instagram
          </button>
        ) : null}
        {channel === "popup" ? <p className={s.note}>Klaviyo no deja crear formularios desde fuera: cuando se apruebe, copia los textos en su editor de formularios.</p> : null}
      </>
    );
  } else if (activeRight === "calidad") {
    rightBody = <ReviewPanel checks={checks} onFix={fix} />;
  } else {
    rightBody = (
      <AiPanel
        channel={channel}
        block={selected}
        suggestions={suggestions}
        prompt={prompt}
        onPrompt={setPrompt}
        onAsk={ask}
        onApply={applySuggestion}
        onClear={() => setSuggestions(null)}
        aiReady={aiReady}
        chat={
          channel === "email" ? (
            <StudioChat messages={chat} busy={chatBusy} aiReady={aiReady} canUndo={history.canUndo} onSend={(value) => void sendChat(value)} onUndo={undo} />
          ) : undefined
        }
      />
    );
  }

  const savedLabel =
    save.kind === "saving" ? "Guardando…" : save.kind === "error" ? `No se ha guardado: ${save.message ?? ""}` : save.kind === "saved" ? "Guardado" : ref ? "Guardado" : "Sin guardar";

  return (
    <div className={s.studio}>
      <header className={s.top}>
        <div className={s.piece}>
          <h1 className={s.crumb}>Crear contenido</h1>
          <input className={s.pieceName} aria-label="Nombre interno de la pieza" placeholder="Nombre de la pieza" value={header.name} onChange={(event) => changeHeader("name", event.target.value)} />
          <div className={s.pills}>
            <span className={s.pill} data-state={status}>
              <i />
              {STATUS_LABEL[status]}
            </span>
            {campaignTarget ? (
              <button type="button" className={s.pill} title="Desvincular" onClick={onClearCampaignTarget}>
                Campaña: {campaignTarget.title} · {fmtDate(campaignTarget.starts_at)} ✕
              </button>
            ) : null}
          </div>
        </div>
        <div className={s.channels} role="group" aria-label="Canal">
          {CHANNELS.map(([key, label, icon]) => (
            <button key={key} type="button" aria-pressed={channel === key} onClick={() => { setChannel(key); setSelectedId(null); setSuggestions(null); }}>
              <Icon name={icon} />
              {label}
              {refs[key] ? <i title="Tiene borrador guardado" /> : null}
            </button>
          ))}
        </div>
        <div className={s.topActions}>
          <span className={s.saved} data-error={save.kind === "error"} role="status">
            {savedLabel}
          </span>
          <button type="button" className={s.tbtn} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled={!history.canUndo} onClick={undo}>
            <Icon name="undo" />
          </button>
          <button type="button" className={s.tbtn} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" disabled={!history.canRedo} onClick={redo}>
            <Icon name="redo" />
          </button>
          <button type="button" className={s.tbtn} onClick={() => setLauncher(true)}>
            <Icon name="plus" />
            Nueva pieza
          </button>
          {channel === "email" ? (
            <button type="button" className={s.tbtn} disabled={testing || !design.blocks.length} onClick={() => void sendTest()}>
              <Icon name="send" />
              {testing ? "Enviando…" : "Enviar prueba"}
            </button>
          ) : null}
          <button type="button" className={`${s.tbtn} ${s.primary}`} disabled={submitting || !hasContent(channel, piece)} onClick={() => void submitForReview()}>
            {submitting ? "Enviando…" : status === "pending_approval" ? "En revisión" : "Enviar a revisión"}
          </button>
        </div>
      </header>
      {!aiReady ? <div className={s.banner}>La IA no está configurada en el servidor: puedes diseñar y guardar, pero no pedir textos.</div> : null}
      <nav className={s.mswitch} aria-label="Panel">
        {(
          [
            ["left", "Añadir"],
            ["center", "Lienzo"],
            ["right", "Ajustes"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={pane === key} onClick={() => setPane(key)}>
            {label}
          </button>
        ))}
      </nav>
      <div className={s.work} data-pane={pane}>
        <aside className={`${s.pane} ${s.left}`} aria-label="Añadir contenido">
          <LeftPanel
            channel={channel}
            tab={leftTab}
            onTab={setLeftTab}
            design={design}
            selectedId={selectedId}
            images={images}
            currentImage={currentImage()}
            onAdd={(type) => {
              insertAt(afterSelected(), [blockOf(type)]);
              setPane("center");
            }}
            onAddSection={(key) => insertAt(afterSelected(), (SECTIONS[key]?.blocks ?? []).map((type) => blockOf(type)))}
            onSelect={(id) => {
              setSelectedId(id);
              setRightTab("bloque");
              document.querySelector(`[data-block="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
            }}
            onMove={(action, id) => blockAct(action, id)}
            onPickImage={pickImage}
            onUpload={upload}
            onBrand={(key, value) => changeDesign((current) => ({ ...current, brand: setPath(current.brand, key, value) }))}
            onResetBrand={() => changeDesign((current) => ({ ...current, brand: brandBase }))}
          />
        </aside>
        <section className={s.center} aria-label="Lienzo">
          {channel === "email" ? (
            <>
              <div className={s.ctool}>
                <div className={s.seg} role="group" aria-label="Dispositivo">
                  <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>
                    <Icon name="desktop" />
                    Escritorio
                  </button>
                  <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>
                    <Icon name="phone" />
                    Móvil
                  </button>
                </div>
                <div className={s.seg} role="group" aria-label="Vista">
                  <button type="button" aria-pressed={!finalView} onClick={() => setFinalView(false)}>
                    Editar
                  </button>
                  <button type="button" aria-pressed={finalView} onClick={() => setFinalView(true)}>
                    <Icon name="eye" />
                    HTML final
                  </button>
                </div>
                {reach ? <span className={s.chk}>Para ~{reach.toLocaleString("es-ES")} personas</span> : null}
              </div>
              <div className={s.ibLabel}>
                <span>Así llega a la bandeja</span>
                <span>Gmail · {mobile ? "móvil" : "escritorio"}</span>
              </div>
              <div className={s.inbox} data-mobile={mobile}>
                <div className={s.ibAv} style={{ background: design.brand.primary }}>
                  {(header.fromName || storeName).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className={s.ibTop}>
                    <b>{header.fromName || storeName}</b>
                    <time>10:24</time>
                  </div>
                  <div className={s.ibSub}>{header.subject || <span className={s.muted}>Sin asunto</span>}</div>
                  <div className={s.ibPre}>{header.preheader || <span className={s.muted}>Sin preheader: Gmail enseñará el primer texto del email</span>}</div>
                </div>
              </div>
              <div className={s.stage}>
                {finalView ? (
                  <iframe className={s.finalFrame} data-mobile={mobile} title="HTML final del email" sandbox="" srcDoc={emailHtml} />
                ) : (
                  <EmailCanvas
                    design={design}
                    selectedId={selectedId}
                    mobile={mobile}
                    onSelect={(id) => {
                      setSelectedId(id);
                      if (rightTab !== "ia") setRightTab("bloque");
                    }}
                    onPatch={patchBlock}
                    onAction={blockAct}
                    onDrop={onDrop}
                  />
                )}
              </div>
            </>
          ) : channel === "meta" ? (
            <>
              <div className={s.ctool}>
                <div className={s.seg} role="group" aria-label="Formato">
                  {(
                    [
                      ["feed", "Feed 1:1"],
                      ["story", "Stories 9:16"],
                    ] as const
                  ).map(([format, label]) => (
                    <button key={format} type="button" aria-pressed={design.meta.format === format} onClick={() => changeDesign((current) => ({ ...current, meta: { ...current.meta, format } }))}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className={s.seg} role="group" aria-label="Texto que se ve">
                  {design.meta.texts.map((_, index) => (
                    <button key={index} type="button" aria-pressed={design.meta.active === index} onClick={() => changeDesign((current) => ({ ...current, meta: { ...current.meta, active: index } }))}>
                      Texto {String.fromCharCode(65 + index)}
                    </button>
                  ))}
                </div>
              </div>
              <MetaPreview design={design} pageName={storeName} />
            </>
          ) : channel === "ig" ? (
            <>
              <div className={s.ctool}>
                <span className={s.chk}>
                  {design.ig.imgs.length} imagen{design.ig.imgs.length === 1 ? "" : "es"} · elige o quita en «Imágenes»
                </span>
                <span className={s.chk}>Se publica a mano: aquí queda el texto listo para copiar</span>
              </div>
              <IgPreview design={design} account={storeName.toLowerCase().replace(/\s+/g, "")} />
            </>
          ) : (
            <>
              <div className={s.ctool}>
                <span className={s.chk}>Aparece {({ "8s": "a los 8 segundos", scroll: "al bajar el 50 %", exit: "al ir a salir" } as const)[design.popup.trigger]}</span>
              </div>
              <PopupPreview design={design} />
            </>
          )}
        </section>
        <aside className={`${s.pane} ${s.right}`} aria-label="Ajustes">
          <div className={s.tabs} role="tablist" aria-label="Ajustes">
            {rightTabs.map(([key, label, count]) => (
              <button key={key} type="button" role="tab" aria-selected={activeRight === key} onClick={() => setRightTab(key)}>
                {label}
                {count !== undefined ? (
                  <span className={s.badge} data-tone={blocked ? "bad" : count ? "warn" : "good"}>
                    {count || "✓"}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className={s.pbody}>{rightBody}</div>
        </aside>
      </div>

      <Dialog isOpen={launcher} onOpenChange={setLauncher} size="xl" title="Nueva pieza">
                <div className={`${s.studio} ${s.dialog}`}>
                  <div className={s.starts}>
                    {(
                      [
                        ["plantilla", "template", "Desde una plantilla", "Maquetas de NORA con tu marca"],
                        ["brief", "spark", "Con IA, desde un brief", "Cuéntale qué quieres"],
                        ["repetir", "again", "Repetir lo que funcionó", "Tus envíos con más resultado"],
                        ["klaviyo", "klaviyo", "Importar de Klaviyo", "Una plantilla que ya tienes"],
                        ["blanco", "blank", "En blanco", "Solo cabecera y pie"],
                      ] as const
                    ).map(([key, icon, title, detail]) => (
                      <button key={key} type="button" className={s.start} aria-pressed={startMode === key} onClick={() => setStartMode(key)}>
                        <span className={s.g}>
                          <Icon name={icon} />
                        </span>
                        <span>
                          <b>{title}</b>
                          <small>{detail}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className={s.fields} style={{ minWidth: 0 }}>
                    {startMode === "plantilla" ? (
                      <div className={s.optList}>
                        {SYSTEM_TEMPLATES.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            className={s.pick}
                            onClick={() => startFromBlocks(template.build({ brand: brandBase, storeUrl, products: bestProducts }), { subject: template.subject, preheader: template.preheader, name: campaignTarget?.title ?? template.name })}
                          >
                            <span>
                              <b>{template.name}</b>
                              <small>{template.description}</small>
                            </span>
                            <Icon name="plus" />
                          </button>
                        ))}
                        <p className={s.note}>Se rellenan con tu marca, tu web y tus productos más vendidos. Lo que solo sabes tú va entre corchetes.</p>
                      </div>
                    ) : startMode === "brief" ? (
                      <>
                        <div className={s.briefGrid}>
                          <div className={s.f}>
                            <label className={s.lbl} htmlFor="st-brief-channel">
                              Canal
                            </label>
                            <select id="st-brief-channel" className={s.inp} value={brief.channel} onChange={(event) => setBrief({ ...brief, channel: event.target.value })}>
                              <option value="email_klaviyo">Email</option>
                              <option value="meta_ads">Anuncio de Meta</option>
                              <option value="instagram_organic">Instagram</option>
                            </select>
                          </div>
                          <div className={s.f}>
                            <label className={s.lbl} htmlFor="st-brief-objective">
                              Objetivo
                            </label>
                            <select id="st-brief-objective" className={s.inp} value={brief.objective} onChange={(event) => setBrief({ ...brief, objective: event.target.value })}>
                              <option value="launch">Lanzamiento</option>
                              <option value="conversion">Conversión / ventas</option>
                              <option value="retention">Retención / recompra</option>
                              <option value="winback">Reactivación</option>
                            </select>
                          </div>
                          <div className={s.f}>
                            <label className={s.lbl} htmlFor="st-brief-offer">
                              Producto u oferta
                            </label>
                            <input id="st-brief-offer" className={s.inp} value={brief.offer} onChange={(event) => setBrief({ ...brief, offer: event.target.value })} />
                          </div>
                          <div className={s.f}>
                            <label className={s.lbl} htmlFor="st-brief-audience">
                              Para quién
                            </label>
                            <input id="st-brief-audience" className={s.inp} value={brief.audience} onChange={(event) => setBrief({ ...brief, audience: event.target.value })} />
                          </div>
                        </div>
                        <div className={s.f}>
                          <label className={s.lbl} htmlFor="st-brief-text">
                            Qué quieres contar
                          </label>
                          <textarea
                            id="st-brief-text"
                            className={s.inp}
                            value={brief.instructions}
                            placeholder="Ej.: presenta la colección nueva, menciona el taller y cierra con un botón a la tienda. Frases literales entre comillas. No inventes descuentos."
                            onChange={(event) => setBrief({ ...brief, instructions: event.target.value })}
                          />
                        </div>
                        <div className={s.row}>
                          <button type="button" className={`${s.btn} ${s.primary}`} disabled={!aiReady || generating || !brief.instructions.trim()} onClick={() => void generateFromBrief()}>
                            <Icon name="spark" />
                            {generating ? "Escribiendo… (hasta 1 minuto)" : "Escribir la pieza"}
                          </button>
                          {!aiReady ? <span className={s.note}>La IA no está configurada en el servidor.</span> : null}
                        </div>
                      </>
                    ) : startMode === "repetir" ? (
                      winners.length ? (
                        <div className={s.optList}>
                          <p className={s.note}>Tus emails con más ingresos atribuidos por Klaviyo. Se copian los bloques, no los resultados.</p>
                          {winners.map((draft) => (
                            <button
                              key={draft.id}
                              type="button"
                              className={s.pick}
                              onClick={() => {
                                const copy = normalizeDesign(draft.request?.design, { aiBlocks: draft.blocks, html: draft.html, brand: brandBase });
                                startFromBlocks(copy.blocks.map((block) => ({ ...block, id: newBlock("spacer").id })), { subject: draft.subject, preheader: draft.preheader, name: `${draft.template_name || draft.subject} (copia)` });
                              }}
                            >
                              <span>
                                <b>{draft.template_name || draft.subject}</b>
                                <small>
                                  {draft.template_performance?.delivered ? `Apertura ${Math.round((100 * (draft.template_performance.opens_unique ?? 0)) / draft.template_performance.delivered)} % · ` : ""}
                                  {draft.template_performance?.last_sent_at ? `enviado ${fmtDate(draft.template_performance.last_sent_at)}` : ""}
                                </small>
                              </span>
                              <span className={s.fig}>
                                {formatMoney(draft.template_performance?.revenue ?? 0, draft.template_performance?.currency_code ?? null)}
                                <small>atribuidos por Klaviyo</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={s.note}>Todavía no hay emails de NORA con resultados de Klaviyo. Cuando envíes alguno, los que mejor funcionen aparecerán aquí.</p>
                      )
                    ) : startMode === "klaviyo" ? (
                      <KlaviyoImportPanel
                        organizationId={organizationId}
                        importedTemplateIds={drafts.map((draft) => draft.request?.klaviyo_template_id).filter((id): id is string => Boolean(id))}
                        onImported={(draftId) => {
                          setLauncher(false);
                          onDraftsChanged();
                          if (draftId) setPendingOpenId(draftId);
                        }}
                      />
                    ) : (
                      <div className={s.card}>
                        <b>Email en blanco</b>
                        <p className={s.note}>Empieza con cabecera y pie legal para no olvidarlos.</p>
                        <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => startFromBlocks(blankBlocks(brandBase), { name: campaignTarget?.title ?? "" })}>
                          Empezar en blanco
                        </button>
                      </div>
                    )}
                  </div>
                </div>
      </Dialog>
    </div>
  );
}
