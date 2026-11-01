"use client";

/* eslint-disable @next/next/no-img-element -- Las imágenes del lienzo son las
   del propio email (CDN de Shopify o subidas): next/image no aporta nada y
   obligaría a declarar cada dominio. */

import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type FormEvent,
} from "react";
import { Checkbox, Field, Input, Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui";
import {
  BLOCK_LABEL,
  BODY_FONT,
  COLOR_ROLES,
  colorOf,
  deadlineLabel,
  headFont,
  isHttpUrl,
  MAX_PRODUCTS,
  MERGE,
  youtubeThumb,
  type BlockProps,
  type StudioBlock,
  type StudioBrand,
  type StudioDesign,
} from "./studio-design";
import s from "./studio.module.css";

// ---------------------------------------------------------------------------
// Iconos (trazos de 24px, sin librería: son pocos y no cambian)
// ---------------------------------------------------------------------------

const PATHS: Record<string, string> = {
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  plus: "M12 5v14M5 12h14",
  send: "m22 2-7 20-4-9-9-4Zm0 0L11 13",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  meta: "M4 15c0-5 3-9 5-9 3 0 4 6 6 9 1 2 4 2 4-1 0-4-2-8-4-8-3 0-4 5-6 8-1 2-5 3-5 1Z",
  insta: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm4 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  popup: "M3 4h18v16H3zM7 8h10v8H7z",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  desktop: "M3 4h18v12H3zM8 20h8M12 16v4",
  phone: "M7 3h10v18H7zM11 18h2",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  heading: "M6 4v16M18 4v16M6 12h12",
  text: "M4 6h16M4 12h16M4 18h10",
  button: "M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8Z",
  image: "M3 4h18v16H3zM9 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM21 17l-5-5-9 8",
  products: "M3 4h7v7H3zM14 4h7v7h-7zM3 15h7M14 15h7M3 19h5M14 19h5",
  coupon: "M3 8a2 2 0 0 0 0 4v5h18v-5a2 2 0 0 1 0-4V4H3ZM14 4v2M14 10v2M14 16v1",
  countdown: "M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 9v4l2 2M9 2h6",
  review: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z",
  header: "M3 5h18v5H3zM7 15h10M9 19h6",
  hero: "M3 3h18v12H3zM7 19h10",
  columns: "M3 5h5v14H3zM10 5h4v14h-4zM16 5h5v14h-5z",
  video: "M3 5h18v14H3zM10 9l5 3-5 3Z",
  divider: "M3 12h18",
  "align-left": "M4 6h16M4 10h10M4 14h16M4 18h10",
  "align-center": "M4 6h16M7 10h10M4 14h16M7 18h10",
  "align-right": "M4 6h16M10 10h10M4 14h16M10 18h10",
  spacer: "M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4",
  social: "M6 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM18 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM18 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM8.2 11l7.6-4M8.2 13l7.6 4",
  footer: "M3 14h18v6H3zM7 5h10M9 9h6",
  html: "m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
  x: "M6 6l12 12M18 6 6 18",
  check: "m5 12 5 5 9-10",
  template: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  again: "M4 4h10v4M20 20H10v-4M14 8l6 6-6 6",
  klaviyo: "M3 5h18L12 13ZM3 5v14h18V5",
  blank: "M5 3h14v18H5z",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  braces: "M8 4H7a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.7C22 5.9 17.5 3 12 3ZM7.5 12h.01M9 7.5h.01M14.5 7h.01",
};

export function Icon({ name }: { name: string }) {
  return (
    <svg className={s.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Texto editable sobre el propio email
// ---------------------------------------------------------------------------

/**
 * `contentEditable` sin controlar: React no pisa el texto mientras se
 * escribe (perdería el cursor), solo lo repone cuando cambia desde fuera
 * (panel de ajustes, deshacer, IA).
 */
function Editable({
  value,
  onChange,
  as = "div",
  style,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  as?: "div" | "span" | "p" | "h1" | "h2" | "h3" | "q" | "b";
  style?: CSSProperties;
  label: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && document.activeElement !== element && element.innerText !== value) {
      element.innerText = value;
    }
  }, [value]);
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={s.editable}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline
      onInput={(event: FormEvent<HTMLElement>) => onChange(event.currentTarget.innerText.replace(/\n$/, ""))}
      // Al salir guarda el cursor: «Insertar variable» la pone ahí.
      onBlur={rememberCaret}
      // Pegar desde Word o una web traería su formato: solo texto.
      onPaste={(event: ClipboardEvent<HTMLElement>) => {
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Ajustes rápidos sobre el lienzo (Popover desde la barra del bloque): enlace,
// variables de personalización y color, sin ir al panel de la derecha.
// ---------------------------------------------------------------------------

/** Dónde estaba el cursor en el último texto del lienzo: la variable se inserta ahí. */
let lastCaret: { blockId: string; range: Range } | null = null;

function rememberCaret(event: FocusEvent<HTMLElement>) {
  const selection = window.getSelection();
  const blockId = event.currentTarget.closest<HTMLElement>("[data-block]")?.dataset.block;
  if (!blockId || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (event.currentTarget.contains(range.startContainer)) lastCaret = { blockId, range: range.cloneRange() };
}

/** Escribe el texto en el cursor guardado de ese bloque; false si no lo hay. */
function insertAtCaret(blockId: string, token: string) {
  const saved = lastCaret;
  const node = saved?.blockId === blockId ? saved.range.startContainer : null;
  const editable = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>("[contenteditable]");
  if (!saved || !editable?.isConnected) return false;
  editable.focus();
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(saved.range);
  // Como si se tecleara: dispara onInput y entra en deshacer.
  document.execCommand("insertText", false, token);
  return true;
}

/** Qué campo de cada bloque es su enlace, dónde van las variables y cuál es su color. */
const LINK_OF: Partial<Record<keyof BlockProps, { url: string; utm?: string }>> = {
  button: { url: "url", utm: "utm" },
  hero: { url: "url", utm: "utm" },
  image: { url: "url" },
};
const MERGE_INTO: Partial<Record<keyof BlockProps, string>> = { hero: "text", heading: "text", text: "text" };
const COLOR_OF: Partial<Record<keyof BlockProps, string>> = { header: "bg", heading: "color", text: "color", button: "bg", divider: "color" };

function QuickTools({ block, brand, patch }: { block: StudioBlock; brand: StudioBrand; patch: Patch }) {
  const props = block.props as Record<string, unknown>;
  const link = LINK_OF[block.type];
  const mergeKey = MERGE_INTO[block.type];
  const colorKey = COLOR_OF[block.type];
  const [mergeOpen, setMergeOpen] = useState(false);
  const url = link ? String(props[link.url] ?? "") : "";
  const missing = Boolean(link) && !isHttpUrl(url);
  return (
    <>
      {link ? (
        <Popover>
          <PopoverTrigger render={<button type="button" title={missing ? "Falta el enlace" : "Enlace"} aria-label={missing ? "Enlace (falta)" : "Enlace"} data-warn={missing || undefined} />}>
            <Icon name="link" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <PopoverHeader>
              <PopoverTitle>Enlace</PopoverTitle>
              <PopoverDescription>A dónde lleva al hacer clic.</PopoverDescription>
            </PopoverHeader>
            <Field label="Dirección" error={url && !isHttpUrl(url) ? "Tiene que empezar por https://" : undefined}>
              <Input type="url" autoFocus placeholder="https://tu-tienda.com/coleccion" value={url} onChange={(event) => patch({ [link.url]: event.target.value })} />
            </Field>
            {link.utm ? (
              <Checkbox checked={Boolean(props[link.utm])} onCheckedChange={(checked) => patch({ [link.utm!]: checked })}>
                Añadir UTM para medirlo en Shopify
              </Checkbox>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : null}
      {mergeKey ? (
        <Popover open={mergeOpen} onOpenChange={setMergeOpen}>
          <PopoverTrigger render={<button type="button" title="Insertar variable" aria-label="Insertar variable" />}>
            <Icon name="braces" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 gap-3">
            <PopoverHeader>
              <PopoverTitle>Personalizar</PopoverTitle>
              <PopoverDescription>Se cambia por el dato de cada persona al enviarlo.</PopoverDescription>
            </PopoverHeader>
            <div className="grid gap-1">
              {MERGE.map(([label, token]) => (
                <button
                  key={token}
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
                  onClick={() => {
                    setMergeOpen(false);
                    // En el cursor si estaba en este bloque; si no, al final del texto.
                    if (!insertAtCaret(block.id, token)) {
                      const current = String(props[mergeKey] ?? "");
                      patch({ [mergeKey]: `${current}${!current || current.endsWith(" ") ? "" : " "}${token}` });
                    }
                  }}
                >
                  <span className="font-medium">{label}</span>
                  <code className="truncate text-sm text-muted">{token}</code>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      {colorKey ? (
        <Popover>
          <PopoverTrigger render={<button type="button" title="Color" aria-label="Color" />}>
            <Icon name="palette" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 gap-3">
            <PopoverHeader>
              <PopoverTitle>Color</PopoverTitle>
              <PopoverDescription>Los de tu marca cambian solos si cambia la Guía de marca.</PopoverDescription>
            </PopoverHeader>
            <div className={s.swrow} role="group" aria-label="Colores de la marca">
              {COLOR_ROLES.map(([role, label]) => (
                <button key={role} type="button" className={s.sw} style={{ background: colorOf(role, brand) }} aria-pressed={props[colorKey] === role} title={label} aria-label={label} onClick={() => patch({ [colorKey]: role })} />
              ))}
              <input type="color" value={colorOf(String(props[colorKey] ?? "text"), brand)} aria-label="Otro color" onChange={(event) => patch({ [colorKey]: event.target.value })} />
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

type Patch = (props: Record<string, unknown>) => void;

function Img({ src, alt, style, className }: { src: string; alt: string; style?: CSSProperties; className?: string }) {
  if (!isHttpUrl(src) && !src.startsWith("data:")) {
    return <div className={s.placeholderImg} style={style}>Elige una imagen en «Imágenes» o en los ajustes del bloque</div>;
  }
  return <img src={src} alt={alt} className={className} style={{ display: "block", width: "100%", height: "auto", ...style }} />;
}

function BlockView({ block, brand, patch }: { block: StudioBlock; brand: StudioBrand; patch: Patch }) {
  const head = headFont(brand);
  const pad = (padding: string, extra: CSSProperties = {}): CSSProperties => ({ padding, ...extra });
  switch (block.type) {
    case "header": {
      const p = block.props;
      return (
        <div style={pad("22px 32px 18px", { textAlign: p.align, background: colorOf(p.bg, brand) })}>
          {brand.logoUrl && isHttpUrl(brand.logoUrl) ? (
            <img src={brand.logoUrl} alt={p.logo || brand.logo} style={{ height: 40, width: "auto", display: "inline-block" }} />
          ) : (
            <Editable label="Logotipo" value={p.logo || brand.logo} onChange={(logo) => patch({ logo })} style={{ fontFamily: head, fontSize: 22, letterSpacing: 6, fontWeight: 700, color: brand.primary }} />
          )}
          <Editable label="Lema" value={p.tagline} onChange={(tagline) => patch({ tagline })} style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: p.tagline ? 0.6 : 0.3, marginTop: 4, minHeight: 14 }} />
        </div>
      );
    }
    case "hero": {
      const p = block.props;
      const hasImg = isHttpUrl(p.img) || p.img.startsWith("data:");
      const fg = p.overlay || !hasImg ? "#ffffff" : brand.text;
      return (
        <div
          style={{
            minHeight: p.height,
            display: "flex",
            alignItems: "flex-end",
            backgroundColor: brand.primary,
            backgroundImage: hasImg ? `url("${p.img}")` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          role={hasImg ? "img" : undefined}
          aria-label={hasImg ? p.alt || "Imagen sin texto alternativo" : undefined}
        >
          <div style={{ width: "100%", padding: "28px 32px", background: p.overlay && hasImg ? "rgba(0,0,0,.38)" : undefined, color: fg }}>
            <Editable as="h1" label="Título de la portada" value={p.title} onChange={(title) => patch({ title })} style={{ margin: "0 0 10px", fontFamily: head, fontSize: 34, lineHeight: 1.1, fontWeight: 700, maxWidth: 460 }} />
            <Editable as="p" label="Texto de la portada" value={p.text} onChange={(text) => patch({ text })} style={{ margin: "0 0 18px", fontFamily: BODY_FONT, fontSize: 15, lineHeight: 1.5, maxWidth: 460 }} />
            <Editable
                as="span"
                label="Botón de la portada"
                value={p.cta}
                onChange={(cta) => patch({ cta })}
                style={{ display: "inline-block", background: brand.primary, color: "#ffffff", border: `2px solid ${p.overlay || !hasImg ? "#ffffff" : brand.primary}`, borderRadius: brand.radius, padding: "13px 24px", fontFamily: BODY_FONT, fontSize: 15, fontWeight: 600, minWidth: 40 }}
              />
          </div>
        </div>
      );
    }
    case "heading": {
      const p = block.props;
      return (
        <div style={pad("20px 32px 6px")}>
          <Editable as={p.level} label="Título" value={p.text} onChange={(text) => patch({ text })} style={{ margin: 0, fontFamily: head, fontSize: p.size, lineHeight: 1.15, fontWeight: Number(p.weight), letterSpacing: p.spacing, textAlign: p.align, color: colorOf(p.color, brand) }} />
        </div>
      );
    }
    case "text": {
      const p = block.props;
      return (
        <div style={pad("8px 32px 16px")}>
          <Editable as="p" label="Texto" value={p.text} onChange={(text) => patch({ text })} style={{ margin: 0, fontFamily: BODY_FONT, fontSize: p.size, lineHeight: p.lh, textAlign: p.align, color: colorOf(p.color, brand) }} />
        </div>
      );
    }
    case "button": {
      const p = block.props;
      const color = colorOf(p.bg, brand);
      const look: CSSProperties =
        p.style === "solid"
          ? { background: color, color: "#ffffff", border: `2px solid ${color}`, padding: "13px 24px" }
          : p.style === "outline"
            ? { background: "transparent", color, border: `2px solid ${color}`, padding: "13px 24px" }
            : { color, textDecoration: "underline", padding: 0 };
      return (
        <div style={pad("16px 32px", { textAlign: p.align })}>
          <Editable as="span" label="Texto del botón" value={p.label} onChange={(label) => patch({ label })} style={{ ...look, display: p.full ? "block" : "inline-block", textAlign: "center", borderRadius: p.radius, fontFamily: BODY_FONT, fontSize: 15, fontWeight: 600 }} />
        </div>
      );
    }
    case "image": {
      const p = block.props;
      return (
        <div style={{ position: "relative" }}>
          <Img src={p.src} alt={p.alt} />
          {p.src && !p.alt.trim() ? <span className={s.altMiss}>Falta texto alternativo</span> : null}
        </div>
      );
    }
    case "products": {
      const p = block.props;
      const cols = Number(p.cols);
      if (!p.items.length) {
        return <div className={s.placeholderImg} style={{ minHeight: 120, margin: "12px 32px" }}>Elige los productos en los ajustes del bloque</div>;
      }
      return (
        <div style={pad("12px 25px 4px", { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, fontFamily: BODY_FONT })}>
          {p.items.slice(0, MAX_PRODUCTS).map((item) => (
            <div key={item.id} style={{ padding: "0 7px 16px", textAlign: "center", color: brand.text }}>
              {item.image ? <img src={item.image} alt={item.title} style={{ display: "block", width: "100%", height: "auto", borderRadius: 4 }} /> : <div className={s.placeholderImg} style={{ minHeight: 120, fontSize: 11 }}>Sin foto</div>}
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{item.title}</div>
              {p.price && item.price ? <div style={{ fontSize: 13, opacity: 0.7, margin: "2px 0 6px" }}>{item.price}</div> : null}
              <Editable as="span" label="Texto del enlace" value={p.cta} onChange={(cta) => patch({ cta })} style={{ fontSize: 13, fontWeight: 600, color: brand.primary, textDecoration: "underline" }} />
            </div>
          ))}
        </div>
      );
    }
    case "coupon": {
      const p = block.props;
      const until = deadlineLabel(p.until);
      return (
        <div style={pad("16px 32px")}>
          <div style={{ border: `2px dashed ${brand.primary}`, borderRadius: 8, padding: 18, textAlign: "center", background: brand.card, fontFamily: BODY_FONT }}>
            <Editable label="Texto del cupón" value={p.text} onChange={(text) => patch({ text })} style={{ fontSize: 15 }} />
            <Editable label="Código" value={p.code} onChange={(code) => patch({ code })} style={{ fontFamily: "'Courier New',monospace", fontSize: 24, fontWeight: 700, letterSpacing: 3, color: brand.primary, margin: "6px 0" }} />
            {until ? <div style={{ fontSize: 12, opacity: 0.7 }}>Válido hasta el {until}</div> : null}
          </div>
        </div>
      );
    }
    case "countdown": {
      const p = block.props;
      return (
        <div style={pad("16px 32px", { textAlign: "center", fontFamily: BODY_FONT })}>
          <Editable label="Texto de la fecha límite" value={p.label} onChange={(label) => patch({ label })} style={{ fontSize: 14, marginBottom: 8 }} />
          <span style={{ display: "inline-block", background: brand.primary, color: "#ffffff", borderRadius: 6, padding: "10px 18px", fontSize: 18, fontWeight: 700 }}>{deadlineLabel(p.until) || "Elige la fecha"}</span>
        </div>
      );
    }
    case "review": {
      const p = block.props;
      const stars = Math.max(1, Math.min(5, Math.round(p.stars)));
      return (
        <div style={pad("20px 32px", { textAlign: "center", fontFamily: head })}>
          <div style={{ color: brand.accent, letterSpacing: 3, fontSize: 16 }} aria-label={`${stars} de 5`}>
            {"★".repeat(stars)}
            {"☆".repeat(5 - stars)}
          </div>
          <Editable label="Reseña" value={p.quote} onChange={(quote) => patch({ quote })} style={{ fontSize: 19, lineHeight: 1.4, fontStyle: "italic", margin: "8px auto", maxWidth: 440 }} />
          <Editable label="Quién la firma" value={p.author} onChange={(author) => patch({ author })} style={{ fontFamily: BODY_FONT, fontSize: 12.5, opacity: 0.7 }} />
        </div>
      );
    }
    case "columns": {
      const p = block.props;
      return (
        <div style={pad("22px 24px", { background: brand.card, display: "grid", gridTemplateColumns: `repeat(${p.items.length}, minmax(0, 1fr))`, gap: 0, fontFamily: BODY_FONT })}>
          {p.items.map((item, index) => (
            <div key={index} style={{ padding: "0 8px", textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.bg, color: brand.primary, display: "grid", placeItems: "center", margin: "0 auto", fontWeight: 700 }}>✓</div>
              <Editable
                as="b"
                label={`Ventaja ${index + 1}`}
                value={item.t}
                onChange={(t) => patch({ items: p.items.map((entry, i) => (i === index ? { ...entry, t } : entry)) })}
                style={{ display: "block", fontSize: 14, marginTop: 8 }}
              />
              <Editable
                as="span"
                label={`Detalle ${index + 1}`}
                value={item.d}
                onChange={(d) => patch({ items: p.items.map((entry, i) => (i === index ? { ...entry, d } : entry)) })}
                style={{ display: "block", fontSize: 12.5, opacity: 0.72 }}
              />
            </div>
          ))}
        </div>
      );
    }
    case "video": {
      const p = block.props;
      const thumb = youtubeThumb(p.url);
      return (
        <div style={pad("16px 32px", { textAlign: "center", fontFamily: BODY_FONT })}>
          {thumb ? <img src={thumb} alt={p.caption} style={{ display: "block", width: "100%", borderRadius: 4 }} /> : <div className={s.placeholderImg}>Pega el enlace de YouTube en los ajustes del bloque</div>}
          <div style={{ fontSize: 13, marginTop: 8, display: "flex", gap: 4, justifyContent: "center" }}>
            <span aria-hidden="true">▶</span>
            <Editable as="span" label="Pie del vídeo" value={p.caption} onChange={(caption) => patch({ caption })} />
          </div>
        </div>
      );
    }
    case "divider":
      return (
        <div style={pad("12px 32px")}>
          <div style={{ borderTop: `${block.props.width}px solid ${colorOf(block.props.color, brand)}` }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: block.props.h }} />;
    case "social": {
      const links = block.props.links.filter((link) => isHttpUrl(link.url));
      return (
        <div style={pad("16px 32px", { textAlign: "center", fontFamily: BODY_FONT })}>
          {links.length ? (
            links.map((link) => (
              <span key={link.name} style={{ display: "inline-block", margin: "0 4px 6px", padding: "5px 12px", border: `1px solid ${brand.text}`, borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                {link.name}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12.5, opacity: 0.6 }}>Pon los enlaces de tus redes en los ajustes del bloque</span>
          )}
        </div>
      );
    }
    case "footer":
      return (
        <div style={pad("24px 32px 28px", { textAlign: "center", fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 1.6, opacity: 0.7 })}>
          <Editable label="Dirección legal" value={block.props.address} onChange={(address) => patch({ address })} />
          <div>
            <u>Darse de baja</u> · <u>Preferencias</u>
          </div>
        </div>
      );
    case "html":
      return <iframe className={s.htmlFrame} title="HTML importado" sandbox="" srcDoc={block.props.html} />;
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export type DropPayload =
  | { kind: "new"; type: keyof BlockProps }
  | { kind: "section"; key: string }
  | { kind: "img"; src: string; alt: string }
  | { kind: "move"; id: string };

export const DRAG_MIME = "application/x-nora-studio";

export function readDrop(event: DragEvent): DropPayload | null {
  const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData("text/plain");
  try {
    const parsed = JSON.parse(raw) as DropPayload;
    return parsed && typeof parsed === "object" && "kind" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export function startDrag(event: DragEvent, payload: DropPayload) {
  const json = JSON.stringify(payload);
  event.dataTransfer.setData(DRAG_MIME, json);
  event.dataTransfer.setData("text/plain", json);
  event.dataTransfer.effectAllowed = "copyMove";
}

export function EmailCanvas({
  design,
  selectedId,
  mobile,
  onSelect,
  onPatch,
  onAction,
  onDrop,
}: {
  design: StudioDesign;
  selectedId: string | null;
  mobile: boolean;
  onSelect: (id: string) => void;
  onPatch: (id: string, props: Record<string, unknown>) => void;
  onAction: (action: "up" | "down" | "dup" | "ai" | "del", id: string) => void;
  onDrop: (index: number, payload: DropPayload) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dropTop, setDropTop] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const { brand } = design;

  function blocksEls() {
    return Array.from(ref.current?.querySelectorAll<HTMLElement>(":scope > [data-block]") ?? []);
  }
  function indexAt(y: number) {
    const els = blocksEls();
    const found = els.findIndex((el) => {
      const rect = el.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    return found === -1 ? els.length : found;
  }

  return (
    <div
      ref={ref}
      className={s.email}
      data-mobile={mobile}
      style={{ background: brand.bg, color: brand.text }}
      onDragOver={(event) => {
        event.preventDefault();
        const els = blocksEls();
        const index = indexAt(event.clientY);
        const last = els[els.length - 1];
        setDropTop(!els.length ? 12 : index < els.length ? els[index]!.offsetTop : last!.offsetTop + last!.offsetHeight);
      }}
      onDragLeave={(event) => {
        if (!ref.current?.contains(event.relatedTarget as Node | null)) setDropTop(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropTop(null);
        const payload = readDrop(event);
        if (payload) onDrop(indexAt(event.clientY), payload);
      }}
    >
      {design.blocks.length === 0 ? (
        <div className={s.empty}>
          <b>Email en blanco</b>
          Arrastra bloques desde la izquierda, suelta una sección entera o empieza desde «Nueva pieza».
        </div>
      ) : null}
      {design.blocks.map((block, index) => (
        <div
          key={block.id}
          data-block={block.id}
          className={s.blk}
          data-selected={selectedId === block.id}
          data-dragging={dragging === block.id}
          onMouseDown={() => onSelect(block.id)}
          onFocus={() => onSelect(block.id)}
        >
          <span className={s.blkTag}>{BLOCK_LABEL[block.type]}</span>
          <div className={s.blkTools}>
            <span
              draggable
              title="Arrastrar para mover"
              aria-label="Mover"
              onDragStart={(event) => {
                startDrag(event, { kind: "move", id: block.id });
                const el = (event.currentTarget as HTMLElement).closest("[data-block]");
                if (el) event.dataTransfer.setDragImage(el, 40, 20);
                setDragging(block.id);
              }}
              onDragEnd={() => setDragging(null)}
            >
              <Icon name="grip" />
            </span>
            <QuickTools block={block} brand={brand} patch={(props) => onPatch(block.id, props)} />
            <button type="button" title="Subir" aria-label="Subir" disabled={index === 0} onClick={() => onAction("up", block.id)}>
              <Icon name="up" />
            </button>
            <button type="button" title="Bajar" aria-label="Bajar" disabled={index === design.blocks.length - 1} onClick={() => onAction("down", block.id)}>
              <Icon name="down" />
            </button>
            <button type="button" title="Duplicar" aria-label="Duplicar" onClick={() => onAction("dup", block.id)}>
              <Icon name="copy" />
            </button>
            <button type="button" title="Mejorar con IA" aria-label="Mejorar con IA" onClick={() => onAction("ai", block.id)}>
              <Icon name="spark" />
            </button>
            <button type="button" title="Borrar" aria-label="Borrar" onClick={() => onAction("del", block.id)}>
              <Icon name="trash" />
            </button>
          </div>
          <BlockView block={block} brand={brand} patch={(props) => onPatch(block.id, props)} />
        </div>
      ))}
      {dropTop !== null ? <div className={s.dropLine} style={{ top: dropTop - 2 }} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anuncio, publicación y popup
// ---------------------------------------------------------------------------

function PreviewImg({ src, className, story }: { src: string; className: string; story?: boolean }) {
  return isHttpUrl(src) || src.startsWith("data:") ? (
    <img src={src} alt="" className={className} data-story={story} />
  ) : (
    <div className={className} data-story={story} />
  );
}

export function MetaPreview({ design, pageName }: { design: StudioDesign; pageName: string }) {
  const m = design.meta;
  const text = m.texts[m.active] ?? m.texts[0] ?? "";
  return (
    <div className={s.phone}>
      <div className={s.adHead}>
        <div className={s.av} style={{ background: design.brand.primary }}>
          {pageName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <b>{pageName}</b>
          <small>Publicidad</small>
        </div>
      </div>
      {m.format === "feed" ? (
        <div className={s.adText}>
          {text.length > 125 ? (
            <>
              {text.slice(0, 125)}
              <span>… Ver más</span>
            </>
          ) : (
            text || <span>Escribe el texto principal en «Pieza»</span>
          )}
        </div>
      ) : null}
      <PreviewImg src={m.img} className={s.adImg} story={m.format === "story"} />
      <div className={s.adFoot}>
        <div style={{ minWidth: 0 }}>
          <small>{isHttpUrl(m.url) ? new URL(m.url).hostname : "tu-tienda.com"}</small>
          <b>{m.headline || "Titular"}</b>
          <span className={s.d}>{m.desc}</span>
        </div>
        <span className={s.adBtn}>{m.cta}</span>
      </div>
    </div>
  );
}

export function IgPreview({ design, account }: { design: StudioDesign; account: string }) {
  const g = design.ig;
  return (
    <div className={s.phone}>
      <div className={s.adHead}>
        <div className={s.av} style={{ background: design.brand.primary }}>
          {account.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <b>{account}</b>
        </div>
      </div>
      <PreviewImg src={g.imgs[0] ?? ""} className={s.igImg} />
      <div className={s.igDots}>
        {(g.imgs.length ? g.imgs : [""]).map((src, index) => (
          <i key={`${src}-${index}`} data-on={index === 0} />
        ))}
      </div>
      <div className={s.igCap}>
        <b>{account}</b> {g.caption || "Escribe el texto en «Pieza»"}
        {g.hashtags ? (
          <>
            {"\n\n"}
            <span className={s.h}>{g.hashtags}</span>
          </>
        ) : null}
        {g.firstComment ? <span className={s.cm}>Primer comentario: {g.firstComment}</span> : null}
      </div>
    </div>
  );
}

export function PopupPreview({ design }: { design: StudioDesign }) {
  const p = design.popup;
  return (
    <div className={s.site}>
      <div className={s.bar} />
      <div className={s.ghost}>
        <span style={{ width: "40%" }} />
        <span />
        <span style={{ width: "80%" }} />
        <span style={{ height: 120 }} />
      </div>
      <div className={s.veil}>
        <div className={s.pop}>
          {isHttpUrl(p.img) || p.img.startsWith("data:") ? <img src={p.img} alt="" /> : <div className={s.ph} />}
          <div className={s.popBody}>
            <h3>{p.title || "Título del popup"}</h3>
            <p>{p.text}</p>
            <div className={s.in}>{p.placeholder}</div>
            <div className={s.b} style={{ background: design.brand.primary }}>
              {p.button}
            </div>
            <small>{p.consent}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
