"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  ColorField,
  DownloadIcon,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  Input,
  Link,
  LoadingBlock,
  PlusIcon,
  Select,
  Textarea,
  toast,
  TrashIcon,
} from "@/components/ui";

const RENDER_WIDTH = 1080;

type Align = "left" | "center" | "right";
type Format = "single" | "carousel" | "story";
type Ratio = "1:1" | "4:5" | "9:16";

type Block = {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  fontSize: number;
  color: string;
  bgColor: string | null;
  align: Align;
  weight: number;
  lineHeight: number;
};

type Slide = { image_id: string | null; blocks: Block[] };

type Overlay = {
  id: string;
  name: string;
  format: Format;
  ratio: Ratio;
  slides: Slide[];
};

type BankImage = {
  id: string;
  public_url: string;
  original_filename: string;
  status: string;
};

type AiDraftBlock = {
  text: string;
  role: "kicker" | "headline" | "subheadline" | "cta";
  placement: "top" | "center" | "bottom";
  align: Align;
  emphasis: "normal" | "strong";
};

const formatLabel: Record<Format, string> = {
  single: "Imagen única",
  carousel: "Carrusel",
  story: "Historia",
};
const roleFontSize: Record<AiDraftBlock["role"], number> = {
  kicker: 30,
  headline: 78,
  subheadline: 44,
  cta: 38,
};
const placementY: Record<AiDraftBlock["placement"], number> = {
  top: 7,
  center: 40,
  bottom: 74,
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function newBlock(partial: Partial<Block> = {}): Block {
  return {
    id: uid(),
    text: "Texto",
    xPct: 8,
    yPct: 8,
    widthPct: 84,
    fontSize: 64,
    color: "#ffffff",
    bgColor: null,
    align: "left",
    weight: 700,
    lineHeight: 1.15,
    ...partial,
  };
}

function encodeSpec(spec: unknown): string {
  const json = JSON.stringify(spec);
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(json).toString("base64")
      : window.btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function OverlayEditor() {
  const params = useParams<{ overlayId: string }>();
  const overlayId = params.overlayId;
  const { organizationId } = useActiveOrganization();

  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("single");
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [bankImages, setBankImages] = useState<BankImage[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<
    "save" | "ai" | "ai-all" | "caption" | null
  >(null);
  const [dirty, setDirty] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(360);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const base = organizationId
    ? `/v1/organizations/${organizationId}/instagram`
    : null;

  const imagesById = useMemo(() => {
    const map = new Map<string, BankImage>();
    for (const image of bankImages) map.set(image.id, image);
    return map;
  }, [bankImages]);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const update = () => setCanvasWidth(el.clientWidth || 360);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  const load = useCallback(async () => {
    if (!base) return;
    setIsLoading(true);
    try {
      const [overlaysRes, imagesRes] = await Promise.all([
        apiFetch(`${base}/overlays`),
        apiFetch(`${base}/image-bank`),
      ]);
      if (imagesRes.ok) {
        setBankImages(
          ((await imagesRes.json()) as { images: BankImage[] }).images ?? [],
        );
      }
      if (!overlaysRes.ok) {
        setError(await readApiError(overlaysRes));
        return;
      }
      const overlays = (
        (await overlaysRes.json()) as { overlays: Overlay[] }
      ).overlays;
      const overlay = overlays.find((item) => item.id === overlayId) ?? null;
      if (!overlay) {
        setNotFound(true);
        return;
      }
      setName(overlay.name);
      setFormat(overlay.format);
      setRatio(overlay.ratio);
      setSlides(
        (overlay.slides ?? []).map((slide) => ({
          image_id: slide.image_id ?? null,
          blocks: Array.isArray(slide.blocks) ? slide.blocks : [],
        })),
      );
      setCurrent(0);
      setDirty(false);
      setError(null);
    } catch {
      setError("No se pudo cargar la pieza. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [base, overlayId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const scale = canvasWidth / RENDER_WIDTH;
  const slide = slides[current] ?? null;
  const blocks = slide?.blocks ?? [];
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const analyzed = bankImages.filter((image) => image.status === "analyzed");

  function mutateSlides(next: Slide[]) {
    setSlides(next);
    setDirty(true);
  }

  function patchBlock(id: string, patch: Partial<Block>) {
    mutateSlides(
      slides.map((s, index) =>
        index === current
          ? {
              ...s,
              blocks: s.blocks.map((block) =>
                block.id === id ? { ...block, ...patch } : block,
              ),
            }
          : s,
      ),
    );
  }

  function setSlideBlocks(blocksNext: Block[]) {
    mutateSlides(
      slides.map((s, index) =>
        index === current ? { ...s, blocks: blocksNext } : s,
      ),
    );
  }

  function addBlock() {
    const block = newBlock({ yPct: 8 + blocks.length * 6 });
    setSlideBlocks([...blocks, block]);
    setSelectedId(block.id);
  }

  function removeBlock(id: string) {
    setSlideBlocks(blocks.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // El orden importa: en next/og los bloques posteriores se pintan encima.
  function moveBlock(id: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setSlideBlocks(next);
  }

  function addSlide(imageId: string) {
    if (slides.length >= 10) {
      toast.danger("Máximo 10 imágenes por pieza");
      return;
    }
    mutateSlides([...slides, { image_id: imageId, blocks: [] }]);
    setCurrent(slides.length);
    setShowPicker(false);
    if (format === "single") setFormat("carousel");
  }

  function removeSlide(index: number) {
    const next = slides.filter((_, i) => i !== index);
    mutateSlides(next);
    setCurrent((value) => Math.max(0, Math.min(value, next.length - 1)));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    mutateSlides(next);
    setCurrent(target);
  }

  function changeFormat(value: Format) {
    setFormat(value);
    setDirty(true);
    if (value === "story") setRatio("9:16");
    else if (ratio === "9:16") setRatio("4:5");
    if (value === "single" && slides.length > 1) {
      setSlides((current) => current.slice(0, 1));
      setCurrent(0);
    }
  }

  function onPointerDown(event: React.PointerEvent, block: Block) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(block.id);
    dragRef.current = {
      id: block.id,
      startX: event.clientX,
      startY: event.clientY,
      baseX: block.xPct,
      baseY: block.yPct,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPct = ((event.clientX - drag.startX) / rect.width) * 100;
    const dyPct = ((event.clientY - drag.startY) / rect.height) * 100;
    patchBlock(drag.id, {
      xPct: Math.min(96, Math.max(0, drag.baseX + dxPct)),
      yPct: Math.min(96, Math.max(0, drag.baseY + dyPct)),
    });
  }

  function onPointerUp(event: React.PointerEvent) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  }

  function mapDraftBlocks(draft: {
    blocks: AiDraftBlock[];
    palette: { text_hex: string; accent_hex: string };
  }): Block[] {
    const perPlacement: Record<string, number> = {};
    return draft.blocks.map((item) => {
      const offset = perPlacement[item.placement] ?? 0;
      perPlacement[item.placement] = offset + 1;
      return newBlock({
        text: item.text,
        xPct: 8,
        yPct: Math.min(90, placementY[item.placement] + offset * 13),
        widthPct: 84,
        fontSize: roleFontSize[item.role],
        align: item.align,
        weight:
          item.emphasis === "strong" || item.role === "headline" ? 800 : 600,
        color: draft.palette.text_hex,
        bgColor: item.role === "cta" ? draft.palette.accent_hex : null,
        lineHeight: 1.1,
      });
    });
  }

  // Pide a la IA el texto de un slide concreto. Deja el error puesto y devuelve
  // null si falla; el llamador decide si aborta.
  async function fetchDraft(slideIndex: number): Promise<Block[] | null> {
    if (!base) return null;
    const response = await apiFetch(
      `${base}/overlays/${overlayId}/ai-draft`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide_index: slideIndex, objective }),
      },
      120_000,
    );
    if (!response.ok) {
      setError(await readApiError(response));
      return null;
    }
    const draft = (
      (await response.json()) as {
        draft: {
          blocks: AiDraftBlock[];
          palette: { text_hex: string; accent_hex: string };
        };
      }
    ).draft;
    return mapDraftBlocks(draft);
  }

  async function aiDraft() {
    if (!base || !slide?.image_id) return;
    setBusy("ai");
    setError(null);
    try {
      const mapped = await fetchDraft(current);
      if (!mapped) return;
      setSlideBlocks(mapped);
      setSelectedId(mapped[0]?.id ?? null);
      toast.success(`Texto propuesto para el slide ${current + 1}; ajústalo`);
    } finally {
      setBusy(null);
    }
  }

  // "Prompt general": redacta todos los slides con imagen de una pasada. Cada
  // slide sale coherente con su posición (a16 sabe si es gancho, intermedio o
  // CTA). Luego se edita slide a slide como siempre.
  async function aiDraftAll() {
    if (!base) return;
    const targets = slides
      .map((s, index) => ({ image: s.image_id, index }))
      .filter((entry) => entry.image);
    if (targets.length === 0) return;
    setBusy("ai-all");
    setError(null);
    try {
      const next = [...slides];
      let done = 0;
      for (const { index } of targets) {
        const mapped = await fetchDraft(index);
        if (!mapped) return;
        next[index] = { ...next[index], blocks: mapped };
        done += 1;
      }
      mutateSlides(next);
      setSelectedId(null);
      toast.success(
        `Texto propuesto para ${done} ${done === 1 ? "slide" : "slides"}; ajústalo por slide`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!base) return;
    setBusy("save");
    setError(null);
    try {
      const response = await apiFetch(`${base}/overlays/${overlayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, format, ratio, slides }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setDirty(false);
      toast.success("Pieza guardada");
    } finally {
      setBusy(null);
    }
  }

  async function generateCaption() {
    if (!base) return;
    setBusy("caption");
    setError(null);
    try {
      const response = await apiFetch(
        `${base}/overlays/${overlayId}/caption`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective }),
        },
        180_000,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Caption generado; revísalo en Marketing → Borradores");
    } finally {
      setBusy(null);
    }
  }

  const exportLinks = useMemo(() => {
    const slug =
      (name || "instagram")
        .toLowerCase()
        .normalize("NFD")
        .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "instagram";
    const multi = slides.filter((s) => s.image_id).length > 1;
    return slides
      .map((s, index) => {
        const image = s.image_id ? imagesById.get(s.image_id) : null;
        if (!image) return null;
        const spec = encodeSpec({ ratio, blocks: s.blocks });
        return {
          index,
          filename: multi ? `${slug}-${index + 1}.png` : `${slug}.png`,
          href: `/marketing/imagenes/render?src=${encodeURIComponent(
            image.public_url,
          )}&spec=${spec}`,
        };
      })
      .filter(
        (entry): entry is { index: number; filename: string; href: string } =>
          entry !== null,
      );
  }, [slides, ratio, imagesById, name]);

  if (!organizationId) return <EmptyState title="Elige una tienda" hint="" />;
  if (isLoading) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando pieza…" />
      </div>
    );
  }
  if (notFound || (error && slides.length === 0 && !slide)) {
    return (
      <div className="portal-page space-y-4">
        <Link href="/marketing/imagenes" className="text-sm">
          ← Banco de imágenes
        </Link>
        <ErrorBlock>{error ?? "La pieza no existe o no tienes acceso."}</ErrorBlock>
      </div>
    );
  }

  const aspectClass =
    ratio === "1:1"
      ? "aspect-square"
      : ratio === "9:16"
        ? "aspect-[9/16]"
        : "aspect-[4/5]";
  const slideImage = slide?.image_id ? imagesById.get(slide.image_id) : null;

  return (
    <div className="portal-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/marketing/imagenes" className="text-sm">
            ← Banco de imágenes
          </Link>
          <Heading size="lg">Editor de pieza</Heading>
          {dirty ? <Badge tone="warn">Sin guardar</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {slides.length > 1 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null || slides.every((s) => !s.image_id)}
              onClick={() => void aiDraftAll()}
            >
              {busy === "ai-all"
                ? "Redactando toda la pieza…"
                : "Borrador de toda la pieza (IA)"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== null || !slideImage}
            onClick={() => void aiDraft()}
          >
            {busy === "ai"
              ? "Pensando…"
              : slides.length > 1
                ? "Borrador de este slide (IA)"
                : "Borrador de texto (IA)"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== null || slides.every((s) => !s.image_id)}
            onClick={() => void generateCaption()}
          >
            {busy === "caption" ? "Redactando…" : "Generar caption"}
          </Button>
          <Button
            type="button"
            disabled={busy !== null || !dirty}
            onClick={() => void save()}
          >
            {busy === "save" ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* Lienzo + tira de slides */}
        <div className="space-y-4">
          <div
            ref={canvasRef}
            className={`relative w-full max-w-[420px] overflow-hidden border border-separator bg-black ${aspectClass}`}
          >
            {slideImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slideImage.public_url}
                alt={slideImage.original_filename}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/70">
                Este slide no tiene imagen. Elígela en la tira de abajo.
              </div>
            )}
            {blocks.map((block) => (
              <div
                key={block.id}
                role="button"
                tabIndex={0}
                aria-label={`Bloque de texto: ${block.text.slice(0, 40)}`}
                onPointerDown={(event) => onPointerDown(event, block)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 5 : 1;
                  if (event.key === "ArrowLeft")
                    patchBlock(block.id, { xPct: Math.max(0, block.xPct - step) });
                  else if (event.key === "ArrowRight")
                    patchBlock(block.id, {
                      xPct: Math.min(96, block.xPct + step),
                    });
                  else if (event.key === "ArrowUp")
                    patchBlock(block.id, { yPct: Math.max(0, block.yPct - step) });
                  else if (event.key === "ArrowDown")
                    patchBlock(block.id, {
                      yPct: Math.min(96, block.yPct + step),
                    });
                  else return;
                  event.preventDefault();
                }}
                className={`absolute cursor-move touch-none outline-offset-2 ${
                  selectedId === block.id
                    ? "outline outline-2 outline-accent"
                    : ""
                }`}
                style={{
                  left: `${block.xPct}%`,
                  top: `${block.yPct}%`,
                  width: `${block.widthPct}%`,
                  display: "flex",
                  justifyContent:
                    block.align === "center"
                      ? "center"
                      : block.align === "right"
                        ? "flex-end"
                        : "flex-start",
                }}
              >
                <span
                  style={{
                    color: block.color,
                    fontSize: block.fontSize * scale,
                    fontWeight: block.weight,
                    lineHeight: block.lineHeight,
                    textAlign: block.align,
                    whiteSpace: "pre-wrap",
                    ...(block.bgColor
                      ? {
                          backgroundColor: block.bgColor,
                          padding: `${12 * scale}px ${24 * scale}px`,
                        }
                      : {}),
                  }}
                >
                  {block.text || " "}
                </span>
              </div>
            ))}
            {ratio === "9:16" ? (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-[14%] border-b border-dashed border-white/50 bg-black/25"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[14%] border-t border-dashed border-white/50 bg-black/25"
                />
              </>
            ) : null}
          </div>

          {/* Tira de slides */}
          <div>
            <p className={EYEBROW}>
              {format === "single"
                ? "Imagen"
                : format === "story"
                  ? `Historias (${slides.length})`
                  : `Slides del carrusel (${slides.length})`}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {slides.map((s, index) => {
                const image = s.image_id ? imagesById.get(s.image_id) : null;
                return (
                  <li key={index} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Ir al slide ${index + 1}`}
                      aria-current={index === current}
                      onClick={() => {
                        setCurrent(index);
                        setSelectedId(null);
                      }}
                      className={`relative h-20 w-16 overflow-hidden border ${
                        index === current
                          ? "border-accent"
                          : "border-separator hover:border-muted"
                      }`}
                    >
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.public_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-surface text-[10px] text-muted">
                          sin img
                        </span>
                      )}
                      <span className="absolute bottom-0 right-0 bg-black/60 px-1 text-[10px] text-white">
                        {index + 1}
                      </span>
                    </button>
                    {format !== "single" ? (
                      <span className="flex gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Mover antes"
                          onClick={() => moveSlide(index, -1)}
                        >
                          <IconChevronLeft aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Mover después"
                          onClick={() => moveSlide(index, 1)}
                        >
                          <IconChevronRight aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Quitar slide"
                          onClick={() => removeSlide(index)}
                        >
                          <TrashIcon aria-hidden />
                        </Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
              {format !== "single" && slides.length < 10 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowPicker((value) => !value)}
                    className="flex h-20 w-16 flex-col items-center justify-center border border-dashed border-separator text-xs text-muted hover:border-muted"
                  >
                    <PlusIcon aria-hidden />
                    Añadir
                  </button>
                </li>
              ) : null}
            </ul>

            {showPicker ? (
              <div className="mt-3 border border-separator p-3">
                <p className="mb-2 text-xs text-muted">
                  Elige una imagen analizada del banco:
                </p>
                {analyzed.length === 0 ? (
                  <p className="text-xs text-muted">
                    No hay imágenes analizadas todavía.
                  </p>
                ) : (
                  <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {analyzed.map((image) => (
                      <li key={image.id}>
                        <button
                          type="button"
                          aria-label={`Añadir ${image.original_filename}`}
                          onClick={() => addSlide(image.id)}
                          className="block h-16 w-full overflow-hidden border border-separator hover:border-accent"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.public_url}
                            alt={image.original_filename}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <p className="text-xs text-muted">
            Arrastra cada bloque o muévelo con las flechas. Exportación a{" "}
            {ratio === "1:1"
              ? "1080×1080"
              : ratio === "9:16"
                ? "1080×1920"
                : "1080×1350"}{" "}
            px por slide.
          </p>

          {exportLinks.length > 0 ? (
            <div>
              <p className={EYEBROW}>Descargar PNG</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {exportLinks.map((entry) => (
                  <ButtonLink
                    key={entry.index}
                    href={entry.href}
                    variant="secondary"
                    download={entry.filename}
                  >
                    <span className="flex items-center gap-1.5">
                      <DownloadIcon aria-hidden />
                      {exportLinks.length > 1
                        ? `Slide ${entry.index + 1}`
                        : "Descargar"}
                    </span>
                  </ButtonLink>
                ))}
              </div>
              {dirty ? (
                <p className="mt-1 text-xs text-muted">
                  Tienes cambios sin guardar; el PNG usa lo último editado, no lo
                  guardado.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Panel */}
        <div className="space-y-5">
          <Card title="Publicación">
            <div className="space-y-4">
              <Field label="Nombre">
                <Input
                  className="mt-1"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setDirty(true);
                  }}
                  maxLength={160}
                />
              </Field>
              <Field label="Formato">
                <Select
                  aria-label="Formato de publicación"
                  className="mt-1"
                  value={format}
                  onChange={(value) => changeFormat(value as Format)}
                  options={[
                    { value: "single", label: "Publicación de 1 imagen" },
                    { value: "carousel", label: "Carrusel (varias imágenes)" },
                    { value: "story", label: "Historia (secuencia)" },
                  ]}
                />
              </Field>
              {format !== "story" ? (
                <Field label="Proporción">
                  <Select
                    aria-label="Proporción"
                    className="mt-1"
                    value={ratio}
                    onChange={(value) => {
                      setRatio(value as Ratio);
                      setDirty(true);
                    }}
                    options={[
                      { value: "4:5", label: "Vertical 4:5 (feed)" },
                      { value: "1:1", label: "Cuadrado 1:1" },
                    ]}
                  />
                </Field>
              ) : (
                <p className="text-xs text-muted">
                  Las historias son verticales 9:16.
                </p>
              )}
              <Field label="Objetivo (para el borrador de IA y el caption)">
                <Textarea
                  className="mt-1 min-h-20"
                  placeholder="Ej.: anunciar la nueva colección, tono cercano"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  maxLength={800}
                />
              </Field>
            </div>
          </Card>

          <Card
            title={`Texto del slide ${current + 1}`}
            actions={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addBlock}
                disabled={!slide}
              >
                <span className="flex items-center gap-1.5">
                  <PlusIcon aria-hidden />
                  Bloque
                </span>
              </Button>
            }
          >
            {blocks.length === 0 ? (
              <p className="text-sm text-muted">
                Sin bloques. Añade uno o usa «Borrador de texto (IA)».
              </p>
            ) : (
              <ul className="space-y-1.5">
                {blocks.map((block, i) => (
                  <li
                    key={block.id}
                    className={`flex items-center gap-1 border pr-1 transition-colors ${
                      selectedId === block.id
                        ? "border-accent"
                        : "border-separator hover:border-muted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(block.id)}
                      aria-pressed={selectedId === block.id}
                      className="line-clamp-1 flex-1 px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {block.text || "—"}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Subir bloque"
                      title="Subir (se pinta detrás)"
                      disabled={i === 0}
                      onClick={() => moveBlock(block.id, -1)}
                    >
                      <IconChevronUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Bajar bloque"
                      title="Bajar (se pinta encima)"
                      disabled={i === blocks.length - 1}
                      onClick={() => moveBlock(block.id, 1)}
                    >
                      <IconChevronDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Quitar bloque"
                      title="Quitar bloque"
                      onClick={() => removeBlock(block.id)}
                    >
                      <TrashIcon aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selected ? (
            <Card title="Bloque seleccionado">
              <div className="space-y-4">
                <Field label="Texto">
                  <Textarea
                    className="mt-1 min-h-20"
                    value={selected.text}
                    onChange={(event) =>
                      patchBlock(selected.id, { text: event.target.value })
                    }
                    maxLength={400}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tamaño (px a 1080)">
                    <Input
                      className="mt-1"
                      type="number"
                      min={12}
                      max={200}
                      step={2}
                      value={String(selected.fontSize)}
                      onChange={(event) =>
                        patchBlock(selected.id, {
                          fontSize: Number(event.target.value) || 12,
                        })
                      }
                    />
                  </Field>
                  <Field label="Grosor">
                    <Select
                      aria-label="Grosor del texto"
                      className="mt-1"
                      value={String(selected.weight)}
                      onChange={(value) =>
                        patchBlock(selected.id, { weight: Number(value) })
                      }
                      options={[
                        { value: "400", label: "Normal" },
                        { value: "600", label: "Semibold" },
                        { value: "800", label: "Black" },
                      ]}
                    />
                  </Field>
                </div>
                <Field label="Ancho de caja (%)">
                  <Input
                    className="mt-1"
                    type="number"
                    min={10}
                    max={100}
                    step={2}
                    value={String(selected.widthPct)}
                    onChange={(event) =>
                      patchBlock(selected.id, {
                        widthPct: Number(event.target.value) || 10,
                      })
                    }
                  />
                </Field>
                <div>
                  <p className={EYEBROW}>Alineación</p>
                  <div className="mt-1 flex gap-1">
                    {(
                      [
                        ["left", AlignLeftIcon],
                        ["center", AlignCenterIcon],
                        ["right", AlignRightIcon],
                      ] as const
                    ).map(([value, Icon]) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={selected.align === value ? "primary" : "ghost"}
                        aria-label={`Alinear a ${value}`}
                        aria-pressed={selected.align === value}
                        onClick={() => patchBlock(selected.id, { align: value })}
                      >
                        <Icon aria-hidden />
                      </Button>
                    ))}
                  </div>
                </div>
                <ColorField
                  label="Color del texto"
                  value={selected.color}
                  onChange={(hex) => patchBlock(selected.id, { color: hex })}
                />
                <div className="space-y-2">
                  <Checkbox
                    checked={selected.bgColor !== null}
                    onChange={(checked) =>
                      patchBlock(selected.id, {
                        bgColor: checked ? "#000000" : null,
                      })
                    }
                  >
                    Fondo tras el texto (pastilla)
                  </Checkbox>
                  {selected.bgColor !== null ? (
                    <ColorField
                      label="Color del fondo"
                      value={selected.bgColor}
                      onChange={(hex) =>
                        patchBlock(selected.id, { bgColor: hex })
                      }
                    />
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {slides.every((s) => !s.image_id) ? (
            <Banner tone="warn" className="text-sm">
              Añade al menos una imagen para usar el borrador de IA, el caption y
              la exportación.
            </Banner>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OverlayEditorPage() {
  return (
    <PortalShell title="Editor de pieza">{() => <OverlayEditor />}</PortalShell>
  );
}
