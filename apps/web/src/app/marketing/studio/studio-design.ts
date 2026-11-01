/**
 * Estudio de contenido: el modelo de una pieza (email, anuncio de Meta,
 * publicación de Instagram o popup), cómo se convierte en HTML de email y qué
 * se revisa antes de mandarla a revisión.
 *
 * Una pieza guarda aquí su diseño (`request.design` del borrador). La versión
 * 1 era la del editor anterior (`template-design.ts`); `normalizeDesign` la
 * convierte al abrirla, así que los borradores viejos se siguen editando.
 *
 * El HTML sale con tablas y estilos en línea: es lo único que Outlook y Gmail
 * pintan igual. Nada de flex, grid, SVG ni <style> en el cuerpo.
 */
import {
  designFromAiBlocks,
  parseYouTubeId,
  type TemplateDesign,
} from "../template-design";

export type Align = "left" | "center" | "right";
/** Un color es un rol de la marca (se repinta si cambia la marca) o un hex. */
export type ColorRef = "primary" | "accent" | "text" | "bg" | "card" | "white" | string;

export type StudioProduct = {
  id: string;
  title: string;
  price: string;
  image: string;
  url: string;
};

/** Productos por bloque, sea cual sea el número por fila: el resto baja a otra fila. */
export const MAX_PRODUCTS = 6;

export type SocialLink = { name: string; url: string };

export type BlockProps = {
  header: { logo: string; tagline: string; align: Align; bg: ColorRef };
  hero: {
    img: string;
    alt: string;
    title: string;
    text: string;
    cta: string;
    url: string;
    utm: boolean;
    height: number;
    overlay: boolean;
  };
  heading: {
    text: string;
    level: "h1" | "h2" | "h3";
    size: number;
    weight: "400" | "600" | "700" | "800";
    align: Align;
    color: ColorRef;
    spacing: number;
  };
  text: { text: string; size: number; lh: number; align: Align; color: ColorRef };
  button: {
    label: string;
    url: string;
    utm: boolean;
    style: "solid" | "outline" | "link";
    bg: ColorRef;
    radius: number;
    full: boolean;
    align: Align;
  };
  image: { src: string; alt: string; url: string };
  products: {
    source: "best" | "new" | "manual";
    cols: "2" | "3";
    price: boolean;
    cta: string;
    items: StudioProduct[];
  };
  coupon: { text: string; code: string; until: string };
  countdown: { label: string; until: string };
  review: { quote: string; author: string; stars: number };
  columns: { items: Array<{ t: string; d: string }> };
  video: { url: string; caption: string };
  divider: { width: number; color: ColorRef };
  spacer: { h: number };
  social: { links: SocialLink[] };
  footer: { address: string };
  html: { html: string };
};

export type BlockType = keyof BlockProps;
export type StudioBlock = {
  [K in BlockType]: { id: string; type: K; props: BlockProps[K] };
}[BlockType];

export type StudioBrand = {
  logo: string;
  logoUrl: string;
  primary: string;
  accent: string;
  text: string;
  bg: string;
  card: string;
  head: "serif" | "sans";
  radius: number;
};

export type StudioChannel = "email" | "meta" | "ig" | "popup";

export type MetaPiece = {
  texts: string[];
  active: number;
  headline: string;
  desc: string;
  cta: string;
  url: string;
  img: string;
  format: "feed" | "story";
};
export type IgPiece = { imgs: string[]; caption: string; hashtags: string; firstComment: string };
export type PopupPiece = {
  title: string;
  text: string;
  placeholder: string;
  button: string;
  img: string;
  trigger: "8s" | "scroll" | "exit";
  consent: string;
};

export type StudioDesign = {
  version: 2;
  brand: StudioBrand;
  blocks: StudioBlock[];
  /** A quién va; lo recoge el formulario de programar de Campañas. */
  send: { audiences: string[]; exclude: string[]; smart: boolean };
  objective: string;
  tone: string;
  meta: MetaPiece;
  ig: IgPiece;
  popup: PopupPiece;
};

export const BLOCK_LABEL: Record<BlockType, string> = {
  header: "Cabecera",
  hero: "Portada",
  heading: "Título",
  text: "Texto",
  button: "Botón",
  image: "Imagen",
  products: "Productos",
  coupon: "Cupón",
  countdown: "Fecha límite",
  review: "Reseña",
  columns: "Ventajas",
  video: "Vídeo",
  divider: "Separador",
  spacer: "Espacio",
  social: "Redes",
  footer: "Pie legal",
  html: "Código HTML",
};

export const SOCIAL_NETWORKS = ["Instagram", "TikTok", "Facebook", "Pinterest", "YouTube"];

/** Los textos entre corchetes son huecos de plantilla: la revisión no deja enviarlos. */
export const PLACEHOLDER = /\[[^\]\n]{2,}\]/;

let counter = 0;
export function blockId(): string {
  counter += 1;
  return `s${Date.now().toString(36)}${counter.toString(36)}`;
}

function inDays(days: number, time = ""): string {
  const date = new Date(Date.now() + days * 86_400_000);
  const day = date.toISOString().slice(0, 10);
  return time ? `${day}T${time}` : day;
}

const DEFAULT_PROPS: { [K in BlockType]: () => BlockProps[K] } = {
  header: () => ({ logo: "", tagline: "", align: "center", bg: "bg" }),
  hero: () => ({
    img: "",
    alt: "",
    title: "Un título que diga lo que la persona gana",
    text: "Una frase que explique la novedad o la oferta.",
    cta: "Ver ahora",
    url: "",
    utm: true,
    height: 320,
    overlay: true,
  }),
  heading: () => ({ text: "Un título con el beneficio", level: "h2", size: 26, weight: "700", align: "left", color: "text", spacing: 0 }),
  text: () => ({ text: "Cuenta aquí lo que la persona gana. Frases cortas, una idea por párrafo.", size: 16, lh: 1.6, align: "left", color: "text" }),
  button: () => ({ label: "Ver la colección", url: "", utm: true, style: "solid", bg: "primary", radius: 4, full: false, align: "center" }),
  image: () => ({ src: "", alt: "", url: "" }),
  products: () => ({ source: "best", cols: "3", price: true, cta: "Ver producto", items: [] }),
  coupon: () => ({ text: "[Qué da el código, p. ej. 10 % en tu próximo pedido]", code: "[CODIGO]", until: inDays(14) }),
  countdown: () => ({ label: "La oferta termina el", until: inDays(7, "23:59") }),
  review: () => ({ quote: "[Una reseña real de un cliente, copiada tal cual]", author: "[Nombre, ciudad]", stars: 5 }),
  columns: () => ({
    items: [
      { t: "Envío gratis", d: "[Desde qué importe]" },
      { t: "Devoluciones", d: "[Cuántos días]" },
      { t: "[Tu tercera ventaja]", d: "[Un detalle que la pruebe]" },
    ],
  }),
  video: () => ({ url: "", caption: "Ver el vídeo" }),
  divider: () => ({ width: 1, color: "#ddd3c2" }),
  spacer: () => ({ h: 24 }),
  social: () => ({ links: [] }),
  footer: () => ({ address: "{{ organization.name }} · {{ organization.full_address }}" }),
  html: () => ({ html: "" }),
};

export function newBlock<K extends BlockType>(type: K, props: Partial<BlockProps[K]> = {}): StudioBlock {
  return { id: blockId(), type, props: { ...DEFAULT_PROPS[type](), ...props } } as unknown as StudioBlock;
}

export function defaultBrand(partial: Partial<StudioBrand> = {}): StudioBrand {
  return {
    logo: "",
    logoUrl: "",
    primary: "#2f4a3a",
    accent: "#d6923a",
    text: "#2b2622",
    bg: "#f7f2ea",
    card: "#efe6d6",
    head: "serif",
    radius: 4,
    ...partial,
  };
}

export function emptyDesign(brand: StudioBrand = defaultBrand()): StudioDesign {
  return {
    version: 2,
    brand,
    blocks: [],
    send: { audiences: [], exclude: [], smart: true },
    objective: "launch",
    tone: "warm",
    meta: { texts: [""], active: 0, headline: "", desc: "", cta: "Comprar", url: "", img: "", format: "feed" },
    ig: { imgs: [], caption: "", hashtags: "", firstComment: "" },
    popup: {
      title: "",
      text: "",
      placeholder: "Tu email",
      button: "Apuntarme",
      img: "",
      trigger: "8s",
      consent: "Acepto recibir emails. Puedo darme de baja cuando quiera.",
    },
  };
}

// ---------------------------------------------------------------------------
// Marca a partir de la Guía de marca
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * La Guía de marca guarda la paleta como "rol → hex" con los nombres que haya
 * puesto cada uno. Se buscan los roles por nombres habituales y lo que no
 * aparece se queda en el valor por defecto.
 */
export function brandFromProfile(
  profile: { brand_name?: unknown; logo_url?: unknown; palette?: unknown } | null | undefined,
  fallbackName = "",
): StudioBrand {
  const palette =
    profile?.palette && typeof profile.palette === "object"
      ? (profile.palette as Record<string, unknown>)
      : {};
  const pick = (...names: string[]) => {
    for (const [key, value] of Object.entries(palette)) {
      if (typeof value === "string" && HEX.test(value) && names.includes(key.toLowerCase())) return value;
    }
    return undefined;
  };
  const brand = defaultBrand();
  const name = typeof profile?.brand_name === "string" && profile.brand_name.trim() ? profile.brand_name.trim() : fallbackName;
  return {
    ...brand,
    logo: name.toUpperCase(),
    logoUrl: typeof profile?.logo_url === "string" ? profile.logo_url : "",
    primary: pick("primary", "principal", "primario", "brand", "marca") ?? brand.primary,
    accent: pick("accent", "acento", "secondary", "secundario") ?? brand.accent,
    text: pick("text", "texto", "ink", "tinta") ?? brand.text,
    bg: pick("background", "fondo", "bg") ?? brand.bg,
    card: pick("card", "surface", "superficie", "tarjeta") ?? brand.card,
  };
}

// ---------------------------------------------------------------------------
// Diseños antiguos y de la IA
// ---------------------------------------------------------------------------

function isV2(value: unknown): value is StudioDesign {
  return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 2 && Array.isArray((value as { blocks?: unknown }).blocks));
}

/** Convierte un diseño del editor anterior. Lo que no tiene equivalente se degrada a texto. */
export function fromV1(v1: TemplateDesign, brandBase?: StudioBrand): StudioDesign {
  const brand = brandBase ?? defaultBrand({
    primary: HEX.test(v1.styles?.primary ?? "") ? v1.styles.primary : undefined,
    text: HEX.test(v1.styles?.text ?? "") ? v1.styles.text : undefined,
    bg: HEX.test(v1.styles?.containerBackground ?? "") ? v1.styles.containerBackground : undefined,
    head: /serif/i.test(v1.styles?.fontFamily ?? "") && !/sans/i.test(v1.styles?.fontFamily ?? "") ? "serif" : "sans",
  } as Partial<StudioBrand>);
  const blocks: StudioBlock[] = [];
  const color = (value: string | null) => value ?? "text";
  for (const block of v1.blocks ?? []) {
    switch (block.type) {
      case "heading":
        blocks.push(newBlock("heading", { text: block.text, align: block.align, size: { sm: 20, md: 26, lg: 34 }[block.size] ?? 26, color: color(block.color) }));
        break;
      case "text":
        blocks.push(newBlock("text", { text: block.text, align: block.align, color: color(block.color) }));
        break;
      case "button":
        blocks.push(newBlock("button", { label: block.text, url: block.href === "https://" ? "" : block.href, align: block.align, bg: block.bg ?? "primary", utm: false }));
        break;
      case "image":
        blocks.push(newBlock("image", { src: block.src, alt: block.alt, url: block.href }));
        break;
      case "youtube":
        blocks.push(newBlock("video", { url: block.videoId ? `https://www.youtube.com/watch?v=${block.videoId}` : "", caption: block.caption }));
        break;
      case "divider":
        blocks.push(newBlock("divider", { color: block.color ?? "#ddd3c2" }));
        break;
      case "spacer":
        blocks.push(newBlock("spacer", { h: block.height }));
        break;
      case "columns":
        for (const cell of block.columns) {
          if (cell.imageSrc) blocks.push(newBlock("image", { src: cell.imageSrc }));
          if (cell.text.trim()) blocks.push(newBlock("text", { text: cell.text }));
        }
        break;
    }
  }
  return { ...emptyDesign(brand), blocks };
}

/**
 * Abre cualquier cosa guardada: diseño nuevo, diseño del editor anterior,
 * bloques de la IA o solo HTML (plantillas importadas de Klaviyo). Nunca
 * falla: lo peor que devuelve es un diseño vacío.
 */
export function normalizeDesign(
  raw: unknown,
  fallback: { aiBlocks?: unknown[]; html?: string; brand?: StudioBrand } = {},
): StudioDesign {
  if (isV2(raw)) {
    const base = emptyDesign(fallback.brand);
    return {
      ...base,
      ...raw,
      brand: { ...base.brand, ...raw.brand },
      send: { ...base.send, ...raw.send },
      meta: { ...base.meta, ...raw.meta },
      ig: { ...base.ig, ...raw.ig },
      popup: { ...base.popup, ...raw.popup },
      blocks: raw.blocks.filter((block) => block && typeof block === "object" && block.type in DEFAULT_PROPS).map((block) => ({
        ...block,
        props: { ...DEFAULT_PROPS[block.type](), ...block.props },
      })) as StudioBlock[],
    };
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { blocks?: unknown }).blocks)) {
    return fromV1(raw as TemplateDesign, fallback.brand);
  }
  if (fallback.aiBlocks?.length) {
    const design = fromV1(designFromAiBlocks(fallback.aiBlocks), fallback.brand);
    if (design.blocks.length) return design;
  }
  if (fallback.html?.trim()) {
    return { ...emptyDesign(fallback.brand), blocks: [newBlock("html", { html: fallback.html })] };
  }
  return emptyDesign(fallback.brand);
}

// ---------------------------------------------------------------------------
// Plantillas de sistema
// ---------------------------------------------------------------------------

export type SystemTemplateContext = {
  brand: StudioBrand;
  storeUrl: string;
  products: StudioProduct[];
};

export type SystemTemplate = {
  id: string;
  name: string;
  description: string;
  subject: string;
  preheader: string;
  build: (ctx: SystemTemplateContext) => StudioBlock[];
};

function productsBlock(ctx: SystemTemplateContext, source: "best" | "new", cols: "2" | "3" = "3") {
  return newBlock("products", { source, cols, items: ctx.products.slice(0, Number(cols)) });
}

/**
 * Plantillas que NORA ofrece a todas las tiendas. Se rellenan con la marca,
 * la web y los productos de cada una; lo que solo sabe la tienda (una reseña
 * real, sus ventajas) va entre corchetes y la revisión no deja enviarlo así.
 */
export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    id: "lanzamiento",
    name: "Lanzamiento de colección",
    description: "Portada, productos, reseña y ventajas",
    subject: "Ya está aquí: la nueva colección",
    preheader: "Las piezas que más se están pidiendo, antes de que vuelen",
    build: (ctx) => [
      newBlock("header", { logo: ctx.brand.logo, tagline: "" }),
      newBlock("hero", {
        img: ctx.products[0]?.image ?? "",
        alt: ctx.products[0]?.image ? ctx.products[0].title : "",
        title: "La nueva colección ya está aquí",
        text: "Piezas pensadas para usarse todos los días. Te enseñamos las favoritas.",
        cta: "Ver la colección",
        url: ctx.storeUrl,
      }),
      newBlock("text", {
        text: 'Hola {{ first_name|default:"de nuevo" }}, hemos preparado algo nuevo y queríamos que lo vieras antes que nadie. Estas son las piezas que más se están pidiendo:',
      }),
      productsBlock(ctx, "best"),
      newBlock("review"),
      newBlock("columns"),
      newBlock("button", { label: "Ver toda la colección", url: ctx.storeUrl }),
      newBlock("social"),
      newBlock("footer"),
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter del mes",
    description: "Una historia, una imagen y las novedades",
    subject: "Lo que ha pasado este mes",
    preheader: "Una historia de la casa y lo nuevo en la tienda",
    build: (ctx) => [
      newBlock("header", { logo: ctx.brand.logo }),
      newBlock("heading", { text: "[El titular de la historia de este mes]", size: 28 }),
      newBlock("image", { src: ctx.products[0]?.image ?? "", alt: ctx.products[0]?.title ?? "" }),
      newBlock("text", { text: "[Cuenta la historia en tres o cuatro frases: qué ha pasado, por qué te importa y qué viene ahora.]" }),
      newBlock("button", { label: "Leer la historia completa", url: ctx.storeUrl, style: "outline" }),
      newBlock("divider"),
      newBlock("heading", { text: "Novedades en la tienda", size: 22, align: "center" }),
      productsBlock(ctx, "new", "2"),
      newBlock("footer"),
    ],
  },
  {
    id: "oferta",
    name: "Oferta con código",
    description: "Código, fecha límite y más vendidos",
    subject: "Tu código para estrenar algo nuevo",
    preheader: "Solo hasta la fecha que ves dentro",
    build: (ctx) => [
      newBlock("header", { logo: ctx.brand.logo }),
      newBlock("heading", { text: "Un código para ti", align: "center", size: 30 }),
      newBlock("coupon"),
      newBlock("countdown"),
      productsBlock(ctx, "best"),
      newBlock("button", { label: "Usar mi código", url: ctx.storeUrl, full: true }),
      newBlock("footer"),
    ],
  },
  {
    id: "bienvenida",
    name: "Bienvenida",
    description: "Primer email tras suscribirse",
    subject: "Bienvenida: esto es lo que hacemos",
    preheader: "Quiénes somos y por dónde empezar",
    build: (ctx) => [
      newBlock("header", { logo: ctx.brand.logo }),
      newBlock("hero", {
        img: ctx.products[0]?.image ?? "",
        alt: ctx.products[0]?.image ? ctx.products[0].title : "",
        title: "Qué bien que estés aquí",
        text: "[Una frase sobre qué hace diferente a la marca.]",
        cta: "Descubrir la tienda",
        url: ctx.storeUrl,
      }),
      newBlock("columns"),
      productsBlock(ctx, "best"),
      newBlock("footer"),
    ],
  },
];

export function blankBlocks(brand: StudioBrand): StudioBlock[] {
  return [newBlock("header", { logo: brand.logo }), newBlock("footer")];
}

// ---------------------------------------------------------------------------
// Utilidades compartidas por el lienzo y el HTML
// ---------------------------------------------------------------------------

/** Variables de Klaviyo que se pueden poner en los textos del email. */
export const MERGE = [
  ["Nombre", '{{ first_name|default:"" }}'],
  ["Ciudad", "{{ location.city }}"],
  ["Tienda", "{{ organization.name }}"],
] as const;

/** Colores de la marca por rol: se repintan si cambia la Guía de marca. */
export const COLOR_ROLES: Array<[string, string]> = [
  ["primary", "Principal"],
  ["accent", "Acento"],
  ["text", "Texto"],
  ["bg", "Fondo"],
  ["card", "Tarjeta"],
  ["white", "Blanco"],
];

export function colorOf(ref: ColorRef, brand: StudioBrand): string {
  switch (ref) {
    case "primary":
    case "accent":
    case "text":
    case "bg":
    case "card":
      return brand[ref];
    case "white":
      return "#ffffff";
    default:
      return HEX.test(ref) ? ref : brand.text;
  }
}

export function headFont(brand: StudioBrand) {
  return brand.head === "serif" ? "Georgia,'Times New Roman',serif" : "Helvetica,Arial,sans-serif";
}
export const BODY_FONT = "Helvetica,Arial,sans-serif";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Contraste WCAG entre dos hex (#rrggbb). */
export function contrast(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 21;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

export function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "nora"
  );
}

export function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Añade las UTM de NORA sin pisar las que ya lleve el enlace. */
export function withUtm(url: string, campaign: string, medium = "email", source = "klaviyo"): string {
  if (!isHttpUrl(url)) return url;
  const parsed = new URL(url);
  const set = (key: string, value: string) => {
    if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
  };
  set("utm_source", source);
  set("utm_medium", medium);
  set("utm_campaign", slug(campaign));
  return parsed.toString();
}

export function youtubeThumb(url: string): string {
  const id = parseYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

export function deadlineLabel(until: string): string {
  const ms = Date.parse(until);
  if (Number.isNaN(ms)) return "";
  const date = new Date(ms);
  const day = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return until.includes("T")
    ? `${day} a las ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
    : day;
}

export function snippet(block: StudioBlock): string {
  const p = block.props as Record<string, unknown>;
  for (const key of ["text", "title", "label", "logo", "quote", "code", "caption", "alt", "address"]) {
    const value = p[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (block.type === "products") return `${block.props.items.length} productos`;
  if (block.type === "social") return block.props.links.map((link) => link.name).join(" · ");
  if (block.type === "spacer") return `${block.props.h} px`;
  return "";
}

// ---------------------------------------------------------------------------
// HTML del email
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const text = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");
const href = (value: string) => (isHttpUrl(value) ? escapeHtml(value) : "#");

function linkOf(url: string, utm: boolean, campaign: string) {
  return href(utm ? withUtm(url, campaign) : url);
}

function bulletproofButton(label: string, url: string, bg: string, fg: string, radius: number, full: boolean, border = bg) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${full ? ' width="100%"' : ""} style="${full ? "width:100%;" : "display:inline-table;"}border-collapse:separate"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border:2px solid ${border};border-radius:${radius}px"><a href="${url}" style="display:block;padding:13px 24px;font-family:${BODY_FONT};font-size:15px;font-weight:600;line-height:1.2;color:${fg};text-decoration:none">${text(label)}</a></td></tr></table>`;
}

function row(inner: string, padding = "16px 32px", bg?: string) {
  return `<tr><td style="padding:${padding}${bg ? `;background:${bg}` : ""}"${bg ? ` bgcolor="${bg}"` : ""}>${inner}</td></tr>`;
}

function renderBlockHtml(block: StudioBlock, brand: StudioBrand, campaign: string): string {
  const head = headFont(brand);
  switch (block.type) {
    case "header": {
      const p = block.props;
      const logo = brand.logoUrl && isHttpUrl(brand.logoUrl)
        ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(p.logo || brand.logo)}" height="40" style="height:40px;width:auto;border:0;display:inline-block">`
        : `<div style="font-family:${head};font-size:22px;letter-spacing:6px;font-weight:700;color:${brand.primary}">${text(p.logo || brand.logo)}</div>`;
      const tagline = p.tagline.trim()
        ? `<div style="font-family:${BODY_FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${brand.text};opacity:.6;margin-top:4px">${text(p.tagline)}</div>`
        : "";
      return row(`<div style="text-align:${p.align}">${logo}${tagline}</div>`, "22px 32px 18px", colorOf(p.bg, brand));
    }
    case "hero": {
      const p = block.props;
      const bgImg = isHttpUrl(p.img) ? escapeHtml(p.img) : "";
      const fg = p.overlay || !bgImg ? "#ffffff" : brand.text;
      const shade = p.overlay && bgImg ? "background:rgba(0,0,0,0.38);" : "";
      const cta = p.cta.trim()
        ? bulletproofButton(p.cta, linkOf(p.url, p.utm, campaign), brand.primary, "#ffffff", brand.radius, false, p.overlay || !bgImg ? "#ffffff" : brand.primary)
        : "";
      return `<tr><td${bgImg ? ` background="${bgImg}"` : ""} bgcolor="${brand.primary}" valign="bottom" height="${p.height}" style="height:${p.height}px;background-color:${brand.primary};${bgImg ? `background-image:url('${bgImg}');background-size:cover;background-position:center;` : ""}">${bgImg ? `<!-- ${escapeHtml(p.alt)} -->` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" height="${p.height}" style="height:${p.height}px"><tr><td valign="bottom" style="${shade}padding:28px 32px"><h1 style="margin:0 0 10px;font-family:${head};font-size:34px;line-height:1.1;font-weight:700;color:${fg}">${text(p.title)}</h1><p style="margin:0 0 18px;font-family:${BODY_FONT};font-size:15px;line-height:1.5;color:${fg}">${text(p.text)}</p>${cta}</td></tr></table></td></tr>`;
    }
    case "heading": {
      const p = block.props;
      return row(`<${p.level} style="margin:0;font-family:${head};font-size:${p.size}px;line-height:1.15;font-weight:${p.weight};letter-spacing:${p.spacing}px;text-align:${p.align};color:${colorOf(p.color, brand)}">${text(p.text)}</${p.level}>`, "20px 32px 6px");
    }
    case "text": {
      const p = block.props;
      return row(`<p style="margin:0;font-family:${BODY_FONT};font-size:${p.size}px;line-height:${p.lh};text-align:${p.align};color:${colorOf(p.color, brand)}">${text(p.text)}</p>`, "8px 32px 16px");
    }
    case "button": {
      const p = block.props;
      const color = colorOf(p.bg, brand);
      const url = linkOf(p.url, p.utm, campaign);
      const inner =
        p.style === "link"
          ? `<a href="${url}" style="font-family:${BODY_FONT};font-size:15px;font-weight:600;color:${color};text-decoration:underline">${text(p.label)}</a>`
          : p.style === "outline"
            ? bulletproofButton(p.label, url, colorOf("bg", brand), color, p.radius, p.full, color)
            : bulletproofButton(p.label, url, color, "#ffffff", p.radius, p.full);
      return row(`<div style="text-align:${p.align}">${inner}</div>`);
    }
    case "image": {
      const p = block.props;
      if (!isHttpUrl(p.src)) return "";
      const img = `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">`;
      return `<tr><td style="padding:0">${isHttpUrl(p.url) ? `<a href="${linkOf(p.url, true, campaign)}">${img}</a>` : img}</td></tr>`;
    }
    case "products": {
      const p = block.props;
      if (!p.items.length) return "";
      const cols = Number(p.cols);
      const width = Math.floor(100 / cols);
      const cells = p.items.slice(0, MAX_PRODUCTS).map((item) => {
        const url = linkOf(item.url, true, campaign);
        const img = isHttpUrl(item.image) ? `<a href="${url}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="100%" style="display:block;width:100%;height:auto;border:0;border-radius:4px"></a>` : "";
        return `<td valign="top" width="${width}%" style="width:${width}%;padding:0 7px 16px;text-align:center;font-family:${BODY_FONT}">${img}<div style="font-size:14px;font-weight:600;margin-top:8px;color:${brand.text}">${text(item.title)}</div>${p.price && item.price ? `<div style="font-size:13px;color:${brand.text};opacity:.7;margin:2px 0 6px">${text(item.price)}</div>` : ""}<a href="${url}" style="font-size:13px;font-weight:600;color:${brand.primary}">${text(p.cta)}</a></td>`;
      });
      const rows: string[] = [];
      for (let index = 0; index < cells.length; index += cols) {
        rows.push(`<tr>${cells.slice(index, index + cols).join("")}</tr>`);
      }
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`, "12px 25px 4px");
    }
    case "coupon": {
      const p = block.props;
      const until = deadlineLabel(p.until);
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${brand.card}" style="background:${brand.card};border:2px dashed ${brand.primary};border-radius:8px;padding:18px;font-family:${BODY_FONT};color:${brand.text}"><div style="font-size:15px">${text(p.text)}</div><div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;letter-spacing:3px;color:${brand.primary};margin:6px 0">${text(p.code)}</div>${until ? `<div style="font-size:12px;opacity:.7">Válido hasta el ${text(until)}</div>` : ""}</td></tr></table>`);
    }
    case "countdown": {
      const p = block.props;
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="font-family:${BODY_FONT};color:${brand.text}"><div style="font-size:14px;margin-bottom:8px">${text(p.label)}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table"><tr><td bgcolor="${brand.primary}" style="background:${brand.primary};color:#ffffff;border-radius:6px;padding:10px 18px;font-size:18px;font-weight:700">${text(deadlineLabel(p.until))}</td></tr></table></td></tr></table>`);
    }
    case "review": {
      const p = block.props;
      const stars = Math.max(1, Math.min(5, Math.round(p.stars)));
      return row(`<div style="text-align:center;font-family:${head};color:${brand.text}"><div style="color:${brand.accent};font-size:16px;letter-spacing:3px">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</div><div style="font-size:19px;line-height:1.4;font-style:italic;margin:8px auto;max-width:440px">“${text(p.quote)}”</div><div style="font-family:${BODY_FONT};font-size:12.5px;opacity:.7">${text(p.author)}</div></div>`, "20px 32px");
    }
    case "columns": {
      const p = block.props;
      const width = Math.floor(100 / Math.max(1, p.items.length));
      const cells = p.items.map((item) => `<td valign="top" width="${width}%" style="width:${width}%;padding:0 8px;text-align:center;font-family:${BODY_FONT};color:${brand.text}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="36" height="36" align="center" bgcolor="${brand.bg}" style="width:36px;height:36px;border-radius:18px;background:${brand.bg};color:${brand.primary};font-size:16px;font-weight:700">✓</td></tr></table><div style="font-size:14px;font-weight:600;margin-top:8px">${text(item.t)}</div><div style="font-size:12.5px;opacity:.72">${text(item.d)}</div></td>`);
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells.join("")}</tr></table>`, "22px 24px", brand.card);
    }
    case "video": {
      const p = block.props;
      const thumb = youtubeThumb(p.url);
      if (!thumb) return "";
      return row(`<a href="${href(p.url)}" style="text-decoration:none;color:${brand.text}"><img src="${thumb}" alt="${escapeHtml(p.caption)}" width="536" style="display:block;width:100%;height:auto;border:0;border-radius:4px"><div style="font-family:${BODY_FONT};font-size:13px;margin-top:8px;text-align:center">▶ ${text(p.caption)}</div></a>`);
    }
    case "divider": {
      const p = block.props;
      return row(`<div style="border-top:${p.width}px solid ${colorOf(p.color, brand)};font-size:1px;line-height:1px">&nbsp;</div>`, "12px 32px");
    }
    case "spacer":
      return `<tr><td height="${block.props.h}" style="height:${block.props.h}px;font-size:1px;line-height:1px">&nbsp;</td></tr>`;
    case "social": {
      const links = block.props.links.filter((link) => isHttpUrl(link.url));
      if (!links.length) return "";
      return row(`<div style="text-align:center;font-family:${BODY_FONT}">${links.map((link) => `<a href="${href(link.url)}" style="display:inline-block;margin:0 4px 6px;padding:5px 12px;border:1px solid ${brand.text};border-radius:99px;font-size:12px;font-weight:600;color:${brand.text};text-decoration:none">${text(link.name)}</a>`).join("")}</div>`);
    }
    case "footer":
      return row(`<div style="text-align:center;font-family:${BODY_FONT};font-size:11.5px;line-height:1.6;color:${brand.text};opacity:.7">${text(block.props.address)}<br>{% unsubscribe 'Darse de baja' %} · {% manage_preferences 'Preferencias' %}</div>`, "24px 32px 28px");
    case "html":
      return `<tr><td>${block.props.html}</td></tr>`;
  }
}

/**
 * El HTML que se guarda con el borrador y se sube a Klaviyo. Lleva las
 * etiquetas de baja de Klaviyo en el pie: sin ellas Klaviyo no deja enviar.
 */
export function renderEmailHtml(design: StudioDesign, meta: { preheader?: string; campaign?: string; blockIds?: boolean } = {}): string {
  const { brand } = design;
  const campaign = meta.campaign ?? "nora";
  // `blockIds`: marca cada fila con su bloque (data-block) para que el editor móvil sepa cuál se toca. No se guarda ni se envía.
  const body = design.blocks
    .map((block) => {
      const html = renderBlockHtml(block, brand, campaign);
      return meta.blockIds ? html.replace(/^<tr/, `<tr data-block="${block.id}"`) : html;
    })
    .join("\n");
  const preheader = meta.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(meta.preheader)}</div>`
    : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${brand.bg}">${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand.bg}" style="background:${brand.bg}"><tr><td align="center" style="padding:0">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${brand.bg}">
${body}
</table>
</td></tr></table>
</body></html>`;
}

export function emailPlainText(design: StudioDesign): string {
  return design.blocks
    .map((block) => {
      switch (block.type) {
        case "hero":
          return [block.props.title, block.props.text, block.props.cta && `${block.props.cta}: ${block.props.url}`].filter(Boolean).join("\n");
        case "heading":
        case "text":
          return block.props.text;
        case "button":
          return `${block.props.label}: ${block.props.url}`;
        case "products":
          return block.props.items.map((item) => `${item.title}${item.price ? ` · ${item.price}` : ""}: ${item.url}`).join("\n");
        case "coupon":
          return `${block.props.text}\nCódigo: ${block.props.code}`;
        case "countdown":
          return `${block.props.label} ${deadlineLabel(block.props.until)}`;
        case "review":
          return `“${block.props.quote}” — ${block.props.author}`;
        case "columns":
          return block.props.items.map((item) => `${item.t}: ${item.d}`).join("\n");
        case "video":
          return `${block.props.caption}: ${block.props.url}`;
        case "footer":
          return block.props.address;
        default:
          return "";
      }
    })
    .filter((line) => line.trim())
    .join("\n\n");
}

/** Vista del popup para quien revisa (Klaviyo no deja crear formularios por API). */
export function renderPopupHtml(design: StudioDesign): string {
  const p = design.popup;
  const { brand } = design;
  const img = isHttpUrl(p.img) ? `<img src="${escapeHtml(p.img)}" alt="" width="460" style="display:block;width:100%;height:auto">` : "";
  return `<table role="presentation" width="460" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;background:#ffffff;font-family:${BODY_FONT};color:#1d1d1b"><tr><td>${img}</td></tr><tr><td style="padding:22px 20px"><h3 style="margin:0 0 8px;font-family:${headFont(brand)};font-size:22px">${text(p.title)}</h3><p style="margin:0 0 12px;font-size:14px">${text(p.text)}</p><div style="border:1px solid #cfc7b8;border-radius:5px;padding:9px 10px;font-size:13px;color:#8a8a8a">${text(p.placeholder)}</div><div style="margin-top:10px;background:${brand.primary};color:#ffffff;text-align:center;padding:11px;border-radius:5px;font-weight:600">${text(p.button)}</div><p style="margin:10px 0 0;font-size:11px;color:#7a7a7a">${text(p.consent)}</p></td></tr></table>`;
}

/** Vista del anuncio o la publicación para quien revisa. */
export function renderSocialHtml(design: StudioDesign, channel: "meta" | "ig"): string {
  const image = channel === "meta" ? design.meta.img : design.ig.imgs[0] ?? "";
  const body =
    channel === "meta"
      ? `<p style="margin:0 0 10px">${text(design.meta.texts[design.meta.active] ?? design.meta.texts[0] ?? "")}</p>`
      : `<p style="margin:0 0 10px">${text(design.ig.caption)}${design.ig.hashtags ? `<br><br>${text(design.ig.hashtags)}` : ""}</p>`;
  const foot =
    channel === "meta"
      ? `<p style="margin:10px 0 0"><b>${text(design.meta.headline)}</b><br>${text(design.meta.desc)}<br>Botón: ${text(design.meta.cta)}</p>`
      : "";
  return `<div style="max-width:420px;font-family:${BODY_FONT};font-size:14px;line-height:1.45;color:#1c1e21">${body}${isHttpUrl(image) ? `<img src="${escapeHtml(image)}" alt="" style="display:block;width:100%;height:auto">` : ""}${foot}</div>`;
}

// ---------------------------------------------------------------------------
// Revisión
// ---------------------------------------------------------------------------

export type CheckState = "ok" | "warn" | "bad";
export type Check = {
  state: CheckState;
  title: string;
  detail: string;
  fix?: { label: string; action: string };
};

export type PieceHeader = { subject: string; preheader: string };

const SPAM = /gratis!|urgente|!!!|100 ?%|€€|ganador|última oportunidad/i;

function textsOf(block: StudioBlock): string[] {
  return Object.values(block.props).flatMap((value) =>
    typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap((item) => (item && typeof item === "object" ? Object.values(item).filter((v): v is string => typeof v === "string") : [])) : [],
  );
}

/**
 * Lo que se comprueba mientras se edita. Rojo = no se deja mandar a revisión.
 * `htmlBytes` es el tamaño real del HTML que se generaría.
 */
export function reviewPiece(channel: StudioChannel, design: StudioDesign, header: PieceHeader, htmlBytes = 0): Check[] {
  const checks: Check[] = [];
  const add = (state: CheckState, title: string, detail: string, fix?: Check["fix"]) =>
    checks.push(fix ? { state, title, detail, fix } : { state, title, detail });

  if (channel === "email") {
    const subject = header.subject.trim();
    const preheader = header.preheader.trim();
    add(
      subject.length >= 20 && subject.length <= 50 ? "ok" : subject ? "warn" : "bad",
      "Asunto de 20 a 50 caracteres",
      subject ? `Tiene ${subject.length}. En el móvil se ven unos 35.` : "Falta el asunto.",
      subject.length >= 20 && subject.length <= 50 ? undefined : { label: "Ir al asunto", action: "tab:email" },
    );
    add(
      preheader && preheader !== subject ? "ok" : "warn",
      "Preheader que completa el asunto",
      !preheader ? "Sin preheader, Gmail enseña el primer texto del email." : preheader === subject ? "Repite el asunto: aprovecha para decir otra cosa." : "Se lee justo después del asunto.",
      preheader ? undefined : { label: "Escribirlo", action: "tab:email" },
    );
    const spam = SPAM.exec(subject);
    add(spam ? "warn" : "ok", "Asunto sin palabras de spam", spam ? `«${spam[0]}» suele mandar el email a promociones o a spam.` : "Nada que suela activar filtros.");

    const firstCta = design.blocks.findIndex((block) => block.type === "button" || (block.type === "hero" && block.props.cta.trim()));
    add(
      firstCta > -1 && firstCta <= 2 ? "ok" : "warn",
      "Botón en la primera pantalla",
      firstCta > -1 && firstCta <= 2 ? "Se ve sin bajar." : "Hay que bajar para encontrar el primer botón.",
    );

    const placeholder = design.blocks.find((block) => textsOf(block).some((value) => PLACEHOLDER.test(value)));
    add(
      placeholder ? "bad" : "ok",
      "Sin textos de plantilla por rellenar",
      placeholder ? "Hay textos entre corchetes que tienes que cambiar por los de tu tienda." : "Todo el texto es tuyo.",
      placeholder ? { label: "Ir al bloque", action: `select:${placeholder.id}` } : undefined,
    );

    const noAlt = design.blocks.filter(
      (block) =>
        (block.type === "image" && block.props.src && !block.props.alt.trim()) ||
        (block.type === "hero" && block.props.img && !block.props.alt.trim()),
    );
    add(
      noAlt.length ? "bad" : "ok",
      "Imágenes con texto alternativo",
      noAlt.length ? `${noAlt.length} imagen${noAlt.length > 1 ? "es" : ""} sin él: es lo que se lee cuando el correo bloquea las imágenes.` : "Todas lo tienen.",
      noAlt[0] ? { label: "Ir a la imagen", action: `select:${noAlt[0].id}` } : undefined,
    );

    const lowContrast = design.blocks.find((block) => block.type === "button" && block.props.style === "solid" && contrast(colorOf(block.props.bg, design.brand), "#ffffff") < 4.5);
    add(
      lowContrast ? "bad" : "ok",
      "Botones legibles (contraste AA)",
      lowContrast ? "El texto blanco no se lee bien sobre ese color." : "Todos pasan 4,5:1.",
      lowContrast ? { label: "Ir al botón", action: `select:${lowContrast.id}` } : undefined,
    );

    const badLink = design.blocks.find(
      (block) =>
        (block.type === "button" && !isHttpUrl(block.props.url)) ||
        (block.type === "hero" && block.props.cta.trim() && !isHttpUrl(block.props.url)) ||
        (block.type === "products" && block.props.items.some((item) => !isHttpUrl(item.url))),
    );
    add(
      badLink ? "bad" : "ok",
      "Enlaces que llevan a algún sitio",
      badLink
        ? `${badLink.type === "products" ? "Hay un producto" : "Hay un botón"} sin enlace o con un enlace que no empieza por https://.`
        : "Todos los botones y productos tienen enlace.",
      badLink ? { label: badLink.type === "products" ? "Ir a los productos" : "Ir al botón", action: `select:${badLink.id}` } : undefined,
    );

    const noUtm = design.blocks.filter((block) => (block.type === "button" || block.type === "hero") && !block.props.utm);
    add(
      noUtm.length ? "warn" : "ok",
      "Enlaces con UTM",
      noUtm.length ? "Sin UTM, Shopify no sabe que la visita vino de este email." : "Las visitas se podrán cruzar con Shopify.",
      noUtm.length ? { label: "Añadir a todos", action: "utm" } : undefined,
    );

    const emptyProducts = design.blocks.find((block) => block.type === "products" && block.props.items.length === 0);
    if (emptyProducts) add("bad", "Productos elegidos", "Un bloque de productos está vacío.", { label: "Ir al bloque", action: `select:${emptyProducts.id}` });

    // Una plantilla importada de Klaviyo trae su propio pie dentro del HTML.
    const hasFooter = design.blocks.some((block) => block.type === "footer" || (block.type === "html" && /unsubscribe/i.test(block.props.html)));
    add(
      hasFooter ? "ok" : "bad",
      "Pie legal con enlace de baja",
      hasFooter ? "Lo exigen la ley y Klaviyo." : "Sin pie legal Klaviyo no deja enviar.",
      hasFooter ? undefined : { label: "Añadir pie legal", action: "footer" },
    );

    const kb = Math.round(htmlBytes / 1024);
    add(kb < 90 ? "ok" : kb < 102 ? "warn" : "bad", "Peso por debajo de 102 KB", `Pesa ${kb} KB. Gmail corta el email a partir de 102 KB.`);
  } else if (channel === "meta") {
    const m = design.meta;
    const texts = m.texts.filter((value) => value.trim());
    add(texts.length ? "ok" : "bad", "Texto principal escrito", texts.length ? `${texts.length} texto${texts.length > 1 ? "s" : ""}.` : "Falta el texto del anuncio.", texts.length ? undefined : { label: "Escribirlo", action: "tab:pieza" });
    add(texts.every((value) => value.length <= 125) ? "ok" : "warn", "Texto principal visible entero", "Meta corta a los 125 caracteres con «Ver más».");
    add(m.headline.trim() && m.headline.length <= 40 ? "ok" : "warn", "Titular de 40 caracteres o menos", `Tiene ${m.headline.length}.`);
    add(texts.length >= 2 ? "ok" : "warn", "Al menos dos textos para probar", "Meta reparte la inversión hacia el que mejor funcione.", texts.length >= 2 ? undefined : { label: "Añadir texto", action: "addvariant" });
    add(isHttpUrl(m.url) ? "ok" : "bad", "Enlace de destino", isHttpUrl(m.url) ? "Lleva a la tienda." : "Pon la página a la que lleva el anuncio.", isHttpUrl(m.url) ? undefined : { label: "Ponerlo", action: "tab:pieza" });
    add(/utm_/.test(m.url) ? "ok" : "warn", "Enlace con UTM", "Para ver en Shopify qué vino de este anuncio.", /utm_/.test(m.url) || !isHttpUrl(m.url) ? undefined : { label: "Añadir UTM", action: "metautm" });
    add(isHttpUrl(m.img) ? "ok" : "bad", "Imagen elegida", isHttpUrl(m.img) ? "Lista." : "Elige una imagen en Imágenes.");
  } else if (channel === "ig") {
    const g = design.ig;
    const tags = (g.hashtags.match(/#/g) ?? []).length;
    const first = g.caption.split("\n")[0] ?? "";
    add(g.caption.trim() ? "ok" : "bad", "Texto escrito", g.caption.trim() ? `${g.caption.length} de 2.200 caracteres.` : "Falta el texto de la publicación.");
    add(first.length <= 125 ? "ok" : "warn", "Primera línea que engancha", `Instagram enseña unos 125 caracteres antes de «más». La primera tiene ${first.length}.`);
    add(tags >= 3 && tags <= 10 ? "ok" : "warn", "Entre 3 y 10 hashtags", `Hay ${tags}. Instagram permite 30, pero más de 10 resta alcance.`);
    add(g.imgs.length ? (g.imgs.length >= 2 ? "ok" : "warn") : "bad", "Imágenes", g.imgs.length ? (g.imgs.length >= 2 ? `Carrusel de ${g.imgs.length}.` : "Una sola imagen: los carruseles se guardan y comparten más.") : "Elige al menos una imagen.");
  } else {
    const p = design.popup;
    add(p.title.trim() ? (p.title.length <= 40 ? "ok" : "warn") : "bad", "Título corto", p.title.trim() ? `Tiene ${p.title.length}; más de 40 no se lee de un vistazo.` : "Falta el título.");
    add(p.consent.trim() ? "ok" : "bad", "Texto de consentimiento", "Obligatorio para poder mandar emails.");
    add(p.button.trim() && p.button.trim().split(/\s+/).length <= 4 ? "ok" : "warn", "Botón de 2 a 4 palabras", "Que diga lo que la persona se lleva.");
  }
  return checks;
}
