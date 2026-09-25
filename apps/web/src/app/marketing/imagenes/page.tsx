"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AlertTriangleIcon,
  Badge,
  Banner,
  Button,
  Card,
  CircleCheckIcon,
  ClockIcon,
  CloseIcon,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  Link,
  LoadingBlock,
  PencilIcon,
  ProgressCircle,
  RetryIcon,
  Textarea,
  toast,
  TrashIcon,
  type Tone,
} from "@/components/ui";

type ImageStatus = "queued" | "analyzing" | "analyzed" | "failed";

type ImageAnalysis = {
  description: string;
  objects: string[];
  colors: Array<{ label: string; hex: string }>;
  style: string;
  ocr_text: string;
  suggested_use: string;
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
};

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

  // Al abrir el detalle: lleva el foco al panel y desplázalo a la vista.
  useEffect(() => {
    if (!expandedId) return;
    setEditingMarkdown(false);
    const frame = requestAnimationFrame(() => {
      detailRef.current?.focus();
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    <div className="portal-page space-y-6 sm:space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Heading size="lg">Banco de imágenes</Heading>
          <Link href="/marketing?section=crear" className="text-sm">
            ← Volver a Marketing
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Importa las imágenes con las que vas a trabajar en Instagram. Cada una
          entra en cola y un agente extrae su descripción, objetos, colores,
          texto y uso sugerido. Esa ficha se guarda como contexto y el generador
          de contenido la usa al redactar publicaciones.
        </p>
      </div>

      <Card
        title="Importar imágenes"
        description="PNG, JPG, GIF o WebP · hasta 5 MB cada una. Puedes soltar varias a la vez."
      >
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
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-8 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            isDragging
              ? "border-accent bg-accent/5"
              : "border-separator hover:border-muted"
          }`}
        >
          <span className="font-medium">
            Suelta imágenes aquí o pulsa para elegir
          </span>
          <span id="image-bank-dropzone-hint" className="text-xs text-muted">
            {uploading.length > 0
              ? `Subiendo ${uploading.length}…`
              : "Se procesan una a una en segundo plano"}
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
        {images.length > 0 ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-xs text-muted"
          >
            {counts.analyzed} analizada{counts.analyzed === 1 ? "" : "s"}
            {inProcess > 0 ? ` · ${inProcess} en proceso` : ""}
            {counts.failed > 0 ? ` · ${counts.failed} con error` : ""}
          </p>
        ) : null}
      </Card>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Card
        title="Imágenes del banco"
        description="Todo lo extraído aquí forma el contexto de Instagram. Puedes editar o borrar cada ficha."
      >
        {isLoading ? (
          <LoadingBlock label="Cargando banco…" />
        ) : images.length === 0 && uploading.length === 0 ? (
          <EmptyState
            title="Sin imágenes todavía"
            hint="Importa la primera para empezar a construir el contexto."
          />
        ) : (
          <div className="space-y-6">
            <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {uploading.map((name) => (
                <li
                  key={`uploading-${name}`}
                  className="flex flex-col overflow-hidden border border-separator"
                >
                  <div className="flex h-40 items-center justify-center bg-surface">
                    <ProgressCircle
                      isIndeterminate
                      aria-label={`Subiendo ${name}`}
                      size="sm"
                    />
                  </div>
                  <div className="space-y-1 p-3">
                    <span className="line-clamp-1 text-sm font-medium">
                      {name}
                    </span>
                    <p className="text-xs text-muted">Subiendo…</p>
                  </div>
                </li>
              ))}
              {images.map((image) => {
                const selected = expandedId === image.id;
                return (
                  <li key={image.id}>
                    <button
                      type="button"
                      aria-expanded={selected}
                      aria-controls="image-bank-detail"
                      aria-label={`${image.original_filename}. Estado: ${statusLabel[image.status]}. Abrir detalle.`}
                      onClick={() =>
                        selected ? closeDetail() : openDetail(image)
                      }
                      className={`flex w-full flex-col overflow-hidden border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        selected
                          ? "border-accent"
                          : "border-separator hover:border-muted"
                      }`}
                    >
                      <span className="relative block h-40 overflow-hidden border-b border-separator bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.public_url}
                          alt={
                            image.analysis?.alt_text ?? image.original_filename
                          }
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {image.status === "analyzing" ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                            <ProgressCircle
                              isIndeterminate
                              aria-hidden
                              size="sm"
                            />
                          </span>
                        ) : null}
                      </span>
                      <span className="block space-y-1 p-3">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium">
                            {image.original_filename}
                          </span>
                          <StatusBadge status={image.status} />
                        </span>
                        <span className="line-clamp-2 block text-xs text-muted">
                          {image.status === "analyzed"
                            ? (image.analysis?.description ?? "Ficha lista")
                            : image.status === "failed"
                              ? (image.error_reason ?? "No se pudo analizar")
                              : "Pendiente de análisis"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {expanded ? (
              <div
                id="image-bank-detail"
                ref={detailRef}
                tabIndex={-1}
                role="region"
                aria-label={`Detalle de ${expanded.original_filename}`}
                className="scroll-mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Card
                  kicker={
                    expanded.knowledge_document_id
                      ? "En el contexto de Instagram"
                      : "Analizada · aún sin indexar en contexto"
                  }
                  title={expanded.original_filename}
                  actions={
                    <div className="flex items-center gap-2">
                      <StatusBadge status={expanded.status} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Cerrar detalle"
                        title="Cerrar"
                        onClick={closeDetail}
                      >
                        <CloseIcon aria-hidden />
                      </Button>
                    </div>
                  }
                >
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={expanded.public_url}
                        alt={
                          expanded.analysis?.alt_text ??
                          expanded.original_filename
                        }
                        className="w-full border border-separator object-contain"
                      />
                      <div className="flex flex-wrap gap-2">
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
                          <span className="flex items-center gap-1.5">
                            <RetryIcon aria-hidden />
                            {expanded.status === "failed"
                              ? "Reintentar análisis"
                              : "Volver a analizar"}
                          </span>
                        </Button>
                        <ConfirmDialog
                          status="danger"
                          title="Eliminar imagen"
                          description="Se borra la imagen y su ficha del contexto de Instagram. El generador de contenido dejará de usarla. No se puede deshacer."
                          confirmLabel="Eliminar"
                          onConfirm={() => void deleteImage(expanded.id)}
                          trigger={
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              disabled={busyId === expanded.id}
                            >
                              <span className="flex items-center gap-1.5">
                                <TrashIcon aria-hidden />
                                Eliminar
                              </span>
                            </Button>
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {expanded.status === "failed" ? (
                        <Banner tone="danger" className="text-sm">
                          {expanded.error_reason ??
                            "El análisis falló. Reintenta cuando quieras."}
                        </Banner>
                      ) : null}

                      {expanded.analysis ? (
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className={EYEBROW}>Descripción</p>
                            <p className="mt-1">
                              {expanded.analysis.description}
                            </p>
                          </div>
                          <div>
                            <p className={EYEBROW}>Estilo</p>
                            <p className="mt-1">{expanded.analysis.style}</p>
                          </div>
                          {expanded.analysis.objects.length > 0 ? (
                            <div>
                              <p className={EYEBROW}>Objetos</p>
                              <ul className="mt-1 flex list-none flex-wrap gap-1.5 p-0">
                                {expanded.analysis.objects.map((object) => (
                                  <li key={object}>
                                    <Badge tone="neutral">{object}</Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {expanded.analysis.colors.length > 0 ? (
                            <div>
                              <p className={EYEBROW}>Colores</p>
                              <ul className="mt-1 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
                                {expanded.analysis.colors.map((color) => (
                                  <li
                                    key={color.hex + color.label}
                                    className="flex items-center gap-1.5 text-xs"
                                  >
                                    <span
                                      aria-hidden
                                      className="inline-block h-4 w-4 shrink-0 border border-separator"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    {color.label} · {color.hex}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {expanded.analysis.ocr_text.trim() ? (
                            <div>
                              <p className={EYEBROW}>Texto en la imagen</p>
                              <p className="mt-1 whitespace-pre-wrap">
                                {expanded.analysis.ocr_text}
                              </p>
                            </div>
                          ) : null}
                          <div>
                            <p className={EYEBROW}>Uso sugerido</p>
                            <p className="mt-1">
                              {expanded.analysis.suggested_use}
                            </p>
                          </div>
                          <div>
                            <p className={EYEBROW}>Alt text</p>
                            <p className="mt-1">{expanded.analysis.alt_text}</p>
                          </div>
                        </div>
                      ) : expanded.status !== "failed" ? (
                        <p className="text-sm text-muted">
                          Esperando el análisis…
                        </p>
                      ) : null}

                      {expanded.markdown !== null ? (
                        <div className="space-y-2 border-t border-separator pt-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className={EYEBROW}>Ficha en el contexto</p>
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
                                <span className="flex items-center gap-1.5">
                                  <PencilIcon aria-hidden />
                                  Editar ficha
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
                                  onChange={(event) =>
                                    setMarkdownDraft(event.target.value)
                                  }
                                  maxLength={20000}
                                />
                              </Field>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    busyId === expanded.id ||
                                    markdownDraft.trim() ===
                                      (expanded.markdown ?? "").trim()
                                  }
                                  onClick={() => void saveMarkdown(expanded.id)}
                                >
                                  {busyId === expanded.id
                                    ? "Guardando…"
                                    : "Guardar ficha"}
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
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-separator bg-surface p-3 text-xs leading-5">
                              {expanded.markdown}
                            </pre>
                          )}
                        </div>
                      ) : null}

                      <div className="space-y-2 border-t border-separator pt-4">
                        <p className={EYEBROW}>Piezas con texto</p>
                        {expanded.status !== "analyzed" ? (
                          <p className="text-xs text-muted">
                            Disponible cuando la imagen esté analizada.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs text-muted">
                              Crea una pieza para poner texto encima (borrador de
                              IA, caption y export a PNG). Elige el formato:
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
                                  onClick={() =>
                                    void createPiece(expanded.id, value)
                                  }
                                >
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </>
                        )}
                        {expanded.status === "analyzed" &&
                        overlays.length > 0 ? (
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
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ImageBankPage() {
  return (
    <PortalShell title="Banco de imágenes">
      {(bootstrap) => <ImageBankContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
