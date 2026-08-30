"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  Button,
  CloseIcon,
  ColorField,
  EYEBROW,
  Field,
  GripVerticalIcon,
  Input,
  Select,
  Textarea,
  ToggleButton,
  ToggleButtonGroup,
  UploadButton,
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

function AlignField({
  value,
  onChange,
}: {
  value: BlockAlign;
  onChange: (align: BlockAlign) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Alineación"
      selectionMode="single"
      disallowEmptySelection
      size="sm"
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const next = [...keys][0] as BlockAlign | undefined;
        if (next) onChange(next);
      }}
    >
      {ALIGN_OPTIONS.map(({ key, label, Icon }) => (
        <ToggleButton key={key} id={key} isIconOnly aria-label={label}>
          <Icon />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
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

function SortableBlock({
  block,
  selected,
  onSelect,
  onDelete,
}: {
  block: TemplateBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const summary =
    block.type === "heading" || block.type === "text"
      ? block.text.slice(0, 48)
      : block.type === "button"
        ? block.text
        : block.type === "image"
          ? block.src || "sin URL"
          : block.type === "youtube"
            ? block.videoId || "sin vídeo"
            : "";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "flex items-center gap-2 border px-2 py-2 text-sm",
        selected ? "border-brand bg-brand-tint" : "border-edge bg-white",
        isDragging ? "opacity-60" : "",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label="Reordenar (arrastra o usa las flechas)"
        className="cursor-grab px-1 text-muted"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <span className={EYEBROW}>{BLOCK_LABEL[block.type]}</span>
        {summary ? (
          <span className="ml-2 truncate text-muted">{summary}</span>
        ) : null}
      </button>
      <button
        type="button"
        aria-label="Eliminar bloque"
        className="px-1 text-muted hover:text-brand"
        onClick={onDelete}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export function TemplateBuilder({
  design,
  onChange,
  onUploadImage,
}: {
  design: TemplateDesign;
  onChange: (design: TemplateDesign) => void;
  /** Sube un archivo y devuelve la URL pública para el bloque `image`. */
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(
    "desktop",
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const html = useMemo(() => renderTemplateHtml(design), [design]);
  const selected = design.blocks.find((block) => block.id === selectedId) ?? null;

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
  function deleteBlock(id: string) {
    onChange({
      ...design,
      blocks: design.blocks.filter((block) => block.id !== id),
    });
    if (selectedId === id) setSelectedId(null);
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = design.blocks.findIndex((b) => b.id === active.id);
    const newIndex = design.blocks.findIndex((b) => b.id === over.id);
    onChange({ ...design, blocks: arrayMove(design.blocks, oldIndex, newIndex) });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <div className="space-y-4">
        <details className="border border-edge">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
            Estilos generales
          </summary>
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
        </details>

        <div className="flex flex-wrap gap-2">
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

        {design.blocks.length === 0 ? (
          <p className="border border-dashed border-edge p-6 text-center text-sm text-muted">
            Añade bloques con los botones de arriba. Arrástralos para
            reordenar; haz clic para editar.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={design.blocks.map((block) => block.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {design.blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    selected={block.id === selectedId}
                    onSelect={() => setSelectedId(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {design.blocks.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            Con el tirador enfocado: Espacio para agarrar, flechas para mover,
            Espacio para soltar.
          </p>
        ) : null}

      </div>

      <div className="space-y-3 lg:sticky lg:top-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className={EYEBROW}>
              Vista previa en directo
            </p>
            <ToggleButtonGroup
              aria-label="Dispositivo de la vista previa"
              selectionMode="single"
              disallowEmptySelection
              size="sm"
              selectedKeys={[device]}
              onSelectionChange={(keys) => {
                const next = [...keys][0] as
                  | "mobile"
                  | "tablet"
                  | "desktop"
                  | undefined;
                if (next) setDevice(next);
              }}
            >
              <ToggleButton id="mobile">Móvil</ToggleButton>
              <ToggleButton id="tablet">Tablet</ToggleButton>
              <ToggleButton id="desktop">Escritorio</ToggleButton>
            </ToggleButtonGroup>
          </div>
          <div
            className="mx-auto w-full border border-edge bg-white"
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
              title="Vista previa de la plantilla"
              srcDoc={html}
              className="h-[62vh] min-h-[420px] w-full bg-white"
            />
          </div>
        </div>

      <div className="border border-edge p-3">
        {!selected ? (
          <p className="text-sm text-muted">
            Selecciona un bloque para editarlo.
          </p>
        ) : (
          <div className="space-y-3">
            <p className={EYEBROW}>
              {BLOCK_LABEL[selected.type]}
            </p>

            {selected.type === "heading" ? (
              <>
                <Field label="Texto">
                  <Input
                    className="mt-1"
                    value={selected.text}
                    onChange={(event) =>
                      updateBlock(selected.id, { text: event.target.value })
                    }
                  />
                </Field>
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
                <AlignField
                  value={selected.align}
                  onChange={(align) => updateBlock(selected.id, { align })}
                />
                <ColorField
                  label="Color"
                  value={selected.color ?? design.styles.text}
                  onChange={(hex) => updateBlock(selected.id, { color: hex })}
                />
              </>
            ) : null}

            {selected.type === "text" ? (
              <>
                <Field label="Texto">
                  <Textarea
                    className="mt-1 min-h-24"
                    value={selected.text}
                    onChange={(event) =>
                      updateBlock(selected.id, { text: event.target.value })
                    }
                  />
                </Field>
                <AlignField
                  value={selected.align}
                  onChange={(align) => updateBlock(selected.id, { align })}
                />
                <ColorField
                  label="Color"
                  value={selected.color ?? design.styles.text}
                  onChange={(hex) => updateBlock(selected.id, { color: hex })}
                />
              </>
            ) : null}

            {selected.type === "button" ? (
              <>
                <Field label="Texto del botón">
                  <Input
                    className="mt-1"
                    value={selected.text}
                    onChange={(event) =>
                      updateBlock(selected.id, { text: event.target.value })
                    }
                  />
                </Field>
                <Field label="Enlace (https://)">
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
                      className="space-y-2 border border-edge p-2"
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
      </div>
    </div>
  );
}
