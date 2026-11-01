"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  Button,
  ColorField,
  EYEBROW,
  Field,
  Input,
  Select,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  UploadButton,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  IconChevronDown,
} from "@/components/ui";
import {
  FONT_OPTIONS,
  newBlock,
  parseYouTubeId,
  renderTemplateHtml,
  type BlockAlign,
  type ColumnCell,
  type TemplateBlock,
  type TemplateDesign,
} from "./template-design";

const BLOCK_TYPES: Array<{ type: TemplateBlock["type"]; label: string }> = [
  { type: "heading", label: "Título" },
  { type: "text", label: "Texto" },
  { type: "button", label: "Botón" },
  { type: "image", label: "Imagen" },
  { type: "columns", label: "Columnas" },
  { type: "youtube", label: "YouTube" },
  { type: "divider", label: "Separador" },
  { type: "spacer", label: "Espacio" },
];

const BLOCK_LABEL: Record<TemplateBlock["type"], string> = Object.fromEntries(
  BLOCK_TYPES.map((entry) => [entry.type, entry.label]),
) as Record<TemplateBlock["type"], string>;

const ALIGN_OPTIONS = [
  { key: "left", label: "Alinear a la izquierda", Icon: AlignLeftIcon },
  { key: "center", label: "Centrar", Icon: AlignCenterIcon },
  { key: "right", label: "Alinear a la derecha", Icon: AlignRightIcon },
] as const;

/** Mensajes que el lienzo (iframe) manda al panel. Ver `CANVAS_SCRIPT`. */
type CanvasMessage =
  | { tpl: 1; t: "select"; id: string | null }
  | { tpl: 1; t: "text"; id: string; value: string }
  | { tpl: 1; t: "act"; a: "up" | "down" | "dup" | "del"; id: string };

function AlignField({
  value,
  onChange,
}: {
  value: BlockAlign;
  onChange: (align: BlockAlign) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Alineación"
      value={value}
      onValueChange={(next) => onChange(next as BlockAlign)}
    >
      {ALIGN_OPTIONS.map(({ key, label, Icon }) => (
        <ToggleGroupItem key={key} value={key} size="icon-sm" aria-label={label}>
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function ImageUploadButton({
  onUpload,
  onDone,
}: {
  onUpload: (file: File) => Promise<string>;
  onDone: (url: string) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <UploadButton
        accept="image/png,image/jpeg,image/gif,image/webp"
        onFile={async (file) => {
          setErr(null);
          try {
            onDone(await onUpload(file));
          } catch (uploadError) {
            setErr(
              uploadError instanceof Error
                ? uploadError.message
                : "No se pudo subir la imagen.",
            );
          }
        }}
      >
        Subir desde el ordenador
      </UploadButton>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
    </div>
  );
}

/**
 * AI-11 fase 4: el editor se manipula sobre la propia pieza.
 *
 * Antes habia una lista de bloques a la izquierda y una vista previa muerta a
 * la derecha: se escribia en un sitio y se miraba en otro, y ordenar exigia
 * arrastrar filas que no se parecian al email. Ahora el lienzo es el editor
 * (clic para seleccionar, escribir encima del texto, barra del bloque para
 * subir/bajar/duplicar/borrar) y el panel solo guarda lo que no se puede tocar
 * mirando: colores, enlaces, tamaños y estilos generales.
 */
export function TemplateBuilder({
  design,
  onChange,
  onUploadImage,
  onSelect,
}: {
  design: TemplateDesign;
  onChange: (design: TemplateDesign) => void;
  /** Sube un archivo y devuelve la URL pública para el bloque `image`. */
  onUploadImage?: (file: File) => Promise<string>;
  /**
   * Qué bloque está seleccionado, para quien monta el compositor alrededor:
   * "insertar campo" necesita saber dónde escribir. El editor sigue siendo el
   * dueño de la selección; esto solo la cuenta hacia fuera.
   */
  onSelect?: (id: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(
    "desktop",
  );
  const [canvasHtml, setCanvasHtml] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Al escribir sobre el lienzo el texto YA esta pintado ahi. Volver a
  // inyectar `srcDoc` recargaria el iframe y se perderia el cursor en cada
  // tecla, asi que el render se salta exactamente ese cambio.
  const skipSyncRef = useRef(false);

  const selected = design.blocks.find((block) => block.id === selectedId) ?? null;

  useEffect(() => {
    onSelect?.(selectedId);
  }, [onSelect, selectedId]);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setCanvasHtml(renderTemplateHtml(design, { editable: true, selectedId }));
  }, [design, selectedId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // El lienzo va en un iframe sin `allow-same-origin`: su origen es opaco
      // y lo unico fiable para saber que el mensaje es suyo es la ventana.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data as CanvasMessage | null;
      if (!message || message.tpl !== 1) return;

      if (message.t === "select") {
        setSelectedId(message.id);
        return;
      }
      if (message.t === "text") {
        const block = design.blocks.find((entry) => entry.id === message.id);
        if (!block) return;
        skipSyncRef.current = true;
        onChange({
          ...design,
          blocks: design.blocks.map((entry) =>
            entry.id === message.id
              ? ({ ...entry, text: message.value } as TemplateBlock)
              : entry,
          ),
        });
        return;
      }
      if (message.t === "act") {
        const index = design.blocks.findIndex(
          (entry) => entry.id === message.id,
        );
        if (index < 0) return;
        const blocks = [...design.blocks];
        if (message.a === "del") {
          blocks.splice(index, 1);
          setSelectedId(null);
        } else if (message.a === "dup") {
          const source = blocks[index];
          const copy = {
            ...source,
            id: newBlock(source.type, design.styles).id,
          } as TemplateBlock;
          blocks.splice(index + 1, 0, copy);
          setSelectedId(copy.id);
        } else {
          const target = message.a === "up" ? index - 1 : index + 1;
          if (target < 0 || target >= blocks.length) return;
          [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
        }
        onChange({ ...design, blocks });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [design, onChange]);

  function setStyles(patch: Partial<TemplateDesign["styles"]>) {
    onChange({ ...design, styles: { ...design.styles, ...patch } });
  }
  function addBlock(type: TemplateBlock["type"]) {
    const block = newBlock(type, design.styles);
    onChange({ ...design, blocks: [...design.blocks, block] });
    setSelectedId(block.id);
  }
  function updateBlock(id: string, patch: Partial<TemplateBlock>) {
    onChange({
      ...design,
      blocks: design.blocks.map((block) =>
        block.id === id ? ({ ...block, ...patch } as TemplateBlock) : block,
      ),
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={EYEBROW}>Lienzo</p>
          <ToggleGroup
            aria-label="Ancho de la vista"
            value={device}
            onValueChange={(next) =>
              setDevice(next as "mobile" | "tablet" | "desktop")
            }
          >
            <ToggleGroupItem value="mobile">Móvil</ToggleGroupItem>
            <ToggleGroupItem value="tablet">Tablet</ToggleGroupItem>
            <ToggleGroupItem value="desktop">Escritorio</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div
          className="mx-auto w-full border border-separator bg-white"
          style={{
            maxWidth:
              device === "mobile"
                ? "390px"
                : device === "tablet"
                  ? "600px"
                  : "100%",
          }}
        >
          <iframe
            ref={iframeRef}
            title="Lienzo de la plantilla"
            srcDoc={canvasHtml}
            sandbox="allow-scripts"
            className="h-[68vh] min-h-[460px] w-full bg-white"
          />
        </div>
        <p className="text-xs text-muted">
          Haz clic en un bloque para seleccionarlo. Los textos, los títulos y
          los botones se escriben encima; la barra azul del bloque lo sube,
          baja, duplica o borra.
        </p>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4">
        <div>
          <p className={EYEBROW}>Añadir bloque</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BLOCK_TYPES.map((entry) => (
              <Button
                key={entry.type}
                size="sm"
                variant="secondary"
                onClick={() => addBlock(entry.type)}
              >
                + {entry.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="border border-separator p-3">
          {!selected ? (
            <p className="text-sm text-muted">
              Selecciona un bloque del lienzo para ajustar sus colores, enlaces
              y alineación.
            </p>
          ) : (
            <div className="space-y-3">
              <p className={EYEBROW}>{BLOCK_LABEL[selected.type]}</p>

              {selected.type === "heading" ? (
                <>
                  <Field label="Tamaño">
                    <Select
                      className="mt-1"
                      aria-label="Tamaño del título"
                      value={selected.size}
                      onChange={(value) =>
                        updateBlock(selected.id, {
                          size: value as "sm" | "md" | "lg",
                        })
                      }
                      options={[
                        { value: "sm", label: "Pequeño" },
                        { value: "md", label: "Mediano" },
                        { value: "lg", label: "Grande" },
                      ]}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <AlignField
                      value={selected.align}
                      onChange={(align) => updateBlock(selected.id, { align })}
                    />
                    <ColorField
                      label="Color"
                      value={selected.color ?? design.styles.text}
                      onChange={(hex) => updateBlock(selected.id, { color: hex })}
                    />
                  </div>
                </>
              ) : null}

              {selected.type === "text" ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <AlignField
                      value={selected.align}
                      onChange={(align) => updateBlock(selected.id, { align })}
                    />
                    <ColorField
                      label="Color"
                      value={selected.color ?? design.styles.text}
                      onChange={(hex) => updateBlock(selected.id, { color: hex })}
                    />
                  </div>
                </>
              ) : null}

              {selected.type === "button" ? (
                <>
                  <Field label="Enlace (https://)">
                    <Input
                      className="mt-1"
                      value={selected.href}
                      onChange={(event) =>
                        updateBlock(selected.id, { href: event.target.value })
                      }
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <AlignField
                      value={selected.align}
                      onChange={(align) => updateBlock(selected.id, { align })}
                    />
                    <ColorField
                      label="Fondo"
                      value={selected.bg ?? design.styles.primary}
                      onChange={(hex) => updateBlock(selected.id, { bg: hex })}
                    />
                    <ColorField
                      label="Texto"
                      value={selected.color ?? "#ffffff"}
                      onChange={(hex) => updateBlock(selected.id, { color: hex })}
                    />
                  </div>
                </>
              ) : null}

              {selected.type === "image" ? (
                <>
                  {onUploadImage ? (
                    <ImageUploadButton
                      onUpload={onUploadImage}
                      onDone={(url) => updateBlock(selected.id, { src: url })}
                    />
                  ) : null}
                  <Field label="URL de la imagen (https://)">
                    <Input
                      className="mt-1"
                      value={selected.src}
                      onChange={(event) =>
                        updateBlock(selected.id, { src: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Texto alternativo">
                    <Input
                      className="mt-1"
                      value={selected.alt}
                      onChange={(event) =>
                        updateBlock(selected.id, { alt: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Enlace al hacer clic (opcional)">
                    <Input
                      className="mt-1"
                      value={selected.href}
                      onChange={(event) =>
                        updateBlock(selected.id, { href: event.target.value })
                      }
                    />
                  </Field>
                  <AlignField
                    value={selected.align}
                    onChange={(align) => updateBlock(selected.id, { align })}
                  />
                </>
              ) : null}

              {selected.type === "youtube" ? (
                <>
                  <Field label="URL o ID del vídeo de YouTube">
                    <Input
                      className="mt-1"
                      defaultValue={selected.videoId}
                      onBlur={(event) =>
                        updateBlock(selected.id, {
                          videoId: parseYouTubeId(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Texto bajo la miniatura">
                    <Input
                      className="mt-1"
                      value={selected.caption}
                      onChange={(event) =>
                        updateBlock(selected.id, { caption: event.target.value })
                      }
                    />
                  </Field>
                  <AlignField
                    value={selected.align}
                    onChange={(align) => updateBlock(selected.id, { align })}
                  />
                  <p className="text-xs text-muted">
                    En email se muestra la miniatura enlazada a YouTube (no hay
                    reproductor embebido).
                  </p>
                </>
              ) : null}

              {selected.type === "divider" ? (
                <ColorField
                  label="Color de la línea"
                  value={selected.color ?? "#e2e2e2"}
                  onChange={(hex) => updateBlock(selected.id, { color: hex })}
                />
              ) : null}

              {selected.type === "spacer" ? (
                <Field label="Altura (px)">
                  <Input
                    className="mt-1"
                    type="number"
                    value={String(selected.height)}
                    onChange={(event) =>
                      updateBlock(selected.id, {
                        height: Number(event.target.value) || 24,
                      })
                    }
                  />
                </Field>
              ) : null}

              {selected.type === "columns" ? (
                <div className="space-y-4">
                  {([0, 1] as const).map((colIndex) => {
                    const columnsBlock = selected;
                    const col = columnsBlock.columns[colIndex];
                    const setCol = (patch: Partial<ColumnCell>) => {
                      const next: [ColumnCell, ColumnCell] = [
                        columnsBlock.columns[0],
                        columnsBlock.columns[1],
                      ];
                      next[colIndex] = { ...next[colIndex], ...patch };
                      updateBlock(columnsBlock.id, { columns: next });
                    };
                    return (
                      <div
                        key={colIndex}
                        className="space-y-2 border border-separator p-2"
                      >
                        <p className={EYEBROW}>
                          {colIndex === 0
                            ? "Columna izquierda"
                            : "Columna derecha"}
                        </p>
                        <Field label="Texto">
                          <Textarea
                            className="mt-1 min-h-24"
                            value={col.text}
                            onChange={(event) =>
                              setCol({ text: event.target.value })
                            }
                          />
                        </Field>
                        {onUploadImage ? (
                          <ImageUploadButton
                            onUpload={onUploadImage}
                            onDone={(url) => setCol({ imageSrc: url })}
                          />
                        ) : null}
                        <Field label="Imagen (URL https://)">
                          <Input
                            className="mt-1"
                            value={col.imageSrc}
                            onChange={(event) =>
                              setCol({ imageSrc: event.target.value })
                            }
                          />
                        </Field>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <Collapsible className="border border-separator">
          <CollapsibleTrigger className="w-full justify-between px-3 py-2 text-sm font-medium">
            Estilos generales
            <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
          </CollapsibleTrigger>
          <CollapsibleContent>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-3">
            <Select
              className="w-44"
              aria-label="Tipografía"
              value={design.styles.fontFamily}
              onChange={(value) => setStyles({ fontFamily: value })}
              options={FONT_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <ColorField
              label="Fondo exterior"
              value={design.styles.background}
              onChange={(hex) => setStyles({ background: hex })}
            />
            <ColorField
              label="Fondo del contenedor"
              value={design.styles.containerBackground}
              onChange={(hex) => setStyles({ containerBackground: hex })}
            />
            <ColorField
              label="Texto"
              value={design.styles.text}
              onChange={(hex) => setStyles({ text: hex })}
            />
            <ColorField
              label="Primario"
              value={design.styles.primary}
              onChange={(hex) => setStyles({ primary: hex })}
            />
          </div>
        </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
