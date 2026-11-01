"use client";

/* eslint-disable @next/next/no-img-element -- miniaturas de imágenes del
   email (CDN de Shopify o subidas), igual que el lienzo. */

import { Select } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import { DatePicker, DateTimePicker } from "@/components/ui/date-picker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Attachment, AttachmentContent, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, startDrag } from "./studio-canvas";
import {
  BLOCK_LABEL,
  COLOR_ROLES,
  MERGE,
  SOCIAL_NETWORKS,
  colorOf,
  contrast,
  isHttpUrl,
  MAX_PRODUCTS,
  snippet,
  withUtm,
  type BlockType,
  type Check,
  type StudioBlock,
  type StudioBrand,
  type StudioChannel,
  type StudioDesign,
  type StudioProduct,
} from "./studio-design";
import s from "./studio.module.css";

// ---------------------------------------------------------------------------
// Campos genéricos
// ---------------------------------------------------------------------------

export type FieldSpec =
  | { k: string; label: string; kind: "text" | "url" | "date" | "datetime"; limit?: number }
  | { k: string; label: string; kind: "textarea"; limit?: number; merge?: boolean }
  | { k: string; label: string; kind: "range"; min: number; max: number; step?: number; unit: string }
  | { k: string; label: string; kind: "seg" | "select"; options: Array<[string, string]> }
  | { k: string; label: string; kind: "align" | "color" | "toggle" | "image" | "hex" };

export function getPath(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined), source);
}

/** Copia con el valor cambiado en `key` (admite rutas tipo `items.0.t`). */
export function setPath<T>(source: T, key: string, value: unknown): T {
  const [head, ...rest] = key.split(".");
  const base = (Array.isArray(source) ? [...source] : { ...(source as object) }) as Record<string, unknown>;
  base[head!] = rest.length ? setPath(base[head!], rest.join("."), value) : value;
  return base as T;
}


export type ImageOption = { src: string; label: string };

function Counter({ value, limit }: { value: string; limit?: number }) {
  if (!limit) return null;
  const length = value.length;
  return (
    <span className={s.count} data-state={length > limit ? "over" : length > limit * 0.85 ? "near" : undefined}>
      {length}/{limit}
    </span>
  );
}

function ImagePicker({ value, images, onChange, onUpload, label }: { value: string; images: ImageOption[]; onChange: (src: string) => void; onUpload: (file: File) => Promise<string | null>; label: string }) {
  const [url, setUrl] = useState("");
  return (
    <div className={s.f}>
      <span className={s.lbl}>{label}</span>
      {images.length ? (
        <div className={s.bank}>
          {images.slice(0, 8).map((image) => (
            <Attachment key={image.src} orientation="vertical" size="xs">
              <AttachmentMedia variant="image">
                <img src={image.src} alt="" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{image.label}</AttachmentTitle>
              </AttachmentContent>
              <AttachmentTrigger aria-pressed={value === image.src} aria-label={`Usar ${image.label}`} title={image.label} onClick={() => onChange(image.src)} />
            </Attachment>
          ))}
        </div>
      ) : null}
      <div className={s.row}>
        <input className={s.inp} style={{ flex: 1 }} placeholder="https://… (pegar enlace)" value={url} onChange={(event) => setUrl(event.target.value)} aria-label={`${label}: enlace`} />
        <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={!isHttpUrl(url)} onClick={() => { onChange(url); setUrl(""); }}>
          Usar
        </button>
      </div>
      <label className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <Icon name="upload" />
        Subir imagen
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const src = await onUpload(file);
            if (src) onChange(src);
          }}
        />
      </label>
    </div>
  );
}

export function Fields({
  id,
  values,
  schema,
  brand,
  images,
  onChange,
  onUpload,
}: {
  id: string;
  values: unknown;
  schema: FieldSpec[];
  brand: StudioBrand;
  images: ImageOption[];
  onChange: (key: string, value: unknown) => void;
  onUpload: (file: File) => Promise<string | null>;
}) {
  return (
    <div className={s.fields}>
      {schema.map((field) => {
        const value = getPath(values, field.k);
        const domId = `st-${id}-${field.k.replace(/\./g, "-")}`;
        switch (field.kind) {
          case "text":
          case "url":
          case "date":
          case "datetime":
            return (
              <div key={field.k} className={s.f}>
                <label className={s.lbl} htmlFor={domId}>
                  {field.label}
                  <Counter value={String(value ?? "")} limit={field.limit} />
                </label>
                {field.kind === "datetime" ? (
                  <DateTimePicker id={domId} aria-label={field.label} value={String(value ?? "")} onChange={(next) => onChange(field.k, next)} />
                ) : field.kind === "date" ? (
                  <DatePicker id={domId} aria-label={field.label} value={String(value ?? "")} onChange={(next) => onChange(field.k, next)} />
                ) : (
                  <input
                    id={domId}
                    className={`${s.inp} ${field.kind === "url" ? s.mono : ""}`}
                    type={field.kind === "url" ? "url" : "text"}
                    value={String(value ?? "")}
                    onChange={(event) => onChange(field.k, event.target.value)}
                  />
                )}
              </div>
            );
          case "textarea":
            return (
              <div key={field.k} className={s.f}>
                <label className={s.lbl} htmlFor={domId}>
                  {field.label}
                  <Counter value={String(value ?? "")} limit={field.limit} />
                </label>
                <textarea id={domId} className={s.inp} value={String(value ?? "")} onChange={(event) => onChange(field.k, event.target.value)} />
                {field.merge ? (
                  <div className={s.chips}>
                    {MERGE.map(([label, token]) => (
                      <button key={token} type="button" className={s.chip} onClick={() => onChange(field.k, `${String(value ?? "")}${String(value ?? "").endsWith(" ") || !value ? "" : " "}${token}`)}>
                        + {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          case "range":
            return (
              <div key={field.k} className={s.f}>
                <label className={s.lbl} htmlFor={domId}>
                  {field.label}
                </label>
                <div className={s.range}>
                  <input id={domId} type="range" min={field.min} max={field.max} step={field.step ?? 1} value={Number(value ?? field.min)} onChange={(event) => onChange(field.k, Number(event.target.value))} />
                  <output htmlFor={domId}>
                    {String(value)}
                    {field.unit}
                  </output>
                </div>
              </div>
            );
          case "seg":
          case "align": {
            const options: Array<[string, string]> = "options" in field ? field.options : [["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]];
            return (
              <div key={field.k} className={s.f}>
                <span className={s.lbl}>{field.label}</span>
                <ToggleGroup aria-label={field.label} spacing={options.length > 4 ? 1.5 : 0} value={String(value)} onValueChange={(option) => onChange(field.k, option)}>
                  {options.map(([option, label]) =>
                    field.kind === "align" ? (
                      <ToggleGroupItem key={option} value={option} size="icon-sm" aria-label={label} title={label}>
                        <Icon name={`align-${option}`} />
                      </ToggleGroupItem>
                    ) : (
                      <ToggleGroupItem key={option} value={option}>
                        {label}
                      </ToggleGroupItem>
                    ),
                  )}
                </ToggleGroup>
              </div>
            );
          }
          case "select":
            return (
              <div key={field.k} className={s.f}>
                <label className={s.lbl} htmlFor={domId}>
                  {field.label}
                </label>
                <Select id={domId} value={String(value ?? "")} onChange={(next) => onChange(field.k, next)} options={field.options.map(([option, label]) => ({ value: option, label }))} />
              </div>
            );
          case "toggle":
            return (
              <label key={field.k} className={s.toggle} htmlFor={domId}>
                <span>{field.label}</span>
                <input id={domId} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(field.k, event.target.checked)} />
              </label>
            );
          case "color": {
            const current = String(value ?? "text");
            const hex = colorOf(current, brand);
            return (
              <div key={field.k} className={s.f}>
                <span className={s.lbl}>{field.label}</span>
                <div className={s.swrow}>
                  {COLOR_ROLES.map(([role, label]) => (
                    <button key={role} type="button" className={s.sw} style={{ background: colorOf(role, brand) }} aria-pressed={current === role} title={label} aria-label={label} onClick={() => onChange(field.k, role)} />
                  ))}
                  <input type="color" value={hex} aria-label="Otro color" onChange={(event) => onChange(field.k, event.target.value)} />
                </div>
              </div>
            );
          }
          case "hex":
            return (
              <div key={field.k} className={s.f}>
                <label className={s.lbl} htmlFor={domId}>
                  {field.label}
                </label>
                <div className={s.swrow}>
                  <input id={domId} type="color" value={String(value)} onChange={(event) => onChange(field.k, event.target.value)} />
                  <input
                    className={`${s.inp} ${s.mono}`}
                    style={{ flex: 1 }}
                    defaultValue={String(value)}
                    key={String(value)}
                    aria-label={`${field.label} en hexadecimal`}
                    onBlur={(event) => /^#[0-9a-fA-F]{6}$/.test(event.target.value) && onChange(field.k, event.target.value.toLowerCase())}
                  />
                </div>
              </div>
            );
          case "image":
            return <ImagePicker key={field.k} label={field.label} value={String(value ?? "")} images={images} onChange={(src) => onChange(field.k, src)} onUpload={onUpload} />;
        }
        return null;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ajustes por tipo de bloque
// ---------------------------------------------------------------------------

export const BLOCK_SCHEMA: Record<BlockType, FieldSpec[]> = {
  header: [
    { k: "logo", label: "Logotipo (texto, si no hay logo en la Guía de marca)", kind: "text" },
    { k: "tagline", label: "Lema", kind: "text", limit: 40 },
    { k: "align", label: "Alineación", kind: "align" },
    { k: "bg", label: "Fondo", kind: "color" },
  ],
  hero: [
    { k: "title", label: "Título", kind: "textarea", limit: 60 },
    { k: "text", label: "Texto", kind: "textarea", limit: 140, merge: true },
    { k: "cta", label: "Botón", kind: "text", limit: 25 },
    { k: "url", label: "Enlace del botón", kind: "url" },
    { k: "utm", label: "Añadir UTM para medirlo en Shopify", kind: "toggle" },
    { k: "img", label: "Imagen de fondo", kind: "image" },
    { k: "alt", label: "Texto alternativo", kind: "text", limit: 120 },
    { k: "height", label: "Alto", kind: "range", min: 200, max: 460, unit: " px" },
    { k: "overlay", label: "Oscurecer la imagen para leer el texto", kind: "toggle" },
  ],
  heading: [
    { k: "text", label: "Texto", kind: "textarea", limit: 60, merge: true },
    { k: "level", label: "Nivel", kind: "seg", options: [["h1", "H1"], ["h2", "H2"], ["h3", "H3"]] },
    { k: "size", label: "Tamaño", kind: "range", min: 16, max: 48, unit: " px" },
    { k: "weight", label: "Grosor", kind: "seg", options: [["400", "Normal"], ["600", "Semi"], ["700", "Negrita"], ["800", "Extra"]] },
    { k: "align", label: "Alineación", kind: "align" },
    { k: "color", label: "Color", kind: "color" },
    { k: "spacing", label: "Interletrado", kind: "range", min: -2, max: 6, unit: " px" },
  ],
  text: [
    { k: "text", label: "Texto", kind: "textarea", merge: true },
    { k: "size", label: "Tamaño", kind: "range", min: 13, max: 22, unit: " px" },
    { k: "lh", label: "Interlineado", kind: "range", min: 1.2, max: 2, step: 0.05, unit: "" },
    { k: "align", label: "Alineación", kind: "align" },
    { k: "color", label: "Color", kind: "color" },
  ],
  button: [
    { k: "label", label: "Texto del botón", kind: "text", limit: 25 },
    { k: "url", label: "Enlace", kind: "url" },
    { k: "utm", label: "Añadir UTM para medirlo en Shopify", kind: "toggle" },
    { k: "style", label: "Estilo", kind: "seg", options: [["solid", "Relleno"], ["outline", "Contorno"], ["link", "Enlace"]] },
    { k: "bg", label: "Color", kind: "color" },
    { k: "radius", label: "Esquinas", kind: "range", min: 0, max: 28, unit: " px" },
    { k: "full", label: "Ancho completo", kind: "toggle" },
    { k: "align", label: "Alineación", kind: "align" },
  ],
  image: [
    { k: "src", label: "Imagen", kind: "image" },
    { k: "alt", label: "Texto alternativo", kind: "text", limit: 120 },
    { k: "url", label: "Enlace al hacer clic", kind: "url" },
  ],
  products: [
    { k: "cols", label: "Por fila", kind: "seg", options: [["2", "2"], ["3", "3"]] },
    { k: "price", label: "Mostrar precio", kind: "toggle" },
    { k: "cta", label: "Texto del enlace", kind: "text", limit: 20 },
  ],
  coupon: [
    { k: "text", label: "Texto", kind: "text", limit: 60 },
    { k: "code", label: "Código", kind: "text", limit: 24 },
    { k: "until", label: "Válido hasta", kind: "date" },
  ],
  countdown: [
    { k: "label", label: "Texto", kind: "text", limit: 60 },
    { k: "until", label: "Termina", kind: "datetime" },
  ],
  review: [
    { k: "quote", label: "Reseña", kind: "textarea", limit: 180 },
    { k: "author", label: "Quién la firma", kind: "text" },
    { k: "stars", label: "Estrellas", kind: "range", min: 1, max: 5, unit: "" },
  ],
  columns: [0, 1, 2].flatMap((index) => [
    { k: `items.${index}.t`, label: `Ventaja ${index + 1}`, kind: "text", limit: 24 } as FieldSpec,
    { k: `items.${index}.d`, label: `Detalle ${index + 1}`, kind: "text", limit: 40 } as FieldSpec,
  ]),
  video: [
    { k: "url", label: "Enlace de YouTube", kind: "url" },
    { k: "caption", label: "Pie", kind: "text", limit: 80 },
  ],
  divider: [
    { k: "width", label: "Grosor", kind: "range", min: 1, max: 4, unit: " px" },
    { k: "color", label: "Color", kind: "color" },
  ],
  spacer: [{ k: "h", label: "Alto", kind: "range", min: 8, max: 96, unit: " px" }],
  social: [],
  footer: [{ k: "address", label: "Dirección legal", kind: "textarea" }],
  html: [{ k: "html", label: "Código HTML", kind: "textarea" }],
};

const BLOCK_ICON: Record<BlockType, string> = {
  header: "header",
  hero: "hero",
  heading: "heading",
  text: "text",
  button: "button",
  image: "image",
  products: "products",
  coupon: "coupon",
  countdown: "countdown",
  review: "review",
  columns: "columns",
  video: "video",
  divider: "divider",
  spacer: "spacer",
  social: "social",
  footer: "footer",
  html: "html",
};

/** Productos: de dónde salen y cuáles, con buscador para elegirlos a mano. */
function ProductsEditor({
  block,
  onChange,
  loadProducts,
}: {
  block: Extract<StudioBlock, { type: "products" }>;
  onChange: (key: string, value: unknown) => void;
  loadProducts: (source: "best" | "new" | "search", q?: string) => Promise<StudioProduct[]>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudioProduct[] | null>(null);
  const [busy, setBusy] = useState(false);
  const p = block.props;
  async function fill(source: "best" | "new") {
    setBusy(true);
    const list = await loadProducts(source);
    setBusy(false);
    onChange("source", source);
    onChange("items", list.slice(0, Number(p.cols)));
  }
  return (
    <div className={s.fields}>
      <div className={s.f}>
        <span className={s.lbl}>Qué productos</span>
        <div className={s.opts}>
          {(
            [
              ["best", "Más vendidos · 30 días"],
              ["new", "Novedades"],
              ["manual", "Elegidos a mano"],
            ] as const
          ).map(([source, label]) => (
            <button key={source} type="button" className={s.opt} aria-pressed={p.source === source} disabled={busy} onClick={() => (source === "manual" ? onChange("source", "manual") : void fill(source))}>
              {label}
            </button>
          ))}
        </div>
        <p className={s.note}>Se copian de Shopify con su foto, precio y enlace de hoy. Si cambia el precio, vuelve a pulsar para actualizarlos. Cada producto lleva a la URL de debajo; puedes cambiarla.</p>
      </div>
      <div className={s.f}>
        <span className={s.lbl}>
          En el email <span className={s.count}>{p.items.length}/{MAX_PRODUCTS}</span>
        </span>
        {p.items.map((item, index) => (
          <div key={item.id} className={s.prodItem}>
          <div className={s.prodPick}>
            {item.image ? <img src={item.image} alt="" /> : <span className={s.ph} />}
            <span style={{ minWidth: 0 }}>
              {item.title}
              <small>{item.price || "Sin precio"}</small>
            </span>
            <span className={s.ops}>
              <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Subir" disabled={index === 0} onClick={() => { const items = [...p.items]; [items[index - 1], items[index]] = [items[index]!, items[index - 1]!]; onChange("items", items); }}>
                <Icon name="up" />
              </button>
              <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Quitar" onClick={() => onChange("items", p.items.filter((_, i) => i !== index))}>
                <Icon name="x" />
              </button>
            </span>
          </div>
          <input
            className={`${s.inp} ${s.mono}`}
            type="url"
            placeholder="https://…"
            aria-label={`Enlace de ${item.title}`}
            aria-invalid={!isHttpUrl(item.url)}
            value={item.url}
            onChange={(event) => onChange("items", p.items.map((entry, i) => (i === index ? { ...entry, url: event.target.value } : entry)))}
          />
          </div>
        ))}
      </div>
      <div className={s.f}>
        <label className={s.lbl} htmlFor={`st-prod-${block.id}`}>
          Añadir un producto
        </label>
        <div className={s.row}>
          <input id={`st-prod-${block.id}`} className={s.inp} style={{ flex: 1 }} placeholder="Busca por nombre" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter") { event.preventDefault(); setResults(await loadProducts("search", query)); } }} />
          <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={async () => setResults(await loadProducts("search", query))}>
            Buscar
          </button>
        </div>
        {results?.length === 0 ? <p className={s.note}>Ningún producto activo con ese nombre.</p> : null}
        {results?.map((item) => (
          <div key={item.id} className={s.prodPick}>
            {item.image ? <img src={item.image} alt="" /> : <span className={s.ph} />}
            <span style={{ minWidth: 0 }}>
              {item.title}
              <small>{item.price || "Sin precio"}</small>
            </span>
            <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={p.items.length >= MAX_PRODUCTS || p.items.some((entry) => entry.id === item.id)} onClick={() => { onChange("source", "manual"); onChange("items", [...p.items, item]); }}>
              Añadir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialEditor({ block, onChange }: { block: Extract<StudioBlock, { type: "social" }>; onChange: (key: string, value: unknown) => void }) {
  const links = block.props.links;
  return (
    <div className={s.fields}>
      {SOCIAL_NETWORKS.map((name) => {
        const value = links.find((link) => link.name === name)?.url ?? "";
        return (
          <div key={name} className={s.f}>
            <label className={s.lbl} htmlFor={`st-social-${name}`}>
              {name}
            </label>
            <input
              id={`st-social-${name}`}
              className={`${s.inp} ${s.mono}`}
              placeholder={`https://${name.toLowerCase()}.com/tu-cuenta`}
              value={value}
              onChange={(event) => {
                const next = SOCIAL_NETWORKS.map((network) => ({ name: network, url: network === name ? event.target.value : links.find((link) => link.name === network)?.url ?? "" })).filter((link) => link.url);
                onChange("links", next);
              }}
            />
          </div>
        );
      })}
      <p className={s.note}>Solo salen en el email las redes con enlace.</p>
    </div>
  );
}

export function BlockInspector({
  block,
  index,
  total,
  design,
  pieceName,
  images,
  onChange,
  onUpload,
  onAct,
  onAi,
  loadProducts,
}: {
  block: StudioBlock;
  index: number;
  total: number;
  design: StudioDesign;
  pieceName: string;
  images: ImageOption[];
  onChange: (key: string, value: unknown) => void;
  onUpload: (file: File) => Promise<string | null>;
  onAct: (action: "dup" | "del", id: string) => void;
  onAi: (kind: AiKind) => void;
  loadProducts: (source: "best" | "new" | "search", q?: string) => Promise<StudioProduct[]>;
}) {
  let extras: ReactNode = null;
  if (block.type === "button") {
    const p = block.props;
    const ratio = contrast(colorOf(p.bg, design.brand), "#ffffff");
    const words = p.label.trim().split(/\s+/).filter(Boolean).length;
    extras = (
      <>
        {p.style === "solid" ? (
          <div className={s.metric} data-tone={ratio >= 4.5 ? "ok" : "bad"}>
            Contraste {ratio.toFixed(1).replace(".", ",")}:1 · {ratio >= 4.5 ? "pasa AA" : "no pasa AA: el texto blanco no se lee bien"}
          </div>
        ) : null}
        <div className={s.metric} data-tone={words >= 1 && words <= 4 ? "ok" : "warn"}>
          {words >= 1 && words <= 4 ? "Texto corto: bien" : "Mejor de 2 a 4 palabras que empiecen por un verbo"}
        </div>
        {p.utm && isHttpUrl(p.url) ? (
          <div className={s.f}>
            <span className={s.lbl}>Enlace final</span>
            <div className={s.urlPrev}>{withUtm(p.url, pieceName)}</div>
          </div>
        ) : null}
      </>
    );
  }
  const aiKind: AiKind | null = block.type === "button" ? "cta" : block.type === "text" ? "shorter" : block.type === "heading" || block.type === "hero" ? "titles" : null;
  return (
    <>
      <div className={s.inspHead}>
        <span className={s.g}>
          <Icon name={BLOCK_ICON[block.type]} />
        </span>
        <div>
          <b>{BLOCK_LABEL[block.type]}</b>
          <small>
            Bloque {index + 1} de {total}
          </small>
        </div>
      </div>
      {block.type === "products" ? <ProductsEditor block={block} onChange={onChange} loadProducts={loadProducts} /> : null}
      {block.type === "social" ? <SocialEditor block={block} onChange={onChange} /> : null}
      <Fields id={block.id} values={block.props} schema={BLOCK_SCHEMA[block.type]} brand={design.brand} images={images} onChange={onChange} onUpload={onUpload} />
      {block.type === "countdown" ? <p className={s.note}>En el email sale la fecha y la hora: los correos no pueden llevar un reloj que corra.</p> : null}
      {block.type === "coupon" ? <p className={s.note}>El código tiene que existir en Shopify antes de enviar.</p> : null}
      {block.type === "footer" ? <p className={s.note}>Los enlaces de baja y preferencias los pone Klaviyo al enviar.</p> : null}
      {extras}
      {aiKind ? (
        <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => onAi(aiKind)}>
          <Icon name="spark" />
          {aiKind === "cta" ? "Proponer otros textos de botón" : aiKind === "shorter" ? "Reescribir más corto con IA" : "Proponer otros títulos"}
        </button>
      ) : null}
      <div className={s.row}>
        <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => onAct("dup", block.id)}>
          <Icon name="copy" />
          Duplicar
        </button>
        <button type="button" className={buttonVariants({ variant: "destructive", size: "sm" })} onClick={() => onAct("del", block.id)}>
          <Icon name="trash" />
          Borrar
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel izquierdo
// ---------------------------------------------------------------------------

const PALETTE: Array<[string, BlockType[]]> = [
  ["Básicos", ["heading", "text", "button", "image", "divider", "spacer"]],
  ["Tienda", ["products", "coupon", "countdown", "review"]],
  ["Diseño", ["header", "hero", "columns", "video", "social", "footer"]],
];

export const SECTIONS: Record<string, { title: string; detail: string; mini: string[]; blocks: BlockType[] }> = {
  heroProducts: { title: "Portada + productos", detail: "Abre con imagen y enseña tus más vendidos", mini: ["img", "", "btn", "", ""], blocks: ["hero", "products"] },
  benefits: { title: "Tres ventajas", detail: "Envío, devoluciones y lo que os diferencia", mini: ["", "", "", ""], blocks: ["columns"] },
  proof: { title: "Reseña + botón", detail: "Prueba social antes de pedir el clic", mini: ["", "", "btn"], blocks: ["review", "button"] },
  urgency: { title: "Código con fecha", detail: "Cupón y fecha límite juntos", mini: ["", "img", "btn"], blocks: ["coupon", "countdown"] },
  story: { title: "Historia de marca", detail: "Título, texto y vídeo", mini: ["", "", "img"], blocks: ["heading", "text", "video"] },
  close: { title: "Cierre completo", detail: "Redes y pie legal con baja", mini: ["", "", ""], blocks: ["social", "footer"] },
};

export type LeftTab = "bloques" | "secciones" | "capas" | "imagenes" | "marca";

export function LeftPanel({
  channel,
  tab,
  onTab,
  design,
  selectedId,
  images,
  currentImage,
  onAdd,
  onAddSection,
  onSelect,
  onMove,
  onPickImage,
  onUpload,
  onBrand,
  onResetBrand,
}: {
  channel: StudioChannel;
  tab: LeftTab;
  onTab: (tab: LeftTab) => void;
  design: StudioDesign;
  selectedId: string | null;
  images: ImageOption[];
  currentImage: string | null;
  onAdd: (type: BlockType) => void;
  onAddSection: (key: string) => void;
  onSelect: (id: string) => void;
  onMove: (action: "up" | "down", id: string) => void;
  onPickImage: (image: ImageOption) => void;
  onUpload: (file: File) => Promise<string | null>;
  onBrand: (key: string, value: unknown) => void;
  onResetBrand: (() => void) | null;
}) {
  const email = channel === "email";
  const tabs: Array<[LeftTab, string, number?]> = email
    ? [["bloques", "Bloques"], ["secciones", "Secciones"], ["capas", "Capas", design.blocks.length], ["imagenes", "Imágenes"], ["marca", "Marca"]]
    : [["imagenes", "Imágenes"], ["marca", "Marca"]];
  const active = tabs.some(([key]) => key === tab) ? tab : tabs[0]![0];

  let body: ReactNode = null;
  if (active === "bloques") {
    body = (
      <>
        {PALETTE.map(([group, types]) => (
          <div key={group}>
            <p className={s.groupTitle}>{group}</p>
            <div className={s.palette}>
              {types.map((type) => (
                <button key={type} type="button" className={s.pal} draggable onDragStart={(event) => startDrag(event, { kind: "new", type })} onClick={() => onAdd(type)}>
                  <span className={s.glyph}>
                    <Icon name={BLOCK_ICON[type]} />
                  </span>
                  {BLOCK_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className={s.hint}>Arrástralos al email o haz clic para añadirlos debajo del bloque seleccionado.</p>
      </>
    );
  } else if (active === "secciones") {
    body = (
      <>
        <div className={s.sections}>
          {Object.entries(SECTIONS).map(([key, section]) => (
            <button key={key} type="button" className={s.sec} draggable onDragStart={(event) => startDrag(event, { kind: "section", key })} onClick={() => onAddSection(key)}>
              <span className={s.mini}>
                {section.mini.map((kind, index) => (
                  <span key={index} data-k={kind || undefined} />
                ))}
              </span>
              <span>
                <b>{section.title}</b>
                <small>{section.detail}</small>
              </span>
            </button>
          ))}
        </div>
        <p className={s.hint}>Grupos de bloques ya maquetados con tu marca. Luego se editan como cualquier bloque.</p>
      </>
    );
  } else if (active === "capas") {
    body = design.blocks.length ? (
      <div className={s.layers}>
        {design.blocks.map((block, index) => (
          <div
            key={block.id}
            className={s.layer}
            role="button"
            tabIndex={0}
            aria-current={selectedId === block.id}
            onClick={() => onSelect(block.id)}
            onKeyDown={(event) => event.key === "Enter" && onSelect(block.id)}
          >
            <span className={s.n}>{String(index + 1).padStart(2, "0")}</span>
            <span style={{ minWidth: 0 }}>
              <b>{BLOCK_LABEL[block.type]}</b>
              <small>{snippet(block)}</small>
            </span>
            <span className={s.ops}>
              <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Subir" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove("up", block.id); }}>
                <Icon name="up" />
              </button>
              <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Bajar" disabled={index === design.blocks.length - 1} onClick={(event) => { event.stopPropagation(); onMove("down", block.id); }}>
                <Icon name="down" />
              </button>
            </span>
          </div>
        ))}
      </div>
    ) : (
      <p className={s.hint}>Todavía no hay bloques.</p>
    );
  } else if (active === "imagenes") {
    body = (
      <>
        <div>
          <p className={s.groupTitle}>Fotos de tus productos y subidas</p>
          {images.length ? (
            <div className={s.bank}>
              {images.map((image) => (
                <Attachment key={image.src} orientation="vertical" size="xs">
                  <AttachmentMedia variant="image">
                    <img src={image.src} alt="" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{image.label}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentTrigger
                    draggable={email}
                    aria-pressed={currentImage === image.src}
                    aria-label={`Usar ${image.label}`}
                    title={image.label}
                    className={email ? "cursor-grab" : undefined}
                    onDragStart={(event) => startDrag(event, { kind: "img", src: image.src, alt: image.label })}
                    onClick={() => onPickImage(image)}
                  />
                </Attachment>
              ))}
            </div>
          ) : (
            <p className={s.hint}>Cuando Shopify sincronice las fotos de tus productos aparecerán aquí. Mientras, sube las tuyas.</p>
          )}
        </div>
        <label className={buttonVariants({ variant: "secondary" })}>
          <Icon name="upload" />
          Subir imagen
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) await onUpload(file);
            }}
          />
        </label>
        <p className={s.hint}>{email ? "Arrastra una al email para crear un bloque de imagen, o haz clic para ponerla en el bloque seleccionado." : "Haz clic para usarla en la pieza."}</p>
      </>
    );
  } else {
    body = (
      <>
        <div className={s.card}>
          <p className={s.note}>
            Sale de tu <a href="/marketing/guia">Guía de marca</a>. Lo que cambies aquí se aplica solo a esta pieza.
          </p>
          {onResetBrand ? (
            <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={onResetBrand}>
              Volver a la Guía de marca
            </button>
          ) : null}
        </div>
        <Fields
          id="brand"
          values={design.brand}
          brand={design.brand}
          images={images}
          onChange={onBrand}
          onUpload={onUpload}
          schema={[
            { k: "logo", label: "Logotipo (texto)", kind: "text" },
            { k: "primary", label: "Color principal", kind: "hex" },
            { k: "accent", label: "Color de acento", kind: "hex" },
            { k: "text", label: "Color del texto", kind: "hex" },
            { k: "bg", label: "Fondo del email", kind: "hex" },
            { k: "card", label: "Fondo de tarjetas", kind: "hex" },
            { k: "head", label: "Letra de títulos", kind: "seg", options: [["serif", "Serif"], ["sans", "Sans"]] },
            { k: "radius", label: "Esquinas de botones", kind: "range", min: 0, max: 24, unit: " px" },
          ]}
        />
      </>
    );
  }
  return (
    <>
      <div className={s.tabs} role="tablist" aria-label="Añadir">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => onTab(key)}>
            {label}
            {count !== undefined ? <span className={s.badge}>{count}</span> : null}
          </button>
        ))}
      </div>
      <div className={s.pbody}>{body}</div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Revisión e IA
// ---------------------------------------------------------------------------

export function ReviewPanel({ checks, onFix }: { checks: Check[]; onFix: (action: string) => void }) {
  const pending = checks.filter((check) => check.state !== "ok").length;
  const ok = checks.length - pending;
  const pct = checks.length ? Math.round((ok / checks.length) * 100) : 100;
  const blocked = checks.some((check) => check.state === "bad");
  const order = { bad: 0, warn: 1, ok: 2 } as const;
  return (
    <>
      <div className={s.score}>
        <div className={s.ring} style={{ background: `conic-gradient(var(--st-good) ${pct}%, var(--st-line) 0)` }}>
          <span>
            {ok}/{checks.length}
          </span>
        </div>
        <div>
          <b>{pending === 0 ? "Lista para revisión" : pending === 1 ? "Falta 1 cosa" : `Faltan ${pending} cosas`}</b>
          <span className={s.muted}>{blocked ? "Lo rojo no deja enviarla a revisión." : "Se comprueba mientras editas."}</span>
        </div>
      </div>
      <div className={s.checks}>
        {[...checks]
          .sort((a, b) => order[a.state] - order[b.state])
          .map((check) => (
            <div key={check.title} className={s.check} data-state={check.state}>
              <span className={s.st}>{check.state === "ok" ? "✓" : "!"}</span>
              <div>
                <b>{check.title}</b>
                <small>{check.detail}</small>
                {check.fix ? (
                  <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => onFix(check.fix!.action)}>
                    {check.fix.label}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

export type AiKind = "subjects" | "titles" | "cta" | "shorter" | "tone" | "free";

export const AI_ACTIONS: Array<{ kind: AiKind; title: string; detail: string; needs?: BlockType[] }> = [
  { kind: "subjects", title: "3 asuntos", detail: "Con su preheader" },
  { kind: "titles", title: "Otros títulos", detail: "Del título o la portada", needs: ["heading", "hero"] },
  { kind: "cta", title: "Textos de botón", detail: "Cortos y con verbo", needs: ["button", "hero"] },
  { kind: "shorter", title: "Más corto", detail: "El texto seleccionado", needs: ["text"] },
  { kind: "tone", title: "Revisar el tono", detail: "Contra tu Guía de marca" },
];

export function AiPanel({
  channel,
  block,
  suggestions,
  prompt,
  onPrompt,
  onAsk,
  onApply,
  onClear,
  aiReady,
  chat,
}: {
  chat?: ReactNode;
  channel: StudioChannel;
  block: StudioBlock | null;
  suggestions: { kind: AiKind; items: string[] } | null;
  prompt: string;
  onPrompt: (value: string) => void;
  onAsk: (kind: AiKind) => void;
  onApply: (text: string) => void;
  onClear: () => void;
  aiReady: boolean;
}) {
  const applicable = suggestions && suggestions.kind !== "tone" && suggestions.kind !== "free";
  return (
    <>
      <div className={s.ctx}>
        {channel !== "email"
          ? `Trabajando en ${channel === "meta" ? "el anuncio de Meta" : channel === "ig" ? "la publicación de Instagram" : "el popup"}.`
          : block
            ? `Bloque seleccionado: ${BLOCK_LABEL[block.type]} · «${snippet(block).slice(0, 48)}${snippet(block).length > 48 ? "…" : ""}»`
            : "Sin bloque seleccionado: las acciones se aplican al email entero."}
      </div>
      {!aiReady ? <div className={s.metric} data-tone="warn">Falta configurar un proveedor de IA en el servidor.</div> : null}
      {chat}
      <div className={s.aiActions}>
        {AI_ACTIONS.filter((action) => channel === "email" || action.kind === "subjects" || action.kind === "tone").map((action) => {
          const disabled = !aiReady || Boolean(action.needs && !(block && action.needs.includes(block.type)));
          return (
            <button key={action.kind} type="button" disabled={disabled} onClick={() => onAsk(action.kind)} title={disabled && aiReady ? "Selecciona antes un bloque de ese tipo" : undefined}>
              <b>{channel !== "email" && action.kind === "subjects" ? "3 textos" : action.title}</b>
              <small>{disabled && aiReady ? "Selecciona un bloque de ese tipo" : action.detail}</small>
            </button>
          );
        })}
      </div>
      {chat ? null : (
      <div className={s.f}>
        <label className={s.lbl} htmlFor="st-ai-prompt">
          O pídelo con tus palabras
        </label>
        <textarea
          id="st-ai-prompt"
          className={s.inp}
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder="Ej.: menciona que el envío es gratis desde 50 € y cierra con el taller. Si una frase debe salir tal cual, ponla entre comillas."
        />
        <button type="button" className={buttonVariants()} disabled={!aiReady || !prompt.trim()} onClick={() => onAsk("free")}>
          <Icon name="spark" />
          Preguntar al Consultor IA
        </button>
      </div>
      )}
      {suggestions ? (
        <div className={s.fields} aria-live="polite">
          <div className={s.row} style={{ justifyContent: "space-between" }}>
            <span className={s.lbl}>{applicable ? "Propuestas" : "Respuesta"}</span>
            <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Descartar" onClick={onClear}>
              <Icon name="x" />
            </button>
          </div>
          {suggestions.items.map((item, index) => (
            <div key={index} className={s.sugg}>
              <p>{item}</p>
              {applicable ? (
                <div className={s.row}>
                  <button type="button" className={buttonVariants({ size: "sm" })} onClick={() => onApply(item)}>
                    <Icon name="check" />
                    Aplicar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <p className={s.note}>
        Responde el Consultor IA con el contexto de tu tienda y tu Guía de marca. Cuando tengas la respuesta, pulsa «Llevar al editor» en su panel y aparecerá aquí para aplicarla.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Chat con la IA: conversa y cambia el email
// ---------------------------------------------------------------------------

/** upgrade: el saldo se ha agotado; «yes» = quien lo lee puede subir el plan, «ask» = debe avisar al propietario. */
export type ChatMsg = { role: "user" | "assistant"; text: string; labels?: string[]; error?: boolean; upgrade?: "yes" | "ask" };

const CHAT_IDEAS = ["Haz el título más corto", "Pon una imagen del banco en la portada", "Añade los productos más vendidos", "¿Qué mejorarías de este email?"];

export function StudioChat({
  messages,
  busy,
  aiReady,
  canUndo,
  onSend,
  onUndo,
}: {
  messages: ChatMsg[];
  busy: boolean;
  aiReady: boolean;
  canUndo: boolean;
  onSend: (text: string) => void;
  onUndo: () => void;
}) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, busy]);
  const lastChange = messages.map((message) => Boolean(message.labels?.length)).lastIndexOf(true);
  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy || !aiReady) return;
    setDraft("");
    onSend(value);
  };
  return (
    <div className={s.chat}>
      <div className={s.chatLog} aria-live="polite">
        {messages.length === 0 ? (
          <>
            <p className={s.note}>Habla con la IA como con un compañero: pregúntale o pídele cambios y los verás aplicados en el email. Tiene tu marca, tu banco de imágenes y tus productos.</p>
            <div className={s.chatIdeas}>
              {CHAT_IDEAS.map((idea) => (
                <button key={idea} type="button" disabled={!aiReady || busy} onClick={() => send(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {messages.map((message, index) => (
          <div key={index} className={s.bubble} data-role={message.role} data-error={message.error ? "1" : undefined}>
            <p>{message.text}</p>
            {message.labels?.length ? (
              <ul>
                {message.labels.map((label, i) => (
                  <li key={i}>{label}</li>
                ))}
              </ul>
            ) : null}
            {message.upgrade === "yes" ? (
              <Link href="/planes" className={buttonVariants({ size: "sm" })}>
                Mejorar plan
              </Link>
            ) : message.upgrade === "ask" ? (
              <p className={s.note}>Avisa al propietario del plan o a tu consultor para ampliar el saldo.</p>
            ) : null}
            {index === lastChange && canUndo ? (
              <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={onUndo}>
                <Icon name="undo" />
                Deshacer
              </button>
            ) : null}
          </div>
        ))}
        {busy ? <div className={s.bubble} data-role="assistant"><p>Pensando…</p></div> : null}
        <div ref={end} />
      </div>
      <div className={s.chatBox}>
        <textarea
          className={s.inp}
          value={draft}
          disabled={!aiReady}
          rows={2}
          aria-label="Mensaje para la IA"
          placeholder="Ej.: pon el botón en verde y añade un cupón de bienvenida…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <button type="button" className={buttonVariants()} disabled={!aiReady || busy || !draft.trim()} onClick={() => send(draft)}>
          <Icon name="send" />
          Enviar
        </button>
      </div>
    </div>
  );
}
