"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useMarketingPortal } from "../marketing-portal-context";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AlertTriangleIcon,
  Badge,
  Banner,
  Button,
  CircleCheckIcon,
  ClockIcon,
  CloseIcon,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
  Link,
  LoadingBlock,
  PencilIcon,
  ProgressCircle,
  RetryIcon,
  SearchIcon,
  Textarea,
  toast,
  TrashIcon,
  type Tone,
} from "@/components/ui";
import styles from "./imagenes.module.css";

type ImageStatus = "queued" | "analyzing" | "analyzed" | "failed";

type ImageAnalysis = {
  description: string;
  objects: string[];
  colors: Array<{ label: string; hex: string }>;
  style: string;
  composition?: string;
  aspect_ratio_estimate?: "portrait" | "square" | "landscape" | "panoramic" | "unclear";
  ocr_text: string;
  suggested_use: string;
  inferences?: string[];
  alt_text: string;
  confidence: "low" | "medium" | "high";
};

type BankImage = {
  id: string;
  public_url: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  status: ImageStatus;
  analysis: ImageAnalysis | null;
  markdown: string | null;
  knowledge_document_id: string | null;
  error_reason: string | null;
  attempts: number;
  analyzed_at: string | null;
  created_at: string;
  sources?: Array<{ channel: "instagram" | "meta"; source_kind: string }>;
};

type MetaImageCandidate = {
  id: string;
  creative_id: string;
  creative_name: string | null;
  position: number;
  asset_type: "image" | "video";
  visual_kind: "static_image" | "video_thumbnail";
  label: string | null;
  asset_hash: string | null;
  created_at: string;
  available: boolean;
};

/** Filtros de estado. "sinindexar" es el único que no se deduce de `status`:
 *  la imagen está analizada pero todavía no entró en el contexto de A11. */
type StatusFilter = "all" | "working" | "failed" | "unindexed";

const statusLabel: Record<ImageStatus, string> = {
  queued: "En cola",
  analyzing: "Analizando",
  analyzed: "Analizada",
  failed: "Error",
};

const statusTone: Record<ImageStatus, Tone> = {
  queued: "neutral",
  analyzing: "warn",
  analyzed: "success",
  failed: "danger",
};

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function StatusBadge({ status }: { status: ImageStatus }) {
  const icon =
    status === "analyzing" ? (
      <ProgressCircle isIndeterminate aria-hidden size="sm" className="h-3 w-3" />
    ) : status === "analyzed" ? (
      <CircleCheckIcon aria-hidden className="h-3 w-3" />
    ) : status === "failed" ? (
      <AlertTriangleIcon aria-hidden className="h-3 w-3" />
    ) : (
      <ClockIcon aria-hidden className="h-3 w-3" />
    );
  return (
    <Badge tone={statusTone[status]}>
      <span className="flex items-center gap-1">
        {icon}
        {statusLabel[status]}
      </span>
    </Badge>
  );
}

/** Texto bajo el nombre en la rejilla: lo que A11 vio, o por qué todavía no. */
function cardSummary(image: BankImage): string {
  if (image.status === "analyzed") {
    return image.analysis?.description ?? "Ficha lista.";
  }
  if (image.status === "failed") {
    return image.error_reason ?? "No se pudo analizar.";
  }
  if (image.status === "analyzing") return "A11 la está describiendo…";
  return "En cola; se analiza en segundo plano.";
}

function ImageBankContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const activeMembership = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  );
  const canView =
    ["platform_admin", "consultant"].includes(
      bootstrap.profile.platform_role,
    ) || ["owner", "manager"].includes(activeMembership?.role ?? "");

  const [images, setImages] = useState<BankImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingMarkdown, setEditingMarkdown] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<
    Array<{ id: string; name: string; updated_at: string }>
  >([]);
  const [creatingPiece, setCreatingPiece] = useState(false);
  const [metaCandidates, setMetaCandidates] = useState<MetaImageCandidate[] | null>(null);
  const [loadingMetaCandidates, setLoadingMetaCandidates] = useState(false);
  const [importingMetaAssetId, setImportingMetaAssetId] = useState<string | null>(null);
  const [metaImportError, setMetaImportError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "instagram" | "meta">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const base = organizationId
    ? `/v1/organizations/${organizationId}/instagram/image-bank`
    : null;

  const load = useCallback(async () => {
    if (!base || !canView) {
      setImages([]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await apiFetch(base);
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { images?: BankImage[] };
      setImages(payload.images ?? []);
      setError(null);
    } catch {
      setError("No se pudo cargar el banco de imágenes. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [base, canView]);

  const loadMetaCandidates = useCallback(async () => {
    if (!base || !canView) return;
    setLoadingMetaCandidates(true);
    setMetaImportError(null);
    try {
      const response = await apiFetch(`${base}/meta-assets`);
      if (!response.ok) {
        setMetaImportError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { candidates?: MetaImageCandidate[] };
      setMetaCandidates(payload.candidates ?? []);
    } catch {
      setMetaImportError("No se pudieron cargar las creatividades de Meta.");
    } finally {
      setLoadingMetaCandidates(false);
    }
  }, [base, canView]);

  const importMetaCandidate = useCallback(async (candidate: MetaImageCandidate) => {
    if (!base) return;
    setImportingMetaAssetId(candidate.id);
    setMetaImportError(null);
    try {
      const response = await apiFetch(`${base}/meta-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: candidate.id }),
      });
      if (!response.ok) {
        setMetaImportError(await readApiError(response));
        return;
      }
      await load();
      toast.success(candidate.visual_kind === "video_thumbnail"
        ? "Miniatura de vídeo importada; se analizará como imagen fija en segundo plano."
        : "Imagen importada al banco visual; el análisis se procesa en segundo plano.");
    } catch {
      setMetaImportError("No se pudo importar la imagen de Meta. Vuelve a sincronizar la integración e inténtalo otra vez.");
    } finally {
      setImportingMetaAssetId(null);
    }
  }, [base, load]);

  useEffect(() => {
    void load();
  }, [load]);

  // La cola se procesa en segundo plano: refresca mientras haya trabajo vivo.
  const hasPending =
    uploading.length > 0 ||
    images.some(
      (image) => image.status === "queued" || image.status === "analyzing",
    );
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [hasPending, load]);

  const expanded = images.find((image) => image.id === expandedId) ?? null;

  // El buscador entra en el análisis, que es lo que hace útil al banco: sin
  // esto, la descripción, el texto de la imagen y el uso sugerido se escriben
  // y no los lee nadie.
  const visibleImages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return images.filter((image) => {
      if (
        sourceFilter !== "all" &&
        !image.sources?.some((source) => source.channel === sourceFilter)
      ) {
        return false;
      }
      if (statusFilter === "working" && image.status !== "queued" && image.status !== "analyzing") {
        return false;
      }
      if (statusFilter === "failed" && image.status !== "failed") return false;
      if (
        statusFilter === "unindexed" &&
        !(image.status === "analyzed" && !image.knowledge_document_id)
      ) {
        return false;
      }
      if (!needle) return true;
      const analysis = image.analysis;
      return [
        image.original_filename,
        analysis?.description,
        analysis?.style,
        analysis?.composition,
        analysis?.ocr_text,
        analysis?.suggested_use,
        analysis?.alt_text,
        ...(analysis?.objects ?? []),
        ...(analysis?.inferences ?? []),
        ...(analysis?.colors ?? []).map((color) => color.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [images, sourceFilter, statusFilter, query]);

  // Al abrir el detalle: lleva el foco al panel y desplázalo a la vista.
  useEffect(() => {
    if (!expandedId) return;
    setEditingMarkdown(false);
    const frame = requestAnimationFrame(() => {
      detailRef.current?.focus();
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedId]);

  // Piezas (texto sobre imagen) de la imagen abierta.
  useEffect(() => {
    if (!base || !expandedId) {
      setOverlays([]);
      return;
    }
    let cancelled = false;
    void apiFetch(`${base}/overlays?imageId=${encodeURIComponent(expandedId)}`)
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          overlays?: Array<{ id: string; name: string; updated_at: string }>;
        };
        setOverlays(payload.overlays ?? []);
      })
      .catch(() => {
        /* la lista de piezas es secundaria */
      });
    return () => {
      cancelled = true;
    };
  }, [base, expandedId]);

  function openDetail(image: BankImage) {
    setExpandedId(image.id);
    setMarkdownDraft(image.markdown ?? "");
  }

  async function createPiece(
    imageId: string,
    format: "single" | "carousel" | "story",
  ) {
    if (!base) return;
    setCreatingPiece(true);
    try {
      const response = await apiFetch(`${base}/overlays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_ids: [imageId],
          format,
          name: "Pieza sin título",
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const { overlay } = (await response.json()) as { overlay: { id: string } };
      router.push(`/marketing/imagenes/${overlay.id}`);
    } finally {
      setCreatingPiece(false);
    }
  }

  function closeDetail() {
    setExpandedId(null);
    setEditingMarkdown(false);
  }

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!base) return;
      const valid = files.filter((file) => {
        if (!ACCEPT.split(",").includes(file.type)) {
          toast.danger(`${file.name}: formato no soportado`);
          return false;
        }
        if (file.size > MAX_BYTES) {
          toast.danger(`${file.name}: supera 5 MB`);
          return false;
        }
        return true;
      });
      if (valid.length === 0) return;

      setUploading((current) => [...current, ...valid.map((file) => file.name)]);
      for (const file of valid) {
        try {
          const dataUrl = await readAsDataUrl(file);
          const response = await apiFetch(
            base,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                content_base64: dataUrl,
              }),
            },
            60_000,
          );
          if (!response.ok) toast.danger(await readApiError(response));
        } catch {
          toast.danger(`${file.name}: error de red al subir`);
        } finally {
          setUploading((current) => {
            const index = current.indexOf(file.name);
            if (index === -1) return current;
            const next = [...current];
            next.splice(index, 1);
            return next;
          });
        }
        await load();
      }
    },
    [base, load],
  );

  async function saveMarkdown(imageId: string) {
    if (!base) return;
    setBusyId(imageId);
    try {
      const response = await apiFetch(`${base}/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: markdownDraft }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Ficha actualizada; contexto reindexado");
      setEditingMarkdown(false);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function retryImage(imageId: string) {
    if (!base) return;
    setBusyId(imageId);
    try {
      const response = await apiFetch(`${base}/${imageId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Imagen enviada de nuevo a la cola");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteImage(imageId: string) {
    if (!base) return;
    setBusyId(imageId);
    try {
      const response = await apiFetch(`${base}/${imageId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Imagen eliminada");
      if (expandedId === imageId) closeDetail();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    return images.reduce(
      (acc, image) => {
        acc[image.status] += 1;
        return acc;
      },
      { queued: 0, analyzing: 0, analyzed: 0, failed: 0 } as Record<
        ImageStatus,
        number
      >,
    );
  }, [images]);

  const inProcess = counts.queued + counts.analyzing + uploading.length;
  const unindexedCount = useMemo(
    () =>
      images.filter(
        (image) => image.status === "analyzed" && !image.knowledge_document_id,
      ).length,
    [images],
  );
  const indexedCount = useMemo(
    () => images.filter((image) => image.knowledge_document_id).length,
    [images],
  );

  // Un filtro con cero resultados es ruido: solo se ofrece lo que existe.
  const statusFilters = (
    [
      ["all", "Todas", images.length],
      ["working", "En proceso", inProcess],
      ["failed", "Con error", counts.failed],
      ["unindexed", "Sin indexar", unindexedCount],
    ] as const
  ).filter(([key, , count]) => count > 0 || key === statusFilter);

  const isFiltered = query.trim() !== "" || statusFilter !== "all" || sourceFilter !== "all";

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setSourceFilter("all");
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Elige una tienda"
        hint="El banco de imágenes es de cada tienda."
      />
    );
  }

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="Necesitas ser propietario o manager de la organización, consultor o administrador de plataforma."
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className="min-w-0">
          <p className={styles.crumb}>Marketing / Contenido</p>
          <p className={styles.title}>Banco de imágenes</p>
        </div>
        {images.length > 0 ? (
          <p className={styles.count}>
            {images.length} {images.length === 1 ? "imagen" : "imágenes"}
            {indexedCount > 0 ? ` · ${indexedCount} en el contexto de A11` : ""}
          </p>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            aria-expanded={importOpen}
            onClick={() => setImportOpen((open) => !open)}
          >
            {importOpen ? "Cerrar" : "Importar imágenes"}
          </Button>
        </div>
      </header>

      {images.length > 0 || isFiltered ? (
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <SearchIcon aria-hidden className={styles.searchIcon} />
            <Input
              type="search"
              value={query}
              aria-label="Buscar en el banco"
              placeholder="Busca por lo que se ve: mantel, lino, primer plano…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className={styles.seg} role="group" aria-label="Filtrar por estado">
            {statusFilters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={styles.segBtn}
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                {label}
                <span className={styles.segCount}>{count}</span>
              </button>
            ))}
          </div>

          <div
            className={`${styles.seg} ml-auto`}
            role="group"
            aria-label="Filtrar por origen"
          >
            {(
              [
                ["all", "Todas"],
                ["instagram", "Instagram"],
                ["meta", "Meta"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={styles.segBtn}
                aria-pressed={sourceFilter === key}
                onClick={() => setSourceFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className={styles.importPanel}>
          <button
            type="button"
            aria-label="Importar imágenes: suelta archivos aquí o pulsa para elegir"
            aria-describedby="image-bank-dropzone-hint"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void uploadFiles(Array.from(event.dataTransfer.files));
            }}
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-white p-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isDragging ? "border-accent bg-accent-soft" : "border-edge hover:border-muted"
            }`}
          >
            <span className="text-sm font-medium">
              Suelta imágenes aquí o pulsa para elegir
            </span>
            <span id="image-bank-dropzone-hint" className="text-xs text-muted">
              {uploading.length > 0
                ? `Subiendo ${uploading.length}…`
                : "PNG, JPG, GIF o WebP · hasta 5 MB cada una · se analizan en segundo plano"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void uploadFiles(files);
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (metaCandidates === null) void loadMetaCandidates();
                else setMetaCandidates(null);
              }}
              disabled={loadingMetaCandidates}
            >
              {loadingMetaCandidates
                ? "Cargando Meta…"
                : metaCandidates === null
                  ? "Traer imágenes de Meta"
                  : "Cerrar lista de Meta"}
            </Button>
            <span className="text-xs text-muted">
              Imágenes y fotogramas de portada ya sincronizados. El vídeo completo no se
              importa: solo la imagen fija.
            </span>
          </div>

          {metaImportError ? (
            <div className="mt-3">
              <ErrorBlock>{metaImportError}</ErrorBlock>
            </div>
          ) : null}

          {metaCandidates ? (
            <div className="mt-4 space-y-3 border-t border-edge pt-4">
              {metaCandidates.length === 0 ? (
                <EmptyState
                  title="No hay recursos visuales de Meta disponibles"
                  hint="Sincroniza una cuenta publicitaria y comprueba que tenga imágenes o vídeos con una miniatura disponible."
                />
              ) : (
                <>
                  <p className="text-xs text-muted">
                    Hasta 100 recursos sincronizados más recientes. Meta no expone una
                    miniatura estable, así que aquí van por nombre; al importar, la imagen se
                    copia a tu almacenamiento y ya se ve en el banco.
                  </p>
                  <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
                    {metaCandidates.map((candidate) => (
                      <li
                        key={candidate.id}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-edge bg-white p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {candidate.label || candidate.creative_name || "Creatividad de Meta"}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {candidate.visual_kind === "video_thumbnail"
                              ? "Miniatura de vídeo"
                              : "Imagen"}{" "}
                            · pieza {candidate.position + 1}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void importMetaCandidate(candidate)}
                          disabled={!candidate.available || importingMetaAssetId !== null}
                        >
                          {importingMetaAssetId === candidate.id ? "Importando…" : "Importar"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.banners}>
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      </div>

      <div className={styles.work}>
        <section className={styles.gallery} aria-label="Imágenes del banco">
          {isLoading ? (
            <LoadingBlock label="Cargando banco…" />
          ) : images.length === 0 && uploading.length === 0 ? (
            <div className="mx-auto max-w-xl py-12">
              <EmptyState
                title="Sin imágenes todavía"
                hint="Cada imagen que subas se copia a tu almacenamiento, A11 la describe (qué se ve, colores, texto dentro de la imagen) y queda buscable para escribir con ella."
              />
              <div className="mt-4 flex justify-center">
                <Button type="button" onClick={() => setImportOpen(true)}>
                  Importar las primeras imágenes
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.resultLine}>
                <span>
                  {isFiltered
                    ? `${visibleImages.length} ${visibleImages.length === 1 ? "imagen" : "imágenes"}${query.trim() ? ` para «${query.trim()}»` : ""}`
                    : "La búsqueda entra en la descripción, los objetos y el texto de cada imagen"}
                </span>
                {isFiltered ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                    Quitar filtros
                  </Button>
                ) : null}
              </div>

              {visibleImages.length === 0 && uploading.length === 0 ? (
                <EmptyState
                  title="Nada encaja con esta búsqueda"
                  hint="Prueba con una palabra de lo que se ve en la foto, no solo con el nombre del archivo."
                />
              ) : null}

              <ul className={styles.grid}>
                {uploading.map((name) => (
                  <li key={`uploading-${name}`}>
                    <div className={styles.card}>
                      <div className={styles.media}>
                        <ProgressCircle
                          isIndeterminate
                          aria-label={`Subiendo ${name}`}
                          size="sm"
                        />
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardName}>
                          <span>{name}</span>
                        </div>
                        <p className={styles.cardSub}>Subiendo…</p>
                      </div>
                    </div>
                  </li>
                ))}

                {visibleImages.map((image) => {
                  const selected = expandedId === image.id;
                  const needsIndex =
                    image.status === "analyzed" && !image.knowledge_document_id;
                  return (
                    <li key={image.id}>
                      <button
                        type="button"
                        aria-expanded={selected}
                        aria-controls="image-bank-detail"
                        aria-label={`${image.original_filename}. Estado: ${statusLabel[image.status]}. Abrir ficha.`}
                        onClick={() => (selected ? closeDetail() : openDetail(image))}
                        className={styles.card}
                      >
                        <span className={styles.media}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.public_url}
                            alt={image.analysis?.alt_text ?? image.original_filename}
                            loading="lazy"
                          />
                          {image.status === "analyzing" ? (
                            <span className={styles.mediaBusy}>
                              <ProgressCircle isIndeterminate aria-hidden size="sm" />
                            </span>
                          ) : null}
                          {/* Estado solo cuando hay algo que mirar: una marca verde en
                              cada tarjeta analizada no informa de nada. */}
                          {image.status !== "analyzed" ? (
                            <span className={styles.mark} data-s={image.status}>
                              {statusLabel[image.status]}
                            </span>
                          ) : null}
                          {(image.sources ?? []).length > 0 ? (
                            <span className={styles.origins}>
                              {(image.sources ?? []).map((source) => (
                                <span
                                  key={`${image.id}-${source.channel}-${source.source_kind}`}
                                  className={styles.origin}
                                >
                                  {source.channel === "meta" ? "Meta" : "Instagram"}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.cardBody}>
                          <span className={styles.cardName}>
                            {needsIndex ? (
                              <span
                                className={styles.pendingIndex}
                                title="Analizada, aún sin indexar en el contexto"
                              />
                            ) : null}
                            <span>{image.original_filename}</span>
                          </span>
                          <span className={styles.cardSub} data-s={image.status}>
                            {cardSummary(image)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {expanded ? (
          <aside
            id="image-bank-detail"
            ref={detailRef}
            tabIndex={-1}
            className={styles.detail}
            aria-label={`Ficha de ${expanded.original_filename}`}
          >
            <div className={styles.detailHead}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {expanded.original_filename}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {expanded.knowledge_document_id
                    ? "En el contexto de Marketing: A11 puede proponerla al escribir."
                    : expanded.status === "analyzed"
                      ? "Analizada, aún sin indexar: A11 todavía no la ve."
                      : "Todavía no entra en el contexto."}
                </p>
              </div>
              <StatusBadge status={expanded.status} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Cerrar ficha"
                onClick={closeDetail}
              >
                <CloseIcon aria-hidden />
              </Button>
            </div>

            <div className={styles.detailPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={expanded.public_url}
                alt={expanded.analysis?.alt_text ?? expanded.original_filename}
              />
            </div>

            <div className={styles.detailActions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  busyId === expanded.id ||
                  expanded.status === "queued" ||
                  expanded.status === "analyzing"
                }
                onClick={() => void retryImage(expanded.id)}
              >
                <span className="flex items-center gap-2">
                  <RetryIcon aria-hidden />
                  {expanded.status === "failed" ? "Reintentar" : "Volver a analizar"}
                </span>
              </Button>
              <ConfirmDialog
                status="danger"
                title="Eliminar imagen"
                description="Se borra la imagen y su ficha del contexto. El generador de contenido dejará de usarla. No se puede deshacer."
                confirmLabel="Eliminar"
                onConfirm={() => void deleteImage(expanded.id)}
                trigger={
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={busyId === expanded.id}
                  >
                    <span className="flex items-center gap-2">
                      <TrashIcon aria-hidden />
                      Eliminar
                    </span>
                  </Button>
                }
              />
            </div>

            <div className={styles.detailBody}>
              {expanded.status === "failed" ? (
                <Banner tone="danger" className="text-sm">
                  {expanded.error_reason ?? "El análisis falló. Reintenta cuando quieras."}
                </Banner>
              ) : null}

              {expanded.analysis ? (
                <>
                  <div>
                    <p className={EYEBROW}>Qué se ve</p>
                    <p className="mt-1 text-[13px] leading-relaxed">
                      {expanded.analysis.description}
                    </p>
                  </div>

                  {expanded.analysis.objects.length > 0 ? (
                    <div>
                      <p className={EYEBROW}>Objetos · pulsa para buscar</p>
                      <ul className="mt-1 flex list-none flex-wrap gap-2 p-0">
                        {expanded.analysis.objects.map((object) => (
                          <li key={object}>
                            {/* El análisis deja de ser un texto muerto: cada objeto
                                filtra el banco. */}
                            <button
                              type="button"
                              className="rounded-md border border-edge px-2 py-1 text-xs transition-colors hover:border-accent"
                              onClick={() => {
                                setQuery(object);
                                setStatusFilter("all");
                                setSourceFilter("all");
                              }}
                            >
                              {object}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {expanded.analysis.colors.length > 0 ? (
                    <div>
                      <p className={EYEBROW}>Colores</p>
                      <ul className="mt-1 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
                        {expanded.analysis.colors.map((color) => (
                          <li
                            key={color.hex + color.label}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              aria-hidden
                              className="inline-block size-4 shrink-0 rounded-md border border-edge"
                              style={{ backgroundColor: color.hex }}
                            />
                            {color.label}
                            <span className="tabular-nums text-muted">{color.hex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {expanded.analysis.ocr_text.trim() ? (
                    <div>
                      <p className={EYEBROW}>Texto dentro de la imagen</p>
                      <p className="mt-1 whitespace-pre-wrap rounded-md border border-edge bg-surface p-3 text-[13px] leading-relaxed">
                        {expanded.analysis.ocr_text}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <p className={EYEBROW}>Composición</p>
                    <p className="mt-1 text-[13px] leading-relaxed">
                      {expanded.analysis.composition ??
                        "No incluido en el análisis anterior."}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Proporción estimada:{" "}
                      {expanded.analysis.aspect_ratio_estimate ?? "no disponible"} ·{" "}
                      {expanded.analysis.style}
                    </p>
                  </div>

                  <div>
                    <p className={EYEBROW}>Para qué sirve</p>
                    <p className="mt-1 text-[13px] leading-relaxed">
                      {expanded.analysis.suggested_use}
                    </p>
                  </div>

                  {(expanded.analysis.inferences?.length ?? 0) > 0 ? (
                    <div>
                      <p className={EYEBROW}>Inferencias visuales · revisar</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-muted">
                        {expanded.analysis.inferences?.map((inference, index) => (
                          <li key={`${index}-${inference}`}>{inference}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div>
                    <p className={EYEBROW}>Alt text</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {expanded.analysis.alt_text}
                    </p>
                  </div>
                </>
              ) : expanded.status !== "failed" ? (
                <p className="text-[13px] text-muted">
                  {expanded.status === "analyzing"
                    ? "A11 la está describiendo. La ficha aparece aquí en cuanto termine."
                    : "En cola. Se analiza en segundo plano; puedes seguir trabajando."}
                </p>
              ) : null}

              {expanded.markdown !== null ? (
                <div className="space-y-2 border-t border-edge pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className={EYEBROW}>Ficha que lee A11</p>
                    {!editingMarkdown ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMarkdownDraft(expanded.markdown ?? "");
                          setEditingMarkdown(true);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <PencilIcon aria-hidden />
                          Editar
                        </span>
                      </Button>
                    ) : null}
                  </div>

                  {editingMarkdown ? (
                    <div className="space-y-2">
                      <Field label="Ficha (markdown)">
                        <Textarea
                          className="mt-1 min-h-56 font-mono text-xs"
                          value={markdownDraft}
                          onChange={(event) => setMarkdownDraft(event.target.value)}
                          maxLength={20000}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            busyId === expanded.id ||
                            markdownDraft.trim() === (expanded.markdown ?? "").trim()
                          }
                          onClick={() => void saveMarkdown(expanded.id)}
                        >
                          {busyId === expanded.id ? "Guardando…" : "Guardar ficha"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === expanded.id}
                          onClick={() => {
                            setMarkdownDraft(expanded.markdown ?? "");
                            setEditingMarkdown(false);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-edge bg-surface p-3 font-mono text-xs leading-relaxed">
                      {expanded.markdown}
                    </pre>
                  )}
                </div>
              ) : null}

              <div className="space-y-2 border-t border-edge pt-4">
                <p className={EYEBROW}>Piezas con texto</p>
                {expanded.status !== "analyzed" ? (
                  <p className="text-xs text-muted">
                    Disponible cuando la imagen esté analizada.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted">
                      Pon texto encima: borrador de IA, caption y export a PNG.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["single", "Imagen única"],
                          ["carousel", "Carrusel"],
                          ["story", "Historia"],
                        ] as const
                      ).map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={creatingPiece}
                          onClick={() => void createPiece(expanded.id, value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                {expanded.status === "analyzed" && overlays.length > 0 ? (
                  <ul className="space-y-1 pt-1">
                    {overlays.map((overlay) => (
                      <li key={overlay.id}>
                        <Link
                          href={`/marketing/imagenes/${overlay.id}`}
                          className="text-sm"
                        >
                          {overlay.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export default function ImageBankPage() {
  const { bootstrap } = useMarketingPortal();
  return <ImageBankContent bootstrap={bootstrap} />;
}
