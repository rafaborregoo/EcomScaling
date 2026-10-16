import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { c, font } from "../lib/theme";
import { MAX_PRODUCTS, SOCIAL_NETWORKS, type Align, type BlockProps, type StudioBlock, type StudioBrand, type StudioProduct } from "../lib/studio";
import { Sheet } from "./sheet";
import { ColorField, Choice, DateField, Field, ImageField, RemovableRow, Stepper, Toggle, labelStyle, type ImageOption } from "./estudio-campos";

export type BlockCtx = {
  orgId: string;
  brand: StudioBrand;
  images: ImageOption[];
  onUploaded: (img: ImageOption) => void;
  loadProducts: (source: "best" | "new" | "search", q?: string) => Promise<StudioProduct[]>;
};

const ALIGN: Array<{ value: Align; label: string }> = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

/** Los campos de un bloque. `patch` fusiona solo lo que cambia. */
export function BlockEditor({ block, ctx, patch }: { block: StudioBlock; ctx: BlockCtx; patch: (props: Record<string, unknown>) => void }) {
  const { brand } = ctx;
  const img = (label: string, value: string, key: string, altKey?: string, altValue?: string) => (
    <ImageField
      label={label}
      value={value}
      images={ctx.images}
      orgId={ctx.orgId}
      onUploaded={ctx.onUploaded}
      onChange={(src, name) => patch({ [key]: src, ...(altKey && name && !altValue?.trim() ? { [altKey]: name } : {}) })}
    />
  );

  switch (block.type) {
    case "header": {
      const p = block.props;
      return (
        <>
          <Field label="Logo (texto)" value={p.logo} onChange={(v) => patch({ logo: v })} />
          <Field label="Frase bajo el logo" value={p.tagline} onChange={(v) => patch({ tagline: v })} />
          <Choice label="Alineación" value={p.align} options={ALIGN} onChange={(v) => patch({ align: v })} />
          <ColorField label="Fondo" value={p.bg} brand={brand} onChange={(v) => patch({ bg: v })} />
        </>
      );
    }
    case "hero": {
      const p = block.props;
      return (
        <>
          {img("Imagen de portada", p.img, "img", "alt", p.alt)}
          <Field label="Texto alternativo de la imagen" value={p.alt} onChange={(v) => patch({ alt: v })} hint="Es lo que se lee si el correo bloquea las imágenes." />
          <Field label="Título" value={p.title} onChange={(v) => patch({ title: v })} multiline />
          <Field label="Texto" value={p.text} onChange={(v) => patch({ text: v })} multiline />
          <Field label="Texto del botón" value={p.cta} onChange={(v) => patch({ cta: v })} />
          <Field label="Enlace del botón" value={p.url} onChange={(v) => patch({ url: v })} keyboard="url" placeholder="https://" />
          <Toggle label="Añadir UTM al enlace" value={p.utm} onChange={(v) => patch({ utm: v })} />
          <Toggle label="Texto sobre la imagen" value={p.overlay} onChange={(v) => patch({ overlay: v })} />
          <Stepper label="Altura" value={p.height} min={160} max={560} step={20} suffix=" px" onChange={(v) => patch({ height: v })} />
        </>
      );
    }
    case "heading": {
      const p = block.props;
      return (
        <>
          <Field label="Título" value={p.text} onChange={(v) => patch({ text: v })} multiline />
          <Choice label="Nivel" value={p.level} options={[{ value: "h1", label: "H1" }, { value: "h2", label: "H2" }, { value: "h3", label: "H3" }]} onChange={(v) => patch({ level: v })} />
          <Stepper label="Tamaño" value={p.size} min={14} max={56} onChange={(v) => patch({ size: v })} suffix=" px" />
          <Choice label="Grosor" value={p.weight} options={[{ value: "400", label: "Normal" }, { value: "600", label: "Seminegrita" }, { value: "700", label: "Negrita" }, { value: "800", label: "Extra" }]} onChange={(v) => patch({ weight: v })} />
          <Choice label="Alineación" value={p.align} options={ALIGN} onChange={(v) => patch({ align: v })} />
          <ColorField label="Color" value={p.color} brand={brand} onChange={(v) => patch({ color: v })} />
          <Stepper label="Espacio superior" value={p.spacing} min={0} max={48} step={4} suffix=" px" onChange={(v) => patch({ spacing: v })} />
        </>
      );
    }
    case "text": {
      const p = block.props;
      return (
        <>
          <Field label="Texto" value={p.text} onChange={(v) => patch({ text: v })} multiline hint={'Puedes usar {{ first_name|default:"de nuevo" }} para personalizar.'} />
          <Stepper label="Tamaño" value={p.size} min={12} max={28} suffix=" px" onChange={(v) => patch({ size: v })} />
          <Stepper label="Interlineado" value={p.lh} min={1} max={2.2} step={0.1} onChange={(v) => patch({ lh: v })} />
          <Choice label="Alineación" value={p.align} options={ALIGN} onChange={(v) => patch({ align: v })} />
          <ColorField label="Color" value={p.color} brand={brand} onChange={(v) => patch({ color: v })} />
        </>
      );
    }
    case "button": {
      const p = block.props;
      return (
        <>
          <Field label="Texto del botón" value={p.label} onChange={(v) => patch({ label: v })} />
          <Field label="Enlace" value={p.url} onChange={(v) => patch({ url: v })} keyboard="url" placeholder="https://" />
          <Toggle label="Añadir UTM al enlace" value={p.utm} onChange={(v) => patch({ utm: v })} />
          <Choice label="Estilo" value={p.style} options={[{ value: "solid", label: "Relleno" }, { value: "outline", label: "Borde" }, { value: "link", label: "Enlace" }]} onChange={(v) => patch({ style: v })} />
          <ColorField label="Color" value={p.bg} brand={brand} onChange={(v) => patch({ bg: v })} />
          <Stepper label="Redondeo" value={p.radius} min={0} max={32} step={2} suffix=" px" onChange={(v) => patch({ radius: v })} />
          <Toggle label="Ancho completo" value={p.full} onChange={(v) => patch({ full: v })} />
          <Choice label="Alineación" value={p.align} options={ALIGN} onChange={(v) => patch({ align: v })} />
        </>
      );
    }
    case "image": {
      const p = block.props;
      return (
        <>
          {img("Imagen", p.src, "src", "alt", p.alt)}
          <Field label="Texto alternativo" value={p.alt} onChange={(v) => patch({ alt: v })} hint="Es lo que se lee si el correo bloquea las imágenes." />
          <Field label="Enlace al tocarla (opcional)" value={p.url} onChange={(v) => patch({ url: v })} keyboard="url" placeholder="https://" />
        </>
      );
    }
    case "products":
      return <ProductsEditor props={block.props} ctx={ctx} patch={patch} />;
    case "coupon": {
      const p = block.props;
      return (
        <>
          <Field label="Qué da el código" value={p.text} onChange={(v) => patch({ text: v })} multiline />
          <Field label="Código" value={p.code} onChange={(v) => patch({ code: v })} />
          <DateField label="Válido hasta" value={p.until} onChange={(v) => patch({ until: v })} />
        </>
      );
    }
    case "countdown": {
      const p = block.props;
      return (
        <>
          <Field label="Texto" value={p.label} onChange={(v) => patch({ label: v })} />
          <DateField label="Termina el" value={p.until} withTime onChange={(v) => patch({ until: v })} />
        </>
      );
    }
    case "review": {
      const p = block.props;
      return (
        <>
          <Field label="Reseña (copiada tal cual)" value={p.quote} onChange={(v) => patch({ quote: v })} multiline />
          <Field label="Autor" value={p.author} onChange={(v) => patch({ author: v })} />
          <Stepper label="Estrellas" value={p.stars} min={1} max={5} onChange={(v) => patch({ stars: v })} />
        </>
      );
    }
    case "columns": {
      const items = block.props.items;
      const setItem = (i: number, part: Partial<{ t: string; d: string }>) => patch({ items: items.map((it, k) => (k === i ? { ...it, ...part } : it)) });
      return (
        <>
          {items.map((it, i) => (
            <RemovableRow key={i} onRemove={() => patch({ items: items.filter((_, k) => k !== i) })}>
              <Field label={`Ventaja ${i + 1}`} value={it.t} onChange={(v) => setItem(i, { t: v })} />
              <Field label="Detalle" value={it.d} onChange={(v) => setItem(i, { d: v })} />
            </RemovableRow>
          ))}
          {items.length < 4 && <AddRow label="Añadir ventaja" onPress={() => patch({ items: [...items, { t: "", d: "" }] })} />}
        </>
      );
    }
    case "video": {
      const p = block.props;
      return (
        <>
          <Field label="Enlace de YouTube" value={p.url} onChange={(v) => patch({ url: v })} keyboard="url" placeholder="https://www.youtube.com/watch?v=" />
          <Field label="Texto del botón" value={p.caption} onChange={(v) => patch({ caption: v })} />
        </>
      );
    }
    case "divider": {
      const p = block.props;
      return (
        <>
          <Stepper label="Grosor" value={p.width} min={1} max={8} suffix=" px" onChange={(v) => patch({ width: v })} />
          <ColorField label="Color" value={p.color} brand={brand} onChange={(v) => patch({ color: v })} />
        </>
      );
    }
    case "spacer":
      return <Stepper label="Alto" value={block.props.h} min={8} max={120} step={4} suffix=" px" onChange={(v) => patch({ h: v })} />;
    case "social": {
      const links = block.props.links;
      const setLink = (i: number, part: Partial<{ name: string; url: string }>) => patch({ links: links.map((l, k) => (k === i ? { ...l, ...part } : l)) });
      return (
        <>
          {links.map((l, i) => (
            <RemovableRow key={i} onRemove={() => patch({ links: links.filter((_, k) => k !== i) })}>
              <Choice label="Red" value={l.name} options={SOCIAL_NETWORKS.map((n) => ({ value: n, label: n }))} onChange={(v) => setLink(i, { name: v })} />
              <Field label="Enlace" value={l.url} onChange={(v) => setLink(i, { url: v })} keyboard="url" placeholder="https://" />
            </RemovableRow>
          ))}
          {links.length < 6 && <AddRow label="Añadir red" onPress={() => patch({ links: [...links, { name: SOCIAL_NETWORKS[0]!, url: "" }] })} />}
        </>
      );
    }
    case "footer":
      return <Field label="Dirección y datos legales" value={block.props.address} onChange={(v) => patch({ address: v })} multiline hint="El enlace de baja se añade solo." />;
    case "html":
      return <Field label="Código HTML" value={block.props.html} onChange={(v) => patch({ html: v })} multiline />;
  }
}

export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
      <Plus size={18} color={c.accent} />
      <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.accent }}>{label}</Text>
    </Pressable>
  );
}

function ProductsEditor({ props: p, ctx, patch }: { props: BlockProps["products"]; ctx: BlockCtx; patch: (props: Record<string, unknown>) => void }) {
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<StudioProduct[]>([]);

  async function fill(source: "best" | "new") {
    setBusy(true);
    const items = await ctx.loadProducts(source);
    setBusy(false);
    patch({ source, items: items.slice(0, Number(p.cols)) });
  }
  async function run() {
    setBusy(true);
    setFound(await ctx.loadProducts("search", q));
    setBusy(false);
  }
  const has = (id: string) => p.items.some((x) => x.id === id);

  return (
    <>
      <Choice label="Qué productos" value={p.source} options={[{ value: "best", label: "Más vendidos" }, { value: "new", label: "Novedades" }, { value: "manual", label: "Elegirlos yo" }]} onChange={(v) => (v === "manual" ? patch({ source: "manual" }) : void fill(v))} />
      <Choice label="Por fila" value={p.cols} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }]} onChange={(v) => patch({ cols: v })} />
      <Toggle label="Enseñar el precio" value={p.price} onChange={(v) => patch({ price: v })} />
      <Field label="Texto del botón de cada producto" value={p.cta} onChange={(v) => patch({ cta: v })} />
      {busy && <ActivityIndicator color={c.ink} />}
      <Text style={labelStyle}>{`Productos (${p.items.length}/${MAX_PRODUCTS})`}</Text>
      {p.items.map((it) => (
        <RemovableRow key={it.id} onRemove={() => patch({ items: p.items.filter((x) => x.id !== it.id), source: "manual" })}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {it.image ? <Image source={{ uri: it.image }} style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: c.surface }} /> : null}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ fontSize: 14, fontFamily: font.medium, color: c.ink }}>{it.title}</Text>
              <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{it.price}</Text>
            </View>
          </View>
        </RemovableRow>
      ))}
      {p.items.length < MAX_PRODUCTS && <AddRow label="Buscar y añadir producto" onPress={() => { setSearch(true); void run(); }} />}

      <Sheet visible={search} onClose={() => setSearch(false)} title="Añadir producto">
        <Field label="Buscar por nombre" value={q} onChange={setQ} />
        <Pressable onPress={run} style={{ paddingVertical: 8 }}><Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.accent }}>Buscar</Text></Pressable>
        {busy && <ActivityIndicator color={c.ink} />}
        {found.map((it) => (
          <Pressable
            key={it.id}
            disabled={has(it.id) || p.items.length >= MAX_PRODUCTS}
            onPress={() => patch({ source: "manual", items: [...p.items, it] })}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, opacity: has(it.id) ? 0.4 : 1 }}
          >
            {it.image ? <Image source={{ uri: it.image }} style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: c.surface }} /> : null}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ fontSize: 14, fontFamily: font.medium, color: c.ink }}>{it.title}</Text>
              <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{has(it.id) ? "Ya añadido" : it.price}</Text>
            </View>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}
