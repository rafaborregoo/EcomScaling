"use client";

import { ImageOffIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useMarketingPortal } from "../marketing-portal-context";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  ScrollArea,
  Select,
  SearchableSelect,
  AlertTriangleIcon,
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  Badge,
  Banner,
  Button,
  CircleCheckIcon,
  ClockIcon,
  CloseIcon,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Card,
  CardContent,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  ToggleGroup,
  ToggleGroupItem,
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
  visible_message?: string;
  visible_call_to_action?: string;
  design_findings?: Array<{ category: string; evidence: string; location: string; severity: "low" | "medium" | "high"; recommendation: string; confidence: "low" | "medium" | "high" }>;
  ocr_segments?: Array<{ text: string; location: string; legibility: "clear" | "partial" | "illegible"; confidence: "low" | "medium" | "high" }>;
};

type BankImage = {
  id: string;
  public_url: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  pixel_width?: number | null;
  pixel_height?: number | null;
  representation_kind?: string;
  content_revision?: number;
  index_status?: string;
  preview_error?: string | null;
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
  visual_kind: "static_image" | "static_thumbnail" | "video_thumbnail";
  label: string | null;
  asset_hash: string | null;
  created_at: string;
  available: boolean;
  can_extract_video?: boolean;
};
type VisualStore = { id: string; shop_name: string; myshopify_domain: string };

/** Filtros de estado. "sinindexar" es el único que no se deduce de `status`:
 *  la imagen está analizada pero todavía no entró en el contexto del estudio. */
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

/** Texto bajo el nombre en la rejilla: lo que A15 observó, o por qué no está disponible. */
function cardSummary(image: BankImage): string {
  if (image.status === "analyzed") {
    return image.analysis?.description ?? "Ficha lista.";
  }
  if (image.status === "failed") {
    return image.error_reason ?? "No se pudo analizar.";
  }
  if (image.status === "analyzing") return "A15 está analizando el creativo…";
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
  const [selectedCarouselImageIds, setSelectedCarouselImageIds] = useState<string[]>([]);
  const [carouselBrief, setCarouselBrief] = useState("");
  const [imageCreativeBrief, setImageCreativeBrief] = useState("");
  const [metaCandidates, setMetaCandidates] = useState<MetaImageCandidate[] | null>(null);
  const [metaNextCursor, setMetaNextCursor] = useState<string | null>(null);
  const [loadingMetaCandidates, setLoadingMetaCandidates] = useState(false);
  const [importingMetaAssetId, setImportingMetaAssetId] = useState<string | null>(null);
  const [extractingMetaVideoId, setExtractingMetaVideoId] = useState<string | null>(null);
  const [metaImportError, setMetaImportError] = useState<string | null>(null);
  const [stores, setStores] = useState<VisualStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [uploadChannel, setUploadChannel] = useState<"both" | "instagram" | "meta">("both");
  const [sourceFilter, setSourceFilter] = useState<"all" | "instagram" | "meta">("all");
  const [creativeChannel, setCreativeChannel] = useState<"instagram_organic" | "meta_ads">("instagram_organic");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);
  const refreshedPreviewIds = useRef(new Set<string>());
  const router = useRouter();

  const base = organizationId
    ? `/v1/organizations/${organizationId}/instagram/image-bank`
    : null;
  const overlayBase = organizationId
    ? `/v1/organizations/${organizationId}/instagram/overlays`
    : null;

  const load = useCallback(async () => {
    const requestId = ++requestVersion.current;
    if (!base || !canView) {
      setImages([]);
      setIsLoading(false);
      return;
    }
    try {
      const url = new URL(base, window.location.origin);
      if (query.trim()) url.searchParams.set("search", query.trim());
      if (selectedStoreId) url.searchParams.set("store_id", selectedStoreId);
      const response = await apiFetch(`${url.pathname}${url.search}`);
      if (!response.ok) {
        if (requestId === requestVersion.current) setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { images?: BankImage[]; next_cursor?: string | null };
      if (requestId !== requestVersion.current) return;
      setImages(payload.images ?? []);
      setNextCursor(payload.next_cursor ?? null);
      setError(null);
    } catch {
      if (requestId === requestVersion.current) setError("No se pudo cargar el banco de imágenes. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [base, canView, query, selectedStoreId]);

  const loadMore = useCallback(async () => {
    if (!base || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = new URL(base, window.location.origin);
      url.searchParams.set("cursor", nextCursor);
      if (query.trim()) url.searchParams.set("search", query.trim());
      if (selectedStoreId) url.searchParams.set("store_id", selectedStoreId);
      const response = await apiFetch(`${url.pathname}${url.search}`);
      if (!response.ok) { setError(await readApiError(response)); return; }
      const payload = (await response.json()) as { images?: BankImage[]; next_cursor?: string | null };
      setImages((current) => [...current, ...(payload.images ?? []).filter((item) => !current.some((existing) => existing.id === item.id))]);
      setNextCursor(payload.next_cursor ?? null);
    } catch {
      setError("No se pudieron cargar más creativos.");
    } finally { setLoadingMore(false); }
  }, [base, loadingMore, nextCursor, query, selectedStoreId]);

  const refreshPreview = useCallback(async (imageId: string) => {
    if (!base || refreshedPreviewIds.current.has(imageId)) return;
      refreshedPreviewIds.current.add(imageId);
    try {
      const response = await apiFetch(`${base}/${imageId}/preview`);
      if (!response.ok) throw new Error("preview_refresh_failed");
      const payload = (await response.json()) as { url?: string };
      if (payload.url) {
        setImages((current) => current.map((item) => item.id === imageId ? { ...item, public_url: payload.url!, preview_error: null } : item));
        setTimeout(() => refreshedPreviewIds.current.delete(imageId), 4 * 60_000);
      }
    } catch {
      setImages((current) => current.map((item) => item.id === imageId ? { ...item, preview_error: "No se pudo recuperar la vista previa." } : item));
    }
  }, [base]);

  const loadMetaCandidates = useCallback(async (cursor?: string) => {
    if (!base || !canView) return;
    setLoadingMetaCandidates(true);
    setMetaImportError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStoreId) params.set("store_id", selectedStoreId);
      if (cursor) params.set("cursor", cursor);
      const suffix = params.size ? `?${params.toString()}` : "";
      const response = await apiFetch(`${base}/meta-assets${suffix}`);
      if (!response.ok) {
        setMetaImportError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { candidates?: MetaImageCandidate[]; next_cursor?: string | null };
      setMetaCandidates((current) => cursor ? [...(current ?? []), ...(payload.candidates ?? [])] : payload.candidates ?? []);
      setMetaNextCursor(payload.next_cursor ?? null);
    } catch {
      setMetaImportError("No se pudieron cargar las creatividades de Meta.");
    } finally {
      setLoadingMetaCandidates(false);
    }
  }, [base, canView, selectedStoreId]);

  const importMetaCandidate = useCallback(async (candidate: MetaImageCandidate) => {
    if (!base) return;
    setImportingMetaAssetId(candidate.id);
    setMetaImportError(null);
    try {
      const response = await apiFetch(`${base}/meta-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: candidate.id, ...(selectedStoreId ? { store_id: selectedStoreId } : {}) }),
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
  }, [base, load, selectedStoreId]);

  const extractMetaVideo = useCallback(async (candidate: MetaImageCandidate) => {
    if (!base) return;
    setExtractingMetaVideoId(candidate.id);
    setMetaImportError(null);
    try {
      const response = await apiFetch(`${base}/meta-video-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: candidate.id, ...(selectedStoreId ? { store_id: selectedStoreId } : {}) }),
      }, 120_000);
      if (!response.ok) {
        setMetaImportError(await readApiError(response));
        return;
      }
      const payload = await response.json() as { frames?: Array<{ timestamp_seconds: number }> };
      await load();
      toast.success(`Se extrajeron ${payload.frames?.length ?? 0} fotogramas. A15 los analizará en segundo plano.`);
    } catch {
      setMetaImportError("No se pudieron extraer los fotogramas. Puedes importar la miniatura de vídeo disponible.");
    } finally {
      setExtractingMetaVideoId(null);
    }
  }, [base, load, selectedStoreId]);

  useEffect(() => {
    if (!base || !canView) { setStores([]); setSelectedStoreId(""); return; }
    let cancelled = false;
    void apiFetch(`/v1/organizations/${organizationId}/instagram/image-bank-stores`).then(async (response) => {
      if (!response.ok || cancelled) return;
      const payload = await response.json() as { stores?: VisualStore[] };
      if (cancelled) return;
      const allowed = payload.stores ?? [];
      setStores(allowed);
      setSelectedStoreId((current) => current && allowed.some((store) => store.id === current) ? current : allowed.length === 1 ? allowed[0]!.id : "");
    }).catch(() => { if (!cancelled) setStores([]); });
    return () => { cancelled = true; };
  }, [base, canView, organizationId]);

  useEffect(() => {
    requestVersion.current += 1;
    setIsLoading(true);
    setImages([]);
    setExpandedId(null);
    setMetaCandidates(null);
    setMetaNextCursor(null);
    setNextCursor(null);
    refreshedPreviewIds.current.clear();
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedCarouselImageIds([]);
  }, [organizationId, selectedStoreId]);

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
        !(image.status === "analyzed" && image.index_status !== "indexed")
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
    if (!overlayBase || !expandedId) {
      setOverlays([]);
      return;
    }
    let cancelled = false;
    void apiFetch(`${overlayBase}?imageId=${encodeURIComponent(expandedId)}`)
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
  }, [overlayBase, expandedId]);

  function openDetail(image: BankImage) {
    setExpandedId(image.id);
    setMarkdownDraft(image.markdown ?? "");
    setImageCreativeBrief("");
  }

  async function createPiece(
    imageId: string,
    format: "single" | "carousel" | "story",
    creativeBrief = "",
    channel: "instagram_organic" | "meta_ads" = creativeChannel,
  ) {
    if (!overlayBase) return;
    setCreatingPiece(true);
    try {
      const response = await apiFetch(overlayBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_ids: [imageId],
          format,
          name: "Pieza sin título",
          creative_brief: creativeBrief,
          channel,
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const { overlay } = (await response.json()) as { overlay: { id: string } };
      router.push(`/marketing/imagenes/${overlay.id}`);
    } catch {
      toast.danger("No se pudo crear la pieza. Inténtalo de nuevo.");
    } finally {
      setCreatingPiece(false);
    }
  }

  function toggleCarouselImage(imageId: string) {
    setSelectedCarouselImageIds((current) => {
      if (current.includes(imageId)) return current.filter((id) => id !== imageId);
      if (current.length >= 10) {
        toast.danger("Un carrusel admite un máximo de 10 imágenes.");
        return current;
      }
      return [...current, imageId];
    });
  }

  async function createCarousel() {
    if (!overlayBase || selectedCarouselImageIds.length < 2) return;
    setCreatingPiece(true);
    try {
      const response = await apiFetch(overlayBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_ids: selectedCarouselImageIds,
          format: "carousel",
          name: "Carrusel sin título",
          creative_brief: carouselBrief,
          channel: creativeChannel,
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const { overlay } = (await response.json()) as { overlay: { id: string } };
      router.push(`/marketing/imagenes/${overlay.id}`);
    } catch {
      toast.danger("No se pudo crear el carrusel. Inténtalo de nuevo.");
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
      if (activeMembership?.access_scope === "store" && !selectedStoreId) {
        toast.danger("Selecciona la tienda antes de subir los creativos.");
        return;
      }
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
                destination_channels: uploadChannel === "both" ? ["instagram", "meta"] : [uploadChannel],
                ...(selectedStoreId ? { store_id: selectedStoreId } : {}),
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
    [activeMembership?.access_scope, base, load, selectedStoreId, uploadChannel],
  );

  async function saveMarkdown(imageId: string) {
    if (!base) return;
    setBusyId(imageId);
    try {
      const response = await apiFetch(`${base}/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: markdownDraft, expected_revision: images.find((image) => image.id === imageId)?.content_revision ?? 1 }),
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

  async function reindexImage(imageId: string) {
    if (!base) return;
    setReindexingId(imageId);
    try {
      const response = await apiFetch(`${base}/${imageId}/reindex`, { method: "POST" });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success("Ficha reindexada sin volver a analizar la imagen");
      await load();
    } finally { setReindexingId(null); }
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
        (image) => image.status === "analyzed" && image.index_status !== "indexed",
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
        <div className="min-w-0 client-sr-title">
          <h1 className={styles.title}>Creativos de Instagram y Meta Ads</h1>
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
          {stores.length > 1 ? <Field label="Tienda"><SearchableSelect value={selectedStoreId} onChange={setSelectedStoreId} options={[{ value: "", label: "Todas las tiendas autorizadas" }, ...stores.map((store) => ({ value: store.id, label: store.shop_name }))]} /></Field> : null}
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

          <ToggleGroup aria-label="Filtrar por estado" value={statusFilter} onValueChange={setStatusFilter}>
            {statusFilters.map(([key, label, count]) => (
              <ToggleGroupItem key={key} value={key}>
                {label}
                <span className="text-xs text-muted tabular-nums">{count}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <ToggleGroup aria-label="Filtrar por origen" className="ml-auto" value={sourceFilter} onValueChange={setSourceFilter}>
            {(
              [
                ["all", "Todas"],
                ["instagram", "Instagram"],
                ["meta", "Meta"],
              ] as const
            ).map(([key, label]) => (
              <ToggleGroupItem key={key} value={key}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      {importOpen ? (
        <div className={styles.importPanel}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {stores.length > 0 ? <Field label="Tienda del creativo"><SearchableSelect value={selectedStoreId} onChange={setSelectedStoreId} options={[{ value: "", label: "Organización / compartido" }, ...stores.map((store) => ({ value: store.id, label: store.shop_name }))]} /></Field> : null}
            <Field label="Destino de las imágenes que subas"><Select value={uploadChannel} onChange={(value) => setUploadChannel(value === "instagram" || value === "meta" ? value : "both")} options={[{ value: "both", label: "Instagram y Meta Ads" }, { value: "instagram", label: "Instagram" }, { value: "meta", label: "Meta Ads" }]} /></Field>
          </div>
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
              Los vídeos permiten extraer hasta 8 fotogramas uniformes (máximo 3 minutos). Si Meta no autoriza el archivo, se puede importar la miniatura.
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
                    Creativos sincronizados de Meta, cargados por páginas. Al importar, la imagen se
                    copia a tu almacenamiento y ya se ve en el banco.
                  </p>
                  <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
                    {metaCandidates.map((candidate) => (
                      <Item key={candidate.id} variant="outline" size="sm" className="min-w-0" render={<li />}>
                        <ItemContent className="basis-40">
                          <ItemTitle className="block truncate">
                            {candidate.label || candidate.creative_name || "Creatividad de Meta"}
                          </ItemTitle>
                          <ItemDescription className="truncate">
                            {candidate.visual_kind === "video_thumbnail"
                              ? "Miniatura de vídeo"
                              : "Imagen"}{" "}
                            · pieza {candidate.position + 1}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions role="group" aria-label="Acciones del contenido" className="ml-auto">
                          {candidate.can_extract_video ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => void extractMetaVideo(candidate)}
                              disabled={importingMetaAssetId !== null || extractingMetaVideoId !== null}
                            >
                              {extractingMetaVideoId === candidate.id ? "Extrayendo…" : "Extraer fotogramas"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void importMetaCandidate(candidate)}
                            disabled={!candidate.available || importingMetaAssetId !== null || extractingMetaVideoId !== null}
                          >
                            {importingMetaAssetId === candidate.id ? "Importando…" : "Importar"}
                          </Button>
                        </ItemActions>
                      </Item>
                    ))}
                  </ul>
                  {metaNextCursor ? (
                    <div className="flex justify-center">
                      <Button type="button" size="sm" variant="secondary" disabled={loadingMetaCandidates} onClick={() => void loadMetaCandidates(metaNextCursor)}>
                        {loadingMetaCandidates ? "Cargando…" : "Cargar más creativos de Meta"}
                      </Button>
                    </div>
                  ) : null}
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
                hint="Sube creativos de Instagram o impórtalos de Meta Ads. A15 describe la pieza y su texto visible, y señala problemas de diseño para preparar variantes revisables."
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

              {images.some((image) => image.status === "analyzed") ? (
                <Card size="sm" className="mb-4"><CardContent className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                  <div>
                    <p className="text-sm font-medium">Montar carrusel</p>
                    <p className="text-xs text-muted">Selecciona de 2 a 10 imágenes analizadas. Se conservará el orden de selección.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Destino">
                      <Select value={creativeChannel} onChange={(value) => setCreativeChannel(value === "meta_ads" ? "meta_ads" : "instagram_organic")} options={[{ value: "instagram_organic", label: "Instagram" }, { value: "meta_ads", label: "Meta Ads" }]} />
                    </Field>
                    <Field label="Objetivo / contexto de campaña">
                      <Input value={carouselBrief} maxLength={2000} onChange={(event) => setCarouselBrief(event.target.value)} placeholder="Producto, audiencia, objetivo y límites del mensaje" />
                    </Field>
                  </div>
                  <div role="group" aria-label="Acciones del carrusel" className="flex flex-wrap items-center gap-2">
                    <span className="text-sm tabular-nums text-muted">{selectedCarouselImageIds.length}/10</span>
                    <Button type="button" variant="secondary" size="sm" disabled={creatingPiece || selectedCarouselImageIds.length < 2} onClick={() => void createCarousel()}>
                      {creatingPiece ? "Preparando…" : "Crear carrusel"}
                    </Button>
                    {selectedCarouselImageIds.length > 0 ? <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCarouselImageIds([])}>Limpiar</Button> : null}
                  </div>
                </CardContent></Card>
              ) : null}

              {visibleImages.length === 0 && uploading.length === 0 ? (
                <EmptyState
                  title="Nada encaja con esta búsqueda"
                  hint="Prueba con una palabra de lo que se ve en la foto, no solo con el nombre del archivo."
                />
              ) : null}

              <ul className={styles.grid}>
                {uploading.map((name) => (
                  <li key={`uploading-${name}`}>
                    <Attachment orientation="vertical" state="uploading">
                      <AttachmentMedia>
                        <ProgressCircle isIndeterminate aria-label={`Subiendo ${name}`} size="sm" />
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>{name}</AttachmentTitle>
                        <AttachmentDescription>Subiendo…</AttachmentDescription>
                      </AttachmentContent>
                    </Attachment>
                  </li>
                ))}

                {visibleImages.map((image) => {
                  const selected = expandedId === image.id;
                  const needsIndex =
                    image.status === "analyzed" && image.index_status !== "indexed";
                  return (
                    <li key={image.id}>
                      <Attachment
                        orientation="vertical"
                        state={image.status === "failed" ? "error" : image.status === "analyzed" ? "done" : "processing"}
                      >
                        <AttachmentMedia variant="image" className="[&>img]:object-contain">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.public_url}
                            alt={image.analysis?.alt_text ?? image.original_filename}
                            loading="lazy"
                            onError={() => void refreshPreview(image.id)}
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
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle className="flex items-center gap-2">
                            {needsIndex ? (
                              <span
                                className={styles.pendingIndex}
                                title="Analizada, todavía sin entrar en el contexto del estudio"
                              />
                            ) : null}
                            <span className="truncate">{image.original_filename}</span>
                          </AttachmentTitle>
                          <AttachmentDescription className="line-clamp-2 whitespace-normal">
                            {cardSummary(image)}
                          </AttachmentDescription>
                        </AttachmentContent>
                        {image.status === "analyzed" ? (
                          <AttachmentActions>
                            <AttachmentAction
                              size="xs"
                              variant="outline"
                              aria-pressed={selectedCarouselImageIds.includes(image.id)}
                              aria-label={`${selectedCarouselImageIds.includes(image.id) ? "Quitar" : "Añadir"} ${image.original_filename} ${selectedCarouselImageIds.includes(image.id) ? "del" : "al"} carrusel`}
                              onClick={() => toggleCarouselImage(image.id)}
                            >
                              {selectedCarouselImageIds.includes(image.id) ? `✓ ${selectedCarouselImageIds.indexOf(image.id) + 1}` : "＋ Carrusel"}
                            </AttachmentAction>
                          </AttachmentActions>
                        ) : null}
                        <AttachmentTrigger
                          aria-expanded={selected}
                          aria-controls="image-bank-detail"
                          aria-label={`${image.original_filename}. Estado: ${statusLabel[image.status]}. Abrir ficha.`}
                          onClick={() => (selected ? closeDetail() : openDetail(image))}
                        />
                      </Attachment>
                    </li>
                  );
                })}
              </ul>
              {nextCursor ? <div className="flex justify-center py-4"><Button type="button" variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Cargando…" : "Cargar más creativos"}</Button></div> : null}
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
                onError={() => void refreshPreview(expanded.id)}
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
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="destructive"
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
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-danger/10 text-danger">
                      <ImageOffIcon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>¿Eliminar la imagen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borra la imagen y su ficha del contexto. El generador de contenido dejará de usarla. No se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => deleteImage(expanded.id)}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className={styles.detailBody}>
              {expanded.status === "failed" ? (
                <Banner tone="danger" className="text-sm">
                  {expanded.error_reason ?? "El análisis falló. Reintenta cuando quieras."}
                </Banner>
              ) : null}

              {expanded.analysis ? (
                <>
                    <Card size="sm"><CardContent>
                      <p className={EYEBROW}>Lectura A15</p>
                      <p className="mt-1 text-[13px] text-muted">Confianza global: {expanded.analysis.confidence}{expanded.pixel_width && expanded.pixel_height ? ` · ${expanded.pixel_width} × ${expanded.pixel_height}px` : ""}{expanded.representation_kind === "static_thumbnail" ? " · miniatura de vídeo; no es análisis del vídeo completo" : ""}</p>
                      {expanded.analysis.visible_message ? <p className="mt-2 text-[13px]"><span className="font-medium">Mensaje visible:</span> {expanded.analysis.visible_message}</p> : null}
                      {expanded.analysis.visible_call_to_action ? <p className="mt-1 text-[13px]"><span className="font-medium">CTA visible:</span> {expanded.analysis.visible_call_to_action}</p> : null}
                    </CardContent></Card>
                    <Field label="Preparar variante para">
                      <Select value={creativeChannel} onChange={(value) => setCreativeChannel(value === "meta_ads" ? "meta_ads" : "instagram_organic")} options={[{ value: "instagram_organic", label: "Instagram orgánico" }, { value: "meta_ads", label: "Meta Ads" }]} />
                    </Field>
                    <Field label="Brief de campaña (opcional)">
                      <Textarea value={imageCreativeBrief} maxLength={2000} onChange={(event) => setImageCreativeBrief(event.target.value)} placeholder="Objetivo, producto, audiencia, placement y límites del mensaje. Se enviará al editor junto al creativo base." />
                    </Field>
                    {(expanded.analysis.design_findings ?? []).length > 0 ? (
                      <div className="space-y-2">
                        <p className={EYEBROW}>Mejoras de diseño observadas</p>
                        {(expanded.analysis.design_findings ?? []).map((finding, index) => (
                          <Card size="sm" key={`${finding.category}-${index}`}><CardContent>
                            <p className="text-xs font-semibold">{finding.category} · {finding.severity} · confianza {finding.confidence}</p>
                            <p className="mt-1 text-[13px] text-muted">{finding.evidence}{finding.location ? ` (${finding.location})` : ""}</p>
                            <p className="mt-1 text-[13px]">Sugerencia: {finding.recommendation}</p>
                            <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => void createPiece(expanded.id, "single", [`Variante ${creativeChannel === "meta_ads" ? "para Meta Ads" : "para Instagram"} basada en hallazgo A15: ${finding.recommendation}. Evidencia: ${finding.evidence}. Mantén los datos visibles sin inventar claims.`, imageCreativeBrief.trim() ? `Contexto de campaña aportado por el usuario: ${imageCreativeBrief.trim()}` : ""].filter(Boolean).join("\n\n"), creativeChannel)}>Crear variante para {creativeChannel === "meta_ads" ? "Meta Ads" : "Instagram"}</Button>
                          </CardContent></Card>
                        ))}
                      </div>
                    ) : null}
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
                              className={buttonVariants({ variant: "outline", size: "xs" })}
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
                    ? "A15 está analizando el creativo. La ficha aparece aquí al finalizar."
                    : "En cola. Se analiza en segundo plano; puedes seguir trabajando."}
                </p>
              ) : null}

              {expanded.markdown !== null ? (
                <div className="space-y-2 border-t border-edge pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className={EYEBROW}>Ficha visual de A15</p>
                    {!editingMarkdown ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={reindexingId === expanded.id}
                        onClick={() => void reindexImage(expanded.id)}
                      >
                        {reindexingId === expanded.id ? "Reparando índice…" : "Reindexar"}
                      </Button>
                    ) : null}
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
                      <div role="group" aria-label="Acciones de la ficha" className="flex flex-wrap items-center gap-2">
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
                    <ScrollArea className="max-h-64 rounded-md border border-edge bg-surface p-3 font-mono text-xs leading-relaxed"><pre className="whitespace-pre-wrap">
                      {expanded.markdown}
                    </pre></ScrollArea>
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
                          onClick={() => void createPiece(expanded.id, value, imageCreativeBrief)}
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
