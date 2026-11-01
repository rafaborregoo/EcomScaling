"use client";

import { Trash2Icon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Select, Banner, Button, ButtonLink, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, TimeInput, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Command, CommandEmpty, CommandInput, CommandItem, CommandList, CheckIcon, ButtonGroup, RadioCard, RadioGroup, ResizableHandle, ResizablePanel, ResizablePanelGroup, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import {
  DAY_NAME,
  DAY_SHORT,
  FLOW_TEMPLATES,
  NUMERIC_OPERATORS,
  OPERATOR_LABEL,
  OPERATOR_SYMBOL,
  TRIGGER_FIELDS,
  WEEKDAYS,
  blankFlow,
  cloneStep,
  conditionQuestion,
  containsList,
  delayText,
  isBranch,
  locate,
  groupedMetrics,
  hasStoreMetrics,
  metricByName,
  metricHelp,
  metricLabel,
  newStep,
  removeStep,
  insertStep,
  reviewFlow,
  tailList,
  triggerSplitQuestion,
  triggerText,
  walk,
  type DelayStep,
  type EmailStep,
  type FlowAccount,
  type FlowCondition,
  type FlowDesign,
  type FlowStep,
  type FlowTrigger,
  type NumericOperator,
  type SplitStep,
  type StepType,
  type Timeframe,
  type TriggerSplitStep,
  type UpdateStep,
} from "./flow-design";
import s from "./flow-builder.module.css";

/** Fila de `marketing_flow_designs` tal como la devuelve la API. */
export type FlowDesignRow = {
  id: string;
  name: string;
  design: FlowDesign;
  status: "draft" | "in_klaviyo";
  klaviyo_flow_id: string | null;
  pushed_at: string | null;
  updated_at: string;
};

type Doc = { name: string; design: FlowDesign };
type Selected = "trigger" | string;

// ---------------------------------------------------------------------------
// Iconos

const PATHS: Record<string, string> = {
  trigger: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  email: "M3 5h18v14H3zM3 7l9 6 9-6",
  delay: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8v4l3 2",
  split: "M12 3v6M12 9 6 15v6M12 9l6 6v6",
  trigger_split: "M4 6h16M4 6l5 6M20 6l-5 6M9 12v8M15 12v8",
  update: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 20a8 8 0 0 1 16 0",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  dup: "M8 8h12v12H8zM16 8V4H4v12h4",
  del: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  plus: "M12 5v14M5 12h14",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  check: "M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  send: "M4 12h12M12 6l6 6-6 6M20 4v16",
  tree: "M12 3v5M12 8H6v5M12 8h6v5M6 13v5M18 13v5",
  code: "M8 4H6a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-2",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  ext: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
};

function Icon({ name }: { name: string }) {
  return (
    <svg className={s.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

const STEP_META: Record<StepType, { label: string; kind: "email" | "wait" | "split" | "other"; desc: string; klaviyo: string }> = {
  email: { label: "Email", kind: "email", desc: "Una pieza del Estudio", klaviyo: "send-email" },
  delay: { label: "Espera", kind: "wait", desc: "Minutos, horas o días", klaviyo: "time-delay" },
  split: { label: "División condicional", kind: "split", desc: "Sí / No según la persona", klaviyo: "conditional-split" },
  trigger_split: { label: "División por disparador", kind: "split", desc: "Según el importe del evento", klaviyo: "trigger-split" },
  update: { label: "Actualizar perfil", kind: "other", desc: "Guarda una propiedad", klaviyo: "update-profile" },
};
const STEP_ORDER: StepType[] = ["email", "delay", "split", "trigger_split", "update"];

const DRAG_MIME = "application/x-nora-flow-step";
const PIECE_STATUS: Record<MarketingDraft["status"], [string, "good" | "warn" | "bad" | undefined]> = {
  approved: ["Aprobada", "good"],
  published: ["Publicada", "good"],
  pending_approval: ["En revisión", "warn"],
  draft: ["Borrador", undefined],
  rejected: ["Rechazada", "bad"],
};

function pieceName(draft: MarketingDraft) {
  return draft.template_name || draft.subject || "Pieza sin nombre";
}

// ---------------------------------------------------------------------------

export function FlowBuilder({
  organizationId,
  account,
  pieces,
  initial,
  canWrite,
  connected,
  onClose,
  onSaved,
  onDeleted,
  onOpenPiece,
  onNewPiece,
}: {
  organizationId: string;
  account: FlowAccount;
  /** Piezas de email del Estudio (cualquier estado; solo las aprobadas se pueden mandar). */
  pieces: MarketingDraft[];
  /** Diseño guardado, o uno nuevo (id null) desde plantilla o en blanco. */
  initial: { row: FlowDesignRow | null; doc: Doc };
  canWrite: boolean;
  connected: boolean;
  onClose: () => void;
  onSaved: (row: FlowDesignRow, created: boolean) => void;
  onDeleted: () => void;
  onOpenPiece: (draftId: string) => void;
  onNewPiece: () => void;
}) {
  const [doc, setDoc] = useState<Doc>(initial.doc);
  const [row, setRow] = useState<FlowDesignRow | null>(initial.row);
  const [selected, setSelected] = useState<Selected>("trigger");
  const [ltab, setLtab] = useState<"steps" | "templates">("steps");
  const [rtab, setRtab] = useState<"step" | "review">("step");
  const [view, setView] = useState<"canvas" | "json">("canvas");
  const [pane, setPane] = useState<"left" | "center" | "right">("center");
  const [zoom, setZoom] = useState(1);
  const [overSlot, setOverSlot] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [save, setSave] = useState<{ state: "saved" | "saving" | "dirty" | "error"; message?: string }>({ state: "saved" });
  const [history, setHistory] = useState<{ past: Doc[]; future: Doc[] }>({ past: [], future: [] });
  const [pushOpen, setPushOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [changedSincePush, setChangedSincePush] = useState(() =>
    Boolean(initial.row?.pushed_at && Date.parse(initial.row.updated_at) > Date.parse(initial.row.pushed_at) + 2000),
  );

  const docRef = useRef(doc);
  const rowRef = useRef(row);
  const lastPush = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<FlowDesignRow | null> | null>(null);

  const pieceMap = useMemo(() => new Map(pieces.map((draft) => [draft.id, draft])), [pieces]);
  const checks = useMemo(() => reviewFlow(doc.design, account, pieceMap), [doc.design, account, pieceMap]);
  const bad = checks.filter((check) => check.state === "bad");
  const badTargets = useMemo(() => new Set(bad.flatMap((check) => (check.target ? [check.target] : []))), [bad]);

  // ------------------------------------------------------------- guardar
  const persist = useCallback(async (): Promise<FlowDesignRow | null> => {
    if (saving.current) await saving.current;
    const current = docRef.current;
    const existing = rowRef.current;
    const run = (async () => {
      setSave({ state: "saving" });
      try {
        const response = await apiFetch(
          existing ? `/v1/organizations/${organizationId}/marketing/flow-designs/${existing.id}` : `/v1/organizations/${organizationId}/marketing/flow-designs`,
          { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: current.name.trim() || "Flow sin nombre", design: current.design }) },
          30_000,
        );
        if (!response.ok) {
          setSave({ state: "error", message: await readApiError(response) });
          return null;
        }
        const saved = (await response.json()) as FlowDesignRow;
        rowRef.current = saved;
        setRow(saved);
        setSave(docRef.current === current ? { state: "saved" } : { state: "dirty" });
        onSaved(saved, !existing);
        return saved;
      } catch {
        setSave({ state: "error", message: "Sin conexión. Se reintentará al seguir editando." });
        return null;
      }
    })();
    saving.current = run;
    const result = await run;
    saving.current = null;
    return result;
  }, [organizationId, onSaved]);

  const scheduleSave = useCallback(() => {
    setSave({ state: "dirty" });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), 1200);
  }, [persist]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  // Un flow nuevo desde plantilla se guarda enseguida: así existe en la lista.
  const createdOnce = useRef(false);
  useEffect(() => {
    if (initial.row || createdOnce.current) return;
    createdOnce.current = true;
    void persist();
  }, [initial.row, persist]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (save.state === "dirty" || save.state === "saving") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);

  // ------------------------------------------------------------- edición
  const commit = useCallback(
    (next: Doc, coalesce = false) => {
      const now = Date.now();
      const previous = docRef.current;
      if (!(coalesce && now - lastPush.current < 700)) {
        setHistory((h) => ({ past: [...h.past.slice(-79), previous], future: [] }));
      }
      lastPush.current = coalesce ? now : 0;
      docRef.current = next;
      setDoc(next);
      if (rowRef.current?.pushed_at) setChangedSincePush(true);
      scheduleSave();
    },
    [scheduleSave],
  );

  /** Aplica un cambio sobre una copia del diseño. */
  const mutate = useCallback(
    (fn: (design: FlowDesign) => void, coalesce = false) => {
      const design = structuredClone(docRef.current.design);
      fn(design);
      commit({ ...docRef.current, design }, coalesce);
    },
    [commit],
  );

  const patchStep = useCallback(
    (id: string, patch: Partial<FlowStep>, coalesce = true) =>
      mutate((design) => {
        const hit = locate(design.steps, id);
        if (hit) Object.assign(hit.step, patch);
      }, coalesce),
    [mutate],
  );

  const patchTrigger = useCallback(
    (patch: Partial<FlowTrigger>, coalesce = true) =>
      mutate((design) => {
        Object.assign(design.trigger, patch);
      }, coalesce),
    [mutate],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      const previous = h.past[h.past.length - 1];
      if (!previous) return h;
      const current = docRef.current;
      docRef.current = previous;
      setDoc(previous);
      scheduleSave();
      return { past: h.past.slice(0, -1), future: [...h.future, current] };
    });
    lastPush.current = 0;
  }, [scheduleSave]);

  const redo = useCallback(() => {
    setHistory((h) => {
      const next = h.future[h.future.length - 1];
      if (!next) return h;
      const current = docRef.current;
      docRef.current = next;
      setDoc(next);
      scheduleSave();
      return { past: [...h.past, current], future: h.future.slice(0, -1) };
    });
    lastPush.current = 0;
  }, [scheduleSave]);

  function select(id: Selected) {
    setSelected(id);
    setRtab("step");
    if (window.matchMedia("(max-width: 1020px)").matches) setPane("right");
  }

  function addAt(listId: string, index: number, type: StepType) {
    const step = newStep(type, account);
    mutate((design) => insertStep(design.steps, listId, index, step));
    select(step.id);
  }

  function addAtEnd(type: StepType) {
    const { listId, index } = tailList(docRef.current.design.steps);
    addAt(listId, index, type);
    toast.info(`${STEP_META[type].label} añadido al final`);
  }

  function removeById(id: string) {
    mutate((design) => removeStep(design.steps, id));
    if (selected === id) setSelected("trigger");
    toast.info("Paso borrado. Ctrl+Z para recuperarlo.");
  }

  function duplicate(id: string) {
    const hit = locate(docRef.current.design.steps, id);
    if (!hit || isBranch(hit.step)) return;
    const copy = cloneStep(hit.step);
    if (copy.type === "email") copy.name = `${copy.name} (copia)`;
    mutate((design) => {
      const target = locate(design.steps, id);
      target?.list.splice(target.index + 1, 0, copy);
    });
    select(copy.id);
  }

  function move(id: string, direction: -1 | 1) {
    mutate((design) => {
      const hit = locate(design.steps, id);
      if (!hit || isBranch(hit.step)) return;
      const to = hit.index + direction;
      const other = hit.list[to];
      if (!other || isBranch(other)) return;
      hit.list[hit.index] = other;
      hit.list[to] = hit.step;
    });
  }

  function loadTemplate(key: string) {
    const template = FLOW_TEMPLATES.find((item) => item.key === key);
    const built = template ? template.build(account) : blankFlow();
    commit({ name: built.name, design: built.design });
    setSelected("trigger");
    setView("canvas");
    toast.info(template ? `Plantilla «${template.name}» cargada. Ctrl+Z la quita.` : "Flow en blanco. Ctrl+Z lo deshace.");
  }

  // ------------------------------------------------------------- arrastrar
  function onDrop(event: DragEvent, listId: string, index: number) {
    event.preventDefault();
    setOverSlot(null);
    setDragging(null);
    const data = event.dataTransfer.getData(DRAG_MIME);
    if (!data) return;
    const [kind, value] = data.split(":") as [string, string];
    if (kind === "new") {
      addAt(listId, index, value as StepType);
      return;
    }
    const hit = locate(docRef.current.design.steps, value);
    if (!hit) return;
    if (containsList(hit.step, listId)) {
      toast.danger("Una división no puede ir dentro de sus propias ramas.");
      return;
    }
    mutate((design) => {
      const source = locate(design.steps, value);
      if (!source) return;
      let target = index;
      if (source.listId === listId && source.index < index) target -= 1;
      source.list.splice(source.index, 1);
      insertStep(design.steps, listId, target, source.step);
    });
    select(value);
  }

  // ------------------------------------------------------------- teclado
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "") || (document.activeElement as HTMLElement | null)?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.key === "Delete" || event.key === "Backspace") && !typing && selected !== "trigger" && !pushOpen && !deleteOpen) {
        event.preventDefault();
        removeById(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------- vista Klaviyo
  const [preview, setPreview] = useState<{ body: unknown; issues: Array<{ message: string }> } | { error: string } | null>(null);
  useEffect(() => {
    if (view !== "json") return;
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/flow-designs/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: doc.name.trim() || "Flow sin nombre", design: doc.design }),
        });
        setPreview(response.ok ? await response.json() : { error: await readApiError(response) });
      } catch {
        setPreview({ error: "Sin conexión con la API." });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [view, doc, organizationId]);

  // ------------------------------------------------------------- render
  const emails: EmailStep[] = [];
  walk(doc.design.steps, (step) => {
    if (step.type === "email") emails.push(step);
  });
  const inKlaviyo = Boolean(row?.klaviyo_flow_id);
  const pushLabel = inKlaviyo ? (changedSincePush ? "Crear versión nueva en Klaviyo" : "Ya está en Klaviyo") : "Crear en Klaviyo";
  const stateLabel = inKlaviyo ? (changedSincePush ? "Cambios sin subir a Klaviyo" : "En Klaviyo · borrador") : "Borrador en NORA";
  const saveLabel = { saved: "Guardado", saving: "Guardando…", dirty: "Sin guardar", error: save.message ?? "No se pudo guardar" }[save.state];

  const slot = (listId: string, index: number) => {
    const key = `${listId}@${index}`;
    return (
      <div
        className={s.slot}
        data-over={overSlot === key ? "" : undefined}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
          event.preventDefault();
          if (overSlot !== key) setOverSlot(key);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverSlot((current) => (current === key ? null : current));
        }}
        onDrop={(event) => onDrop(event, listId, index)}
      >
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className={s.add} aria-label="Añadir un paso aquí" />}>
            <Icon name="plus" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STEP_ORDER.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => addAt(listId, index, type)}>
                <span className={`${s.ti} ${s.menuIcon}`} data-kind={STEP_META[type].kind}>
                  <Icon name={type} />
                </span>
                {STEP_META[type].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderList = (list: FlowStep[], listId: string): ReactNode => (
    <div className={s.list}>
      {slot(listId, 0)}
      {list.map((step, index) => (
        <div key={step.id} className={s.list}>
          <StepNode
            step={step}
            account={account}
            piece={step.type === "email" && step.draft_id ? pieceMap.get(step.draft_id) : undefined}
            pressed={selected === step.id}
            issue={badTargets.has(step.id)}
            dragging={dragging === step.id}
            first={index === 0}
            last={index === list.length - 1 || Boolean(list[index + 1] && isBranch(list[index + 1]!))}
            onSelect={() => select(step.id)}
            onOp={(op) => (op === "del" ? removeById(step.id) : op === "dup" ? duplicate(step.id) : move(step.id, op === "up" ? -1 : 1))}
            onDragStart={(event) => {
              event.dataTransfer.setData(DRAG_MIME, `move:${step.id}`);
              event.dataTransfer.effectAllowed = "move";
              setDragging(step.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOverSlot(null);
            }}
          />
          {isBranch(step) ? (
            <div className={s.branches}>
              <div className={s.branch} data-branch="yes">
                <span className={s.blabel}>Sí</span>
                {renderList(step.yes, `${step.id}:yes`)}
              </div>
              <div className={s.branch} data-branch="no">
                <span className={s.blabel}>No</span>
                {renderList(step.no, `${step.id}:no`)}
              </div>
            </div>
          ) : (
            slot(listId, index + 1)
          )}
        </div>
      ))}
      {!list.length || !isBranch(list[list.length - 1]!) ? <span className={s.end}>Sale del flow</span> : null}
    </div>
  );

  const t = doc.design.trigger;
  const triggerChips: string[] = [];
  if (t.type === "metric" && t.min_value) triggerChips.push(`importe ≥ ${t.min_value} €`);
  if (t.exclude_purchasers) triggerChips.push("sale si compra");
  if (t.type === "metric" && t.reentry_days) triggerChips.push(`vuelve a entrar tras ${t.reentry_days} d`);

  return (
    <div className={s.builder}>
      <header className={s.top}>
        <div className={s.piece}>
          <h1 className={s.crumb}>
            Marketing /{" "}
            <button type="button" onClick={onClose}>
              Flows
            </button>{" "}
            / {row ? "Editar flow" : "Nuevo flow"}
          </h1>
          <input
            id="flow-name"
            className={s.flowName}
            aria-label="Nombre del flow"
            value={doc.name}
            onChange={(event) => commit({ ...docRef.current, name: event.target.value }, true)}
          />
          <div className={s.pills}>
            <span className={s.pill} data-state={inKlaviyo && !changedSincePush ? "klaviyo" : undefined}>
              <i />
              {stateLabel}
            </span>
            <span className={s.pill}>{emails.length} emails</span>
            <span className={s.pill}>{triggerText(t, account)}</span>
          </div>
        </div>
        <div className={s.topActions}>
          <span className={s.saved} data-state={save.state === "error" ? "error" : undefined} role="status">
            {saveLabel}
          </span>
          <button type="button" className={buttonVariants({ variant: "secondary", size: "icon-sm" })} data-icon="" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}>
            <Icon name="undo" />
          </button>
          <button type="button" className={buttonVariants({ variant: "secondary", size: "icon-sm" })} data-icon="" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}>
            <Icon name="redo" />
          </button>
          {row ? (
            <button type="button" className={buttonVariants({ variant: "secondary", size: "icon-sm", className: s.hideSm })} data-icon="" aria-label="Borrar el flow" title="Borrar el flow" onClick={() => setDeleteOpen(true)}>
              <Icon name="del" />
            </button>
          ) : null}
          <button
            type="button"
            className={buttonVariants({ variant: "secondary", className: s.hideSm })}
            onClick={() => {
              setRtab("review");
              setPane("right");
            }}
          >
            <Icon name="check" />
            Revisar
          </button>
          <button type="button" className={buttonVariants()} data-primary="" disabled={inKlaviyo && !changedSincePush} onClick={() => setPushOpen(true)}>
            <Icon name="send" />
            {pushLabel}
          </button>
        </div>
      </header>

      <ResizablePanelGroup autoSaveId="flows" className={s.work} data-pane={pane}>
        <ResizablePanel defaultSize="264px" minSize="200px" maxSize="30%" role="complementary" className={`${s.pane} ${s.left}`} aria-label="Pasos y plantillas">
          <div className={s.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={ltab === "steps"} onClick={() => setLtab("steps")}>
              Pasos
            </button>
            <button type="button" role="tab" aria-selected={ltab === "templates"} onClick={() => setLtab("templates")}>
              Plantillas
            </button>
          </div>
          {ltab === "steps" ? (
            <div className={s.pad}>
              {(
                [
                  ["Mensajes", ["email"]],
                  ["Tiempo", ["delay"]],
                  ["Ramas", ["split", "trigger_split"]],
                  ["Perfil", ["update"]],
                ] as Array<[string, StepType[]]>
              ).map(([title, types]) => (
                <div key={title} className={s.group}>
                  <span className={s.eyebrow}>{title}</span>
                  <div className={s.palette}>
                    {types.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={s.tool}
                        draggable
                        title="Arrástralo al diagrama o pulsa para añadirlo al final"
                        onDragStart={(event) => {
                          event.dataTransfer.setData(DRAG_MIME, `new:${type}`);
                          event.dataTransfer.effectAllowed = "copy";
                          setDragging("new");
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setOverSlot(null);
                        }}
                        onClick={() => addAtEnd(type)}
                      >
                        <span className={s.ti} data-kind={STEP_META[type].kind}>
                          <Icon name={type} />
                        </span>
                        <span>
                          {STEP_META[type].label}
                          <small>{STEP_META[type].desc}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className={s.hint}>
                Arrastra un paso sobre una línea del diagrama o pulsa el <b>+</b> que aparece entre dos pasos. Los pasos del diagrama también se arrastran para cambiarlos de sitio.
              </p>
            </div>
          ) : (
            <div className={s.pad}>
              <p className={s.hint}>Los flows que más venden solos. Cargar uno sustituye lo que hay en el diagrama; Ctrl+Z lo deshace.</p>
              {FLOW_TEMPLATES.map((template) => (
                <button key={template.key} type="button" className={s.tpl} onClick={() => loadTemplate(template.key)}>
                  <b>{template.name}</b>
                  <span>{template.why}</span>
                  <span className={s.shape}>{template.shape}</span>
                </button>
              ))}
              <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => loadTemplate("blank")}>
                <Icon name="plus" />
                Empezar en blanco
              </button>
            </div>
          )}
        </ResizablePanel>

        <ResizableHandle aria-label="Cambiar el ancho del panel izquierdo" />
        <ResizablePanel role="main" className={s.center} aria-label="Diagrama del flow">
          <div className={s.ctools}>
            <ToggleGroup aria-label="Vista" value={view} onValueChange={setView}>
              <ToggleGroupItem value="canvas">
                <Icon name="tree" />
                Diagrama
              </ToggleGroupItem>
              <ToggleGroupItem value="json">
                <Icon name="code" />
                Formato Klaviyo
              </ToggleGroupItem>
            </ToggleGroup>
            {view === "canvas" ? (
              <ButtonGroup aria-label="Zoom">
                <Button variant="outline" size="sm" aria-label="Alejar" onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))}>
                  −
                </Button>
                <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
                  {Math.round(zoom * 100)} %
                </Button>
                <Button variant="outline" size="sm" aria-label="Acercar" onClick={() => setZoom((value) => Math.min(1.3, Math.round((value + 0.1) * 10) / 10))}>
                  +
                </Button>
              </ButtonGroup>
            ) : null}
          </div>
          {view === "canvas" ? (
            <div
              className={s.canvas}
              data-dragging={dragging ? "" : undefined}
            >
              <div className={s.tree} style={{ zoom }}>
                <div
                  className={s.node}
                  data-kind="trigger"
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === "trigger"}
                  data-issue={badTargets.has("trigger") ? "" : undefined}
                  onClick={() => select("trigger")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select("trigger");
                    }
                  }}
                >
                  <div className={s.nhead}>
                    <span className={s.ti} data-kind="trigger">
                      <Icon name="trigger" />
                    </span>
                    <span>Disparador</span>
                  </div>
                  <div className={s.nbody}>
                    <b>{triggerText(t, account)}</b>
                    {t.type === "metric" && t.id ? <span className={`${s.sub} ${s.mono}`}>{account.metrics.find((metric) => metric.id === t.id)?.name}</span> : null}
                    {triggerChips.length ? (
                      <span className={s.chips}>
                        {triggerChips.map((chip) => (
                          <span key={chip} className={s.chip}>
                            {chip}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </div>
                {renderList(doc.design.steps, "root")}
              </div>
            </div>
          ) : (
            <KlaviyoJson preview={preview} emails={emails.length} />
          )}
        </ResizablePanel>

        <ResizableHandle aria-label="Cambiar el ancho de los ajustes" />
        <ResizablePanel defaultSize="360px" minSize="280px" maxSize="40%" role="complementary" className={`${s.pane} ${s.right}`} aria-label="Ajustes">
          <div className={s.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={rtab === "step"} onClick={() => setRtab("step")}>
              Paso
            </button>
            <button type="button" role="tab" aria-selected={rtab === "review"} onClick={() => setRtab("review")}>
              Revisión <span className={s.count} data-state={bad.length ? "bad" : "ok"}>{bad.length || "✓"}</span>
            </button>
          </div>
          <div className={s.pad}>
            {rtab === "review" ? (
              <>
                <div className={s.score}>
                  <b>
                    {checks.filter((check) => check.state === "ok").length}/{checks.length}
                  </b>
                  <span>{bad.length ? `${bad.length} cosa${bad.length === 1 ? "" : "s"} impide${bad.length === 1 ? "" : "n"} crearlo en Klaviyo.` : "Listo para crearlo en Klaviyo como borrador."}</span>
                </div>
                <div className={s.checks}>
                  {checks.map((check) => (
                    <div key={check.title} className={s.check} data-state={check.state}>
                      <span className={s.dot}>{check.state === "ok" ? "✓" : check.state === "bad" ? "!" : "·"}</span>
                      <div>
                        <b>{check.title}</b>
                        <span>{check.text}</span>
                        {check.state !== "ok" && check.target ? (
                          <div>
                            <button type="button" className={buttonVariants({ variant: "secondary" })} data-size="sm" onClick={() => select(check.target!)}>
                              Ir al paso
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : selected === "trigger" ? (
              <TriggerInspector trigger={t} account={account} onChange={patchTrigger} />
            ) : (
              <StepInspector
                key={selected}
                steps={doc.design.steps}
                id={selected}
                account={account}
                pieces={pieces}
                triggerType={t.type}
                onPatch={patchStep}
                onRemove={removeById}
                onDuplicate={duplicate}
                onOpenPiece={onOpenPiece}
                onNewPiece={onNewPiece}
              />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <nav className={s.mswitch} aria-label="Panel">
        <ToggleGroup aria-label="Panel" value={pane} onValueChange={setPane}>
          {(
            [
              ["left", "Pasos"],
              ["center", "Diagrama"],
              ["right", "Ajustes"],
            ] as const
          ).map(([key, label]) => (
            <ToggleGroupItem key={key} value={key}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </nav>

      <PushDialog
        open={pushOpen}
        onOpenChange={setPushOpen}
        organizationId={organizationId}
        badChecks={bad}
        emails={emails}
        pieceMap={pieceMap}
        steps={doc.design.steps}
        canWrite={canWrite}
        connected={connected}
        replacing={inKlaviyo}
        onGoTo={(target) => {
          setPushOpen(false);
          select(target);
        }}
        ensureSaved={async () => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          return save.state === "saved" && rowRef.current ? rowRef.current : persist();
        }}
        onPushed={(flowId) => {
          const updated = rowRef.current ? { ...rowRef.current, status: "in_klaviyo" as const, klaviyo_flow_id: flowId, pushed_at: new Date().toISOString() } : null;
          if (updated) {
            rowRef.current = updated;
            setRow(updated);
            onSaved(updated, false);
          }
          setChangedSincePush(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger/10 text-danger">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Borrar «{doc.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el diseño de NORA.
              {inKlaviyo ? " El flow que ya se creó en Klaviyo sigue allí, en borrador. Si no lo quieres, bórralo en Klaviyo." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!row) return false;
                const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/flow-designs/${row.id}`, { method: "DELETE" });
                if (!response.ok) throw new Error(await readApiError(response));
                if (saveTimer.current) clearTimeout(saveTimer.current);
                toast.success("Flow borrado");
                onDeleted();
              }}
            >
              Borrar flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nodos del diagrama

function StepNode({
  step,
  account,
  piece,
  pressed,
  issue,
  dragging,
  first,
  last,
  onSelect,
  onOp,
  onDragStart,
  onDragEnd,
}: {
  step: FlowStep;
  account: FlowAccount;
  piece: MarketingDraft | undefined;
  pressed: boolean;
  issue: boolean;
  dragging: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onOp: (op: "up" | "down" | "dup" | "del") => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const meta = STEP_META[step.type];
  const branch = isBranch(step);
  const ops = (
    <span className={s.ops}>
      {branch ? null : (
        <>
          <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Subir" disabled={first} onClick={(event) => (event.stopPropagation(), onOp("up"))}>
            <Icon name="up" />
          </button>
          <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Bajar" disabled={last} onClick={(event) => (event.stopPropagation(), onOp("down"))}>
            <Icon name="down" />
          </button>
          <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Duplicar" onClick={(event) => (event.stopPropagation(), onOp("dup"))}>
            <Icon name="dup" />
          </button>
        </>
      )}
      <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Borrar" onClick={(event) => (event.stopPropagation(), onOp("del"))}>
        <Icon name="del" />
      </button>
    </span>
  );
  const common = {
    role: "button" as const,
    tabIndex: 0,
    draggable: true,
    "aria-pressed": pressed,
    "data-issue": issue ? "" : undefined,
    "data-dragging": dragging ? "" : undefined,
    onClick: onSelect,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onSelect();
      }
    },
    onDragStart,
    onDragEnd,
  };

  if (step.type === "delay") {
    return (
      <div className={s.wait} {...common} aria-label={delayText(step)}>
        <span className={s.ti} data-kind="wait">
          <Icon name="delay" />
        </span>
        <span>{delayText(step)}</span>
        {ops}
      </div>
    );
  }

  let body: ReactNode = null;
  let title = meta.label;
  if (step.type === "email") {
    title = `Email · ${step.name || "sin nombre"}`;
    const status = piece ? PIECE_STATUS[piece.status] : null;
    body = (
      <>
        <div className={s.nbody}>
          <b>{step.subject || "Sin asunto"}</b>
          <span className={s.sub}>{step.preheader || "Sin preheader"}</span>
          <span className={s.chips}>
            {status ? (
              <span className={s.chip} data-tone={status[1]}>
                {status[0]}
              </span>
            ) : null}
            {step.smart_sending ? null : (
              <span className={s.chip} data-tone="warn">
                Sin envío inteligente
              </span>
            )}
          </span>
        </div>
        {piece?.html ? (
          <div className={s.thumb} aria-hidden="true">
            <iframe title="" srcDoc={piece.html} sandbox="" tabIndex={-1} loading="lazy" />
          </div>
        ) : (
          <div className={s.thumb} data-empty="">
            {piece ? "La pieza no tiene HTML todavía" : "Sin contenido: elige una pieza del Estudio"}
          </div>
        )}
      </>
    );
  } else if (step.type === "split") {
    body = (
      <div className={s.nbody}>
        <b>{conditionQuestion(step.condition, account)}</b>
        <span className={s.sub}>Mira el perfil de la persona</span>
      </div>
    );
  } else if (step.type === "trigger_split") {
    body = (
      <div className={s.nbody}>
        <b>{triggerSplitQuestion(step)}</b>
        <span className={s.sub}>Mira el evento que la metió en el flow</span>
      </div>
    );
  } else if (step.type === "update") {
    body = (
      <div className={s.nbody}>
        <b>
          {step.property || "propiedad"} = {step.value || "…"}
        </b>
        <span className={s.sub}>Se guarda en su perfil de Klaviyo</span>
      </div>
    );
  }
  return (
    <div className={s.node} data-kind={meta.kind} {...common}>
      <div className={s.nhead}>
        <span className={s.ti} data-kind={meta.kind}>
          <Icon name={step.type} />
        </span>
        <span>{title}</span>
        {ops}
      </div>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector

function InspectorField({ label, hint, counter, children }: { label: string; hint?: string; counter?: string; children: ReactNode }) {
  return (
    <div className={s.f}>
      <span className={s.lbl}>
        {label}
        {counter ? <small>{counter}</small> : null}
      </span>
      {children}
      {hint ? <p className={s.note}>{hint}</p> : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={s.toggle}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Options<T extends string | number | boolean | null>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (value: T) => void; label: string }) {
  return (
    // Los valores pueden ser booleanos o null: el ToggleGroup trabaja con su posición.
    <ToggleGroup aria-label={label} spacing={1.5} value={options.findIndex(([option]) => option === value)} onValueChange={(index) => onChange(options[index][0])}>
      {options.map(([option, text], index) => (
        <ToggleGroupItem key={String(option)} value={index}>
          {text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function MetricSelect({ id, value, account, onChange }: { id: string; value: string; account: FlowAccount; onChange: (value: string) => void }) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      placeholder="Elige qué hace la persona…"
      options={groupedMetrics(account).flatMap((group) =>
        group.metrics.map((metric) => {
          const label = metricLabel(account, metric.id);
          return { value: metric.id, label: label !== metric.name ? `${label} · ${metric.name}` : label, section: group.label };
        }),
      )}
    />
  );
}

const TRIGGER_TYPES: Array<{ type: FlowTrigger["type"]; title: string; text: string; example: string }> = [
  {
    type: "metric",
    title: "Cuando hace algo",
    text: "Entra cada vez que ocurre un evento: empieza el pago, compra, ve un producto…",
    example: "carrito abandonado, post-compra, navegación abandonada",
  },
  {
    type: "list",
    title: "Cuando se apunta a una lista",
    text: "Entra una vez, en el momento en que se suscribe (popup, formulario, checkout).",
    example: "bienvenida",
  },
  {
    type: "segment",
    title: "Cuando entra en un segmento",
    text: "Entra al empezar a cumplir las condiciones del segmento. Quien ya estaba dentro al crear el flow no entra.",
    example: "recuperación de clientes («Sin comprar en 120 días»), VIP",
  },
];

function TriggerInspector({ trigger, account, onChange }: { trigger: FlowTrigger; account: FlowAccount; onChange: (patch: Partial<FlowTrigger>, coalesce?: boolean) => void }) {
  const placedOrder = metricByName(account, "Placed Order");
  const help = trigger.type === "metric" && trigger.id ? metricHelp(account, trigger.id) : null;
  const storeConnected = hasStoreMetrics(account);
  const pool = trigger.type === "list" ? account.lists : account.segments;
  return (
    <>
      <div className={s.inspHead}>
        <span className={s.ti} data-kind="trigger">
          <Icon name="trigger" />
        </span>
        <div>
          <b>Disparador</b>
          <span>Lo que hace que alguien empiece el flow</span>
        </div>
      </div>
      <RadioGroup
        aria-label="Tipo de disparador"
        className="gap-1.5"
        value={trigger.type}
        onValueChange={(type) => onChange({ type, id: "", min_value: null, reentry_days: type === "metric" ? trigger.reentry_days : null }, false)}
      >
        {TRIGGER_TYPES.map((option) => (
          <RadioCard key={option.type} value={option.type} title={option.title} description={option.text}>
            <small className="text-xs text-muted">Ej.: {option.example}</small>
          </RadioCard>
        ))}
      </RadioGroup>
      {trigger.type === "metric" ? (
        <>
          {storeConnected ? null : (
            <p className={s.callout} data-tone="bad">
              Klaviyo no está conectado a Shopify: no sabe quién compra ni quién abandona el carrito. Conéctalo en Klaviyo → <b>Integraciones → Shopify</b>.
            </p>
          )}
          <InspectorField label="Qué hace la persona">
            <MetricSelect id="flow-trigger-metric" value={trigger.id} account={account} onChange={(id) => onChange({ id }, false)} />
          </InspectorField>
          {help ? <p className={s.note}>{help}</p> : null}
          <InspectorField label="Solo si el importe es de al menos" counter="Moneda del evento" hint="Vacío = cualquier importe. El importe se compara en la moneda del evento (por ejemplo, la del carrito); compruébala en Klaviyo.">
            <input
              className={s.inp}
              type="number"
              min={0}
              step={5}
              value={trigger.min_value ?? ""}
              onChange={(event) => onChange({ min_value: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) })}
            />
          </InspectorField>
        </>
      ) : (
        <InspectorField
          label={trigger.type === "list" ? "Qué lista" : "Qué segmento"}
          hint={pool.length ? undefined : `Esta cuenta no tiene ${trigger.type === "list" ? "listas" : "segmentos"} sincronizados todavía.`}
        >
          <Select value={trigger.id} onChange={(value) => onChange({ id: value }, false)} placeholder="Elige…" options={pool.map((item) => ({ value: item.id, label: item.name }))} />
        </InspectorField>
      )}
      <Toggle label="Sacar del flow a quien compre mientras está dentro" checked={trigger.exclude_purchasers} onChange={(value) => onChange({ exclude_purchasers: value }, false)} />
      {trigger.exclude_purchasers && !placedOrder ? (
        <p className={s.callout} data-tone="bad">
          Necesita que Klaviyo esté conectado a Shopify.
        </p>
      ) : (
        <p className={s.note}>Si compra, deja de recibir los emails que le quedaban. Imprescindible en carritos y navegación.</p>
      )}
      {trigger.type === "metric" ? (
        <InspectorField label="¿Puede volver a entrar?" hint="Si repite el evento antes de ese plazo, no vuelve a empezar el flow.">
          <Options
            label="Volver a entrar"
            value={trigger.reentry_days}
            options={[
              [null, "Siempre"],
              [7, "Tras 7 días"],
              [14, "14 días"],
              [30, "30 días"],
              [90, "90 días"],
            ]}
            onChange={(reentry_days) => onChange({ reentry_days }, false)}
          />
        </InspectorField>
      ) : null}
      <p className={s.callout}>
        Klaviyo lo crea en <b>borrador</b>: nadie entra hasta que alguien lo active.
      </p>
    </>
  );
}

function StepInspector({
  steps,
  id,
  account,
  pieces,
  triggerType,
  onPatch,
  onRemove,
  onDuplicate,
  onOpenPiece,
  onNewPiece,
}: {
  steps: FlowStep[];
  id: string;
  account: FlowAccount;
  pieces: MarketingDraft[];
  triggerType: FlowTrigger["type"];
  onPatch: (id: string, patch: Partial<FlowStep>, coalesce?: boolean) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenPiece: (draftId: string) => void;
  onNewPiece: () => void;
}) {
  const hit = locate(steps, id);
  if (!hit) return <p className={s.note}>Elige un paso del diagrama.</p>;
  const step = hit.step;
  const meta = STEP_META[step.type];
  let order = 0;
  let position = 0;
  walk(steps, (item) => {
    order += 1;
    if (item.id === id) position = order;
  });
  const patch = (value: Partial<FlowStep>, coalesce = true) => onPatch(id, value, coalesce);

  return (
    <>
      <div className={s.inspHead}>
        <span className={s.ti} data-kind={meta.kind}>
          <Icon name={step.type} />
        </span>
        <div>
          <b>{meta.label}</b>
          <span>
            Paso {position} · <span className={s.mono}>{meta.klaviyo}</span>
          </span>
        </div>
      </div>
      {step.type === "email" ? <EmailInspector step={step} pieces={pieces} patch={patch} onOpenPiece={onOpenPiece} onNewPiece={onNewPiece} /> : null}
      {step.type === "delay" ? <DelayInspector step={step} patch={patch} /> : null}
      {step.type === "split" ? <SplitInspector step={step} account={account} patch={patch} /> : null}
      {step.type === "trigger_split" ? <TriggerSplitInspector step={step} triggerType={triggerType} patch={patch} /> : null}
      {step.type === "update" ? <UpdateInspector step={step} patch={patch} /> : null}
      <div className={s.actions}>
        {isBranch(step) ? null : (
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => onDuplicate(id)}>
            <Icon name="dup" />
            Duplicar
          </button>
        )}
        <button type="button" className={buttonVariants({ variant: "destructive" })} data-tone="danger" onClick={() => onRemove(id)}>
          <Icon name="del" />
          Borrar
        </button>
      </div>
    </>
  );
}

function EmailInspector({
  step,
  pieces,
  patch,
  onOpenPiece,
  onNewPiece,
}: {
  step: EmailStep;
  pieces: MarketingDraft[];
  patch: (value: Partial<EmailStep>, coalesce?: boolean) => void;
  onOpenPiece: (draftId: string) => void;
  onNewPiece: () => void;
}) {
  const current = pieces.find((draft) => draft.id === step.draft_id);
  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return (
    <>
      <InspectorField label="Nombre interno">
        <input className={s.inp} value={step.name} maxLength={120} onChange={(event) => patch({ name: event.target.value })} />
      </InspectorField>
      <InspectorField label="Asunto" counter={`${step.subject.length}/60`}>
        <input className={s.inp} value={step.subject} maxLength={255} aria-invalid={!step.subject.trim()} onChange={(event) => patch({ subject: event.target.value })} />
      </InspectorField>
      <InspectorField label="Preheader" counter={`${step.preheader.length}/90`}>
        <input className={s.inp} value={step.preheader} maxLength={255} onChange={(event) => patch({ preheader: event.target.value })} />
      </InspectorField>
      <div className={s.row}>
        <InspectorField label="Remitente">
          <input className={s.inp} value={step.from_label} maxLength={120} onChange={(event) => patch({ from_label: event.target.value })} />
        </InspectorField>
        <InspectorField label="Email">
          <input className={s.inp} type="email" value={step.from_email} aria-invalid={!validEmail(step.from_email)} onChange={(event) => patch({ from_email: event.target.value })} />
        </InspectorField>
      </div>
      <InspectorField label="Responder a (opcional)">
        <input className={s.inp} type="email" value={step.reply_to} aria-invalid={Boolean(step.reply_to) && !validEmail(step.reply_to)} onChange={(event) => patch({ reply_to: event.target.value })} />
      </InspectorField>
      <InspectorField label="Contenido" counter="del Estudio" hint={current && current.status !== "approved" ? "Esta pieza aún no está aprobada: apruébala en Contenido antes de crear el flow en Klaviyo." : undefined}>
        <Command className={s.pieces} aria-label="Piezas de email">
          <CommandInput placeholder="Buscar pieza…" aria-label="Buscar pieza" />
          <CommandList>
            <CommandEmpty>{pieces.length ? "Ninguna pieza con ese nombre." : "Todavía no hay piezas de email en el Estudio."}</CommandEmpty>
            {pieces.map((draft) => {
              const [label, tone] = PIECE_STATUS[draft.status];
              const chosen = step.draft_id === draft.id;
              return (
                <CommandItem
                  key={draft.id}
                  value={pieceName(draft)}
                  keywords={[draft.subject ?? ""]}
                  className={s.pc}
                  data-checked={chosen ? "" : undefined}
                  onSelect={() =>
                    patch(
                      {
                        draft_id: draft.id,
                        ...(step.subject.trim() ? {} : { subject: draft.subject }),
                        ...(step.preheader.trim() ? {} : { preheader: draft.preheader }),
                        ...(step.name === "Email" ? { name: pieceName(draft).slice(0, 120) } : {}),
                      },
                      false,
                    )
                  }
                >
                  <span style={{ minWidth: 0 }}>
                    <b>{pieceName(draft)}</b>
                    <span>{draft.subject}</span>
                  </span>
                  <span className={s.chip} data-tone={tone}>
                    {label}
                  </span>
                  {chosen ? <CheckIcon aria-label="Elegida" /> : null}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
        <div className={s.actions}>
          {current ? (
            <button type="button" className={buttonVariants({ variant: "secondary" })} data-size="sm" onClick={() => onOpenPiece(current.id)}>
              <Icon name="ext" />
              Editar esta pieza
            </button>
          ) : null}
          <button type="button" className={buttonVariants({ variant: "secondary" })} data-size="sm" onClick={onNewPiece}>
            <Icon name="plus" />
            Diseñar una nueva en Crear
          </button>
        </div>
      </InspectorField>
      <Toggle label="Envío inteligente (no repetir en 16 h)" checked={step.smart_sending} onChange={(value) => patch({ smart_sending: value }, false)} />
      <Toggle label="UTM para medirlo en Shopify" checked={step.utm} onChange={(value) => patch({ utm: value }, false)} />
    </>
  );
}

function DelayInspector({ step, patch }: { step: DelayStep; patch: (value: Partial<DelayStep>, coalesce?: boolean) => void }) {
  const daily = step.unit === "days";
  return (
    <>
      <div className={s.row}>
        <InspectorField label="Cuánto">
          <input className={s.inp} type="number" min={1} max={999} value={step.value} onChange={(event) => patch({ value: Math.min(999, Math.max(1, Math.round(Number(event.target.value) || 1))) })} />
        </InspectorField>
        <InspectorField label="Unidad">
          <Select
            value={step.unit}
            onChange={(value) => patch({ unit: value as DelayStep["unit"], ...(value === "days" ? {} : { until: null, weekdays: [] }) }, false)}
            options={[{ value: "minutes", label: "Minutos" }, { value: "hours", label: "Horas" }, { value: "days", label: "Días" }]}
          />
        </InspectorField>
      </div>
      {daily ? (
        <>
          <InspectorField label="A qué hora sale" hint="En la zona horaria de cada persona. Vacío = a la misma hora a la que entró.">
            <TimeInput aria-label="A qué hora sale" value={step.until ?? ""} onChange={(event) => patch({ until: event.target.value || null }, false)} />
          </InspectorField>
          <InspectorField label="Solo estos días" hint="Ninguno marcado = cualquier día.">
            <div className={s.days}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-label={DAY_NAME[day]}
                  aria-pressed={step.weekdays.includes(day)}
                  onClick={() => patch({ weekdays: step.weekdays.includes(day) ? step.weekdays.filter((item) => item !== day) : WEEKDAYS.filter((item) => item === day || step.weekdays.includes(item)) }, false)}
                >
                  {DAY_SHORT[day]}
                </button>
              ))}
            </div>
          </InspectorField>
        </>
      ) : null}
    </>
  );
}

function SplitInspector({ step, account, patch }: { step: SplitStep; account: FlowAccount; patch: (value: Partial<SplitStep>, coalesce?: boolean) => void }) {
  const condition = step.condition;
  const setCondition = (next: FlowCondition, coalesce = false) => patch({ condition: next }, coalesce);
  return (
    <>
      <p className={s.question}>{conditionQuestion(condition, account)}</p>
      <InspectorField label="Mirar…">
        <Options
          label="Tipo de condición"
          value={condition.kind}
          options={[
            ["metric", "Lo que ha hecho"],
            ["group", "Lista o segmento"],
            ["property", "Una propiedad"],
          ]}
          onChange={(kind) =>
            setCondition(
              kind === "metric"
                ? { kind, metric_id: metricByName(account, "Placed Order"), operator: "greater-than-or-equal", value: 1, timeframe: { kind: "flow-start" } }
                : kind === "group"
                  ? { kind, group_id: account.segments[0]?.id ?? account.lists[0]?.id ?? "", member: true }
                  : { kind, property: "", operator: "equals", value: "" },
            )
          }
        />
      </InspectorField>
      {condition.kind === "metric" ? <MetricCondition condition={condition} account={account} onChange={setCondition} /> : null}
      {condition.kind === "group" ? (
        <>
          <InspectorField label="Dónde">
            <Select
              value={condition.group_id}
              onChange={(value) => setCondition({ ...condition, group_id: value })}
              placeholder="Elige…"
              options={[
                ...account.lists.map((item) => ({ value: item.id, label: item.name, section: "Listas" })),
                ...account.segments.map((item) => ({ value: item.id, label: item.name, section: "Segmentos" })),
              ]}
            />
          </InspectorField>
          <Options
            label="Pertenencia"
            value={condition.member}
            options={[
              [true, "Está"],
              [false, "No está"],
            ]}
            onChange={(member) => setCondition({ ...condition, member })}
          />
        </>
      ) : null}
      {condition.kind === "property" ? (
        <>
          <InspectorField label="Propiedad del perfil" hint="Tal como se llama en Klaviyo, p. ej. «Accepts Marketing» o una propia.">
            <input className={s.inp} value={condition.property} maxLength={120} onChange={(event) => setCondition({ ...condition, property: event.target.value }, true)} />
          </InspectorField>
          <div className={s.row}>
            <InspectorField label="Condición">
              <Select
                value={condition.operator}
                onChange={(value) => setCondition({ ...condition, operator: value as typeof condition.operator })}
                options={[{ value: "equals", label: "es" }, { value: "not-equals", label: "no es" }, { value: "contains", label: "contiene" }, { value: "not-contains", label: "no contiene" }]}
              />
            </InspectorField>
            <InspectorField label="Valor">
              <input className={s.inp} value={condition.value} maxLength={255} onChange={(event) => setCondition({ ...condition, value: event.target.value }, true)} />
            </InspectorField>
          </div>
        </>
      ) : null}
      <p className={s.callout}>
        Quien cumple sigue por <b>Sí</b> (izquierda); el resto, por <b>No</b>. Una rama vacía = sale del flow.
      </p>
    </>
  );
}

function MetricCondition({ condition, account, onChange }: { condition: Extract<FlowCondition, { kind: "metric" }>; account: FlowAccount; onChange: (next: FlowCondition, coalesce?: boolean) => void }) {
  const preset = condition.operator === "greater-than-or-equal" && condition.value === 1 ? "did" : condition.operator === "equals" && condition.value === 0 ? "didnt" : "custom";
  const timeframe = condition.timeframe;
  return (
    <>
      <InspectorField label="Qué">
        <MetricSelect id={`flow-cond-metric`} value={condition.metric_id} account={account} onChange={(metric_id) => onChange({ ...condition, metric_id })} />
      </InspectorField>
      <InspectorField label="Cuántas veces">
        <Options
          label="Cuántas veces"
          value={preset}
          options={[
            ["did", "Lo ha hecho"],
            ["didnt", "No lo ha hecho"],
            ["custom", "Un número"],
          ]}
          onChange={(value) =>
            onChange(
              value === "did"
                ? { ...condition, operator: "greater-than-or-equal", value: 1 }
                : value === "didnt"
                  ? { ...condition, operator: "equals", value: 0 }
                  : { ...condition, operator: "greater-than-or-equal", value: 2 },
            )
          }
        />
      </InspectorField>
      {preset === "custom" ? (
        <div className={s.row}>
          <InspectorField label="Condición">
            <Select
              value={condition.operator}
              onChange={(value) => onChange({ ...condition, operator: value as NumericOperator })}
              options={NUMERIC_OPERATORS.map((operator) => ({ value: operator, label: `${OPERATOR_SYMBOL[operator]} ${OPERATOR_LABEL[operator]}` }))}
            />
          </InspectorField>
          <InspectorField label="Veces">
            <input className={s.inp} type="number" min={0} value={condition.value} onChange={(event) => onChange({ ...condition, value: Math.max(0, Math.round(Number(event.target.value) || 0)) }, true)} />
          </InspectorField>
        </div>
      ) : null}
      <InspectorField label="Cuándo">
        <Select
          value={timeframe.kind}
          onChange={(value) => {
            const kind = value as Timeframe["kind"];
            onChange({ ...condition, timeframe: kind === "in-the-last" ? { kind, quantity: 30, unit: "day" } : { kind } });
          }}
          options={[{ value: "flow-start", label: "Desde que entró en el flow" }, { value: "in-the-last", label: "En los últimos…" }, { value: "alltime", label: "Alguna vez" }]}
        />
      </InspectorField>
      {timeframe.kind === "in-the-last" ? (
        <div className={s.row}>
          <InspectorField label="Cantidad">
            <input
              className={s.inp}
              type="number"
              min={1}
              max={3650}
              value={timeframe.quantity}
              onChange={(event) => onChange({ ...condition, timeframe: { ...timeframe, quantity: Math.min(3650, Math.max(1, Math.round(Number(event.target.value) || 1))) } }, true)}
            />
          </InspectorField>
          <InspectorField label="Unidad">
            <Select
              value={timeframe.unit}
              onChange={(value) => onChange({ ...condition, timeframe: { ...timeframe, unit: value as "hour" | "day" | "week" } })}
              options={[{ value: "hour", label: "Horas" }, { value: "day", label: "Días" }, { value: "week", label: "Semanas" }]}
            />
          </InspectorField>
        </div>
      ) : null}
    </>
  );
}

function TriggerSplitInspector({ step, triggerType, patch }: { step: TriggerSplitStep; triggerType: FlowTrigger["type"]; patch: (value: Partial<TriggerSplitStep>, coalesce?: boolean) => void }) {
  return (
    <>
      <p className={s.question}>{triggerSplitQuestion(step)}</p>
      {triggerType !== "metric" ? <p className={s.callout} data-tone="bad">Solo funciona si el flow empieza porque la persona hace algo (no por una lista o segmento).</p> : null}
      <InspectorField label="Qué mira">
        <Select
          value={TRIGGER_FIELDS.some(([key]) => key === step.field) ? step.field : "__custom"}
          onChange={(value) => patch({ field: value === "__custom" ? "" : value }, false)}
          options={[...TRIGGER_FIELDS.map(([key, label]) => ({ value: key, label: `${label} (${key})` })), { value: "__custom", label: "Otra propiedad del evento…" }]}
        />
      </InspectorField>
      {TRIGGER_FIELDS.some(([key]) => key === step.field) ? null : (
        <InspectorField label="Propiedad del evento">
          <input className={s.inp} value={step.field} maxLength={120} onChange={(event) => patch({ field: event.target.value })} />
        </InspectorField>
      )}
      <div className={s.row}>
        <InspectorField label="Condición">
          <Select
            value={step.operator}
            onChange={(value) => patch({ operator: value as NumericOperator }, false)}
            options={NUMERIC_OPERATORS.map((operator) => ({ value: operator, label: `${OPERATOR_SYMBOL[operator]} ${OPERATOR_LABEL[operator]}` }))}
          />
        </InspectorField>
        <InspectorField label="Valor">
          <input className={s.inp} type="number" min={0} value={step.value} onChange={(event) => patch({ value: Math.max(0, Number(event.target.value) || 0) })} />
        </InspectorField>
      </div>
      <p className={s.note}>Mira el evento que metió a la persona en el flow (por ejemplo, el carrito), no su historial.</p>
    </>
  );
}

function UpdateInspector({ step, patch }: { step: UpdateStep; patch: (value: Partial<UpdateStep>) => void }) {
  return (
    <>
      <InspectorField label="Propiedad" hint="Se crea en el perfil si no existe.">
        <input className={s.inp} value={step.property} maxLength={120} aria-invalid={!step.property.trim()} onChange={(event) => patch({ property: event.target.value })} />
      </InspectorField>
      <InspectorField label="Valor">
        <input className={s.inp} value={step.value} maxLength={255} onChange={(event) => patch({ value: event.target.value })} />
      </InspectorField>
    </>
  );
}

// ---------------------------------------------------------------------------
// Formato Klaviyo

/** Colorea el JSON sin HTML crudo: trozos de texto con su tipo. */
function jsonTokens(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let key = 0;
  for (let match = re.exec(json); match; match = re.exec(json)) {
    if (match.index > last) out.push(json.slice(last, match.index));
    const [, str, colon, literal, number] = match;
    if (str) {
      out.push(
        <span key={key++} data-t={colon ? "k" : "s"}>
          {str}
        </span>,
      );
      if (colon) out.push(colon);
    } else {
      out.push(
        <span key={key++} data-t={literal ? "b" : "n"}>
          {literal ?? number}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  out.push(json.slice(last));
  return out;
}

function KlaviyoJson({ preview, emails }: { preview: { body: unknown; issues: Array<{ message: string }> } | { error: string } | null; emails: number }) {
  const text = preview && "body" in preview ? JSON.stringify(preview.body, null, 2) : "";
  return (
    <div className={s.jsonwrap}>
      <div className={s.jsoncard}>
        <div className={s.jsonhead}>
          <span className={s.verb}>POST</span>
          <code>https://a.klaviyo.com/api/flows</code>
          <button
            type="button"
            className={buttonVariants({ variant: "secondary" })}
            data-size="sm"
            disabled={!text}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                toast.success("JSON copiado");
              } catch {
                toast.danger("No se pudo copiar. Selecciónalo y usa Ctrl+C.");
              }
            }}
          >
            <Icon name="copy" />
            Copiar
          </button>
        </div>
        <p className={s.jsonnote}>
          Esto es lo que NORA manda a Klaviyo. Antes sube {emails === 1 ? "la pieza" : `las ${emails} piezas`} como plantilla
          {emails === 1 ? "" : "s"} (<span className={s.mono}>POST /api/templates</span>) y pone su id donde ahora pone <span className={s.mono}>pieza:…</span>. Todo sale en borrador.
        </p>
        {preview && "error" in preview ? <p className={s.jsonnote}>{preview.error}</p> : null}
        {preview && "issues" in preview && preview.issues.length ? (
          <p className={s.jsonnote}>
            Klaviyo lo rechazaría todavía: {preview.issues.map((issue) => issue.message).join(" ")}
          </p>
        ) : null}
        <pre className={s.json}>{text ? jsonTokens(text) : "Cargando…"}</pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crear en Klaviyo

function PushDialog({
  open,
  onOpenChange,
  organizationId,
  badChecks,
  emails,
  pieceMap,
  steps,
  canWrite,
  connected,
  replacing,
  onGoTo,
  ensureSaved,
  onPushed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  badChecks: Array<{ title: string; text: string; target?: string }>;
  emails: EmailStep[];
  pieceMap: Map<string, MarketingDraft>;
  steps: FlowStep[];
  canWrite: boolean;
  connected: boolean;
  replacing: boolean;
  onGoTo: (target: string) => void;
  ensureSaved: () => Promise<FlowDesignRow | null>;
  onPushed: (flowId: string) => void;
}) {
  const [phase, setPhase] = useState<{ kind: "confirm" } | { kind: "running" } | { kind: "done"; flowId: string } | { kind: "error"; message: string }>({ kind: "confirm" });
  const notApproved = emails.filter((email) => email.draft_id && pieceMap.get(email.draft_id)?.status !== "approved");
  let branches = 0;
  walk(steps, (step) => {
    if (isBranch(step)) branches += 1;
  });
  let count = 0;
  walk(steps, () => {
    count += 1;
  });
  const uniquePieces = new Set(emails.map((email) => email.draft_id).filter(Boolean)).size;
  const blockers: Array<{ title: string; text: string; target?: string }> = [
    ...(connected ? [] : [{ title: "Klaviyo sin conectar", text: "Conecta Klaviyo en Integraciones para poder crear flows." }]),
    ...badChecks,
    ...notApproved.map((email) => ({ title: "Pieza sin aprobar", text: `La pieza de «${email.name}» tiene que estar aprobada en Contenido.`, target: email.id })),
  ];

  async function run() {
    setPhase({ kind: "running" });
    const saved = await ensureSaved();
    if (!saved) {
      setPhase({ kind: "error", message: "No se pudo guardar el flow antes de crearlo." });
      return;
    }
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/flow-designs/${saved.id}/klaviyo`, { method: "POST" }, 90_000);
      if (!response.ok) {
        setPhase({ kind: "error", message: await readApiError(response) });
        return;
      }
      const body = (await response.json()) as { klaviyo_flow_id: string };
      setPhase({ kind: "done", flowId: body.klaviyo_flow_id });
      onPushed(body.klaviyo_flow_id);
    } catch {
      setPhase({ kind: "error", message: "Sin conexión con la API." });
    }
  }

  const done = phase.kind === "done";
  const close = () => {
    onOpenChange(false);
    setPhase({ kind: "confirm" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
      busy={phase.kind === "running"}
    >
      <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {done
            ? "Creado en Klaviyo, en borrador"
            : blockers.length
              ? "Falta poco para poder crearlo"
              : replacing
                ? "Crear una versión nueva en Klaviyo"
                : "Crear el flow en Klaviyo"}
        </DialogTitle>
      </DialogHeader>
      {phase.kind === "done" ? (
        <>
          <p className={s.note}>
            Flow <span className={s.mono}>{phase.flowId}</span>. Todos sus emails están en borrador: no sale nada hasta que alguien lo active en Klaviyo.
          </p>
          <Banner tone="success">
            En la próxima sincronización aparecerá también en la lista de Flows con su diagrama y, cuando envíe, con su rendimiento.
          </Banner>
        </>
      ) : blockers.length ? (
        <div className="space-y-3">
          {blockers.map((check) => (
            <Banner key={`${check.title}-${check.target ?? ""}-${check.text}`} tone="danger">
              <span className="block font-medium">{check.title}</span>
              <span className="block">{check.text}</span>
              {check.target ? (
                <span className="mt-2 block">
                  <Button size="sm" variant="secondary" onClick={() => onGoTo(check.target!)}>
                    Ir al paso
                  </Button>
                </span>
              ) : null}
            </Banner>
          ))}
        </div>
      ) : (
        <>
          <div className={s.summary}>
            <div>
              <b>{emails.length}</b>
              <span>emails</span>
            </div>
            <div>
              <b>{count}</b>
              <span>pasos</span>
            </div>
            <div>
              <b>{branches}</b>
              <span>divisiones</span>
            </div>
          </div>
          <ol className={s.steps}>
            <li data-s={phase.kind === "running" ? "run" : undefined}>
              <span className={s.st} />
              <span>Subir {uniquePieces === 1 ? "la pieza" : `las ${uniquePieces} piezas`} como plantilla{uniquePieces === 1 ? "" : "s"}</span>
            </li>
            <li data-s={phase.kind === "running" ? "run" : undefined}>
              <span className={s.st} />
              <span>Crear el flow con disparador, esperas y ramas, todo en borrador</span>
            </li>
          </ol>
          {replacing ? <Banner tone="warn">Klaviyo no deja reescribir un flow ya creado: se crea uno nuevo y el anterior se queda en borrador en la cuenta.</Banner> : null}
          {canWrite ? null : (
            <Banner tone="warn">
              La conexión de Klaviyo puede no tener el permiso <b>Flows (Full access)</b>. Si Klaviyo lo rechaza, añádelo a la clave en Klaviyo o vuelve a autorizar la cuenta.
            </Banner>
          )}
          {phase.kind === "error" ? <Banner tone="danger">{phase.message}</Banner> : null}
        </>
      )}
      <DialogFooter>
        {done ? (
          <>
            <ButtonLink
              variant="secondary"
              href={`https://www.klaviyo.com/flow/${encodeURIComponent(phase.flowId)}/edit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir en Klaviyo
            </ButtonLink>
            <Button onClick={close}>Listo</Button>
          </>
        ) : (
          <>
            <DialogClose>{blockers.length ? "Cerrar" : "Cancelar"}</DialogClose>
            {blockers.length ? null : (
              <Button disabled={phase.kind === "running"} onClick={() => void run()}>
                {phase.kind === "running" ? "Creando…" : phase.kind === "error" ? "Reintentar" : replacing ? "Crear versión nueva" : "Crear en borrador"}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
