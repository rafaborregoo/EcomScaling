"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Dialog, MessageIcon, PlusIcon, Popover, toast } from "@/components/ui";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";

// Notas del consultor ancladas a una tarjeta del panel (cifra o bloque).
// La vista del cliente y la del consultor usan la misma clave (`anchor`), así
// que leen la misma nota. Aviso ligero: la tarjeta con una nota sin ver se
// sombrea (globals.css, `.zone-card:has([data-zone-note="unseen"])`); el
// cliente la marca como vista y deja de resaltarse. Sin campana.
// La app móvil lee el mismo endpoint (apps/mobile/components/zone-notes.tsx).

export type ZoneNote = {
  id: string;
  anchor: string;
  body: string;
  expires_at: string | null;
  seen_at: string | null;
  created_at: string;
};

type ZoneNotesValue = {
  /** Base para escribir (POST, /seen, DELETE). */
  path: string;
  /** Tienda elegida en la cabecera: las notas son de cada tienda. */
  connectionId: string | null;
  notes: ZoneNote[];
  asConsultant: boolean;
  reload: () => void;
};

const ZoneNotesContext = createContext<ZoneNotesValue | null>(null);

/** Envuelve una vista del panel; sin él, `ZoneNoteMark` no pinta nada. */
export function ZoneNotesProvider({ organizationId, connectionId, asConsultant, children }: {
  organizationId: string | null;
  connectionId: string | null;
  asConsultant: boolean;
  children: ReactNode;
}) {
  const path = organizationId ? `/v1/organizations/${encodeURIComponent(organizationId)}/zone-notes` : null;
  const query = useCachedQuery<{ notes: ZoneNote[] }>(
    path ? `${path}${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}` : null,
  );
  const value = useMemo<ZoneNotesValue | null>(
    () => (path ? { path, connectionId, notes: query.data?.notes ?? [], asConsultant, reload: query.reload } : null),
    [path, connectionId, query.data, query.reload, asConsultant],
  );
  return <ZoneNotesContext.Provider value={value}>{children}</ZoneNotesContext.Provider>;
}

/** Clave estable a partir de una etiqueta visible ("Ventas netas" -> "kpi:ventas-netas"). */
export function zoneAnchor(prefix: string, label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return `${prefix}:${slug || "x"}`;
}

// Duración en horas (0-100). 0 = sin límite: sigue hasta que el cliente la quite.
const MAX_HOURS = 100;
const expiryFor = (hours: number) => (hours > 0 ? new Date(Date.now() + hours * 3_600_000).toISOString() : null);
const hoursLabel = (hours: number) =>
  hours === 0 ? "Sin límite" : hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d${hours % 24 ? ` ${hours % 24} h` : ""}`;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/** Notas que ve cada rol: el consultor, todas las vivas; el cliente, las que no ha visto. */
function visibleNotes(ctx: ZoneNotesValue, anchor: string) {
  return ctx.notes.filter((n) => n.anchor === anchor && (ctx.asConsultant || !n.seen_at));
}

/** Hilo de notas de una tarjeta: lista + (consultor) «Nueva nota» que abre el compositor. */
function NoteThread({ ctx, anchor }: { ctx: ZoneNotesValue; anchor: string }) {
  const notes = visibleNotes(ctx, anchor);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [hours, setHours] = useState(0);
  const [busy, setBusy] = useState(false);

  async function call(path: string, init: RequestInit, done: string) {
    setBusy(true);
    try {
      const response = await apiFetch(path, init);
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success(done);
      invalidateApiGetCache();
      ctx.reload();
      return true;
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    const ok = await call(
      ctx.path,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anchor, body, expiresAt: expiryFor(hours), connectionId: ctx.connectionId }) },
      "Nota publicada. El cliente verá la tarjeta resaltada.",
    );
    if (ok) {
      setText("");
      setHours(0);
      setComposing(false);
    }
  }

  return (
    <>
      {notes.length ? (
        <ul className="zone-note-list">
          {notes.map((note) => (
            <li key={note.id}>
              <p>{note.body}</p>
              <div className="zone-note-meta">
                <span>
                  {shortDate(note.created_at)}
                  {note.expires_at ? ` · hasta el ${shortDate(note.expires_at)}, ${new Date(note.expires_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : " · sin límite"}
                </span>
                {ctx.asConsultant ? (
                  <span className="zone-note-status" data-seen={note.seen_at ? "yes" : "no"}>
                    {note.seen_at ? `Vista · ${shortDate(note.seen_at)}` : "Sin ver"}
                  </span>
                ) : null}
                {ctx.asConsultant ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void call(`${ctx.path}/${note.id}`, { method: "DELETE" }, "Nota retirada.")}
                  >
                    Retirar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="zone-note-seen"
                    disabled={busy}
                    onClick={() => void call(`${ctx.path}/${note.id}/seen`, { method: "POST" }, "Marcada como vista.")}
                  >
                    Visto · quitar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {ctx.asConsultant && notes.length && !composing ? (
        <button type="button" className="zone-note-add" onClick={() => setComposing(true)}>
          <PlusIcon aria-hidden="true" /> Nueva nota
        </button>
      ) : null}
      {ctx.asConsultant && (composing || !notes.length) ? (
        <form className="zone-note-form" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor={`zone-note-${anchor}`}>Nota para el cliente</label>
          <textarea
            id={`zone-note-${anchor}`}
            rows={3}
            maxLength={2000}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Qué debería saber el cliente de esta cifra…"
          />
          <div className="zone-note-dur">
            <div className="zone-note-dur-head">
              <span>Visible durante</span>
              <output>{hoursLabel(hours)}</output>
            </div>
            <div className="zone-note-presets">
              {[[1, "1 h"], [24, "1 día"], [72, "3 días"], [0, "Sin límite"]].map(([value, name]) => (
                <button key={name} type="button" data-active={hours === value} onClick={() => setHours(value as number)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="zone-note-wheels">
              {([["Días", 24, Math.floor(hours / 24)], ["Horas", 1, hours % 24]] as const).map(([name, unit, value]) => (
                <div
                  key={name}
                  className="zone-note-wheel"
                  onWheel={(event) => setHours((h) => Math.min(MAX_HOURS, Math.max(0, h + (event.deltaY < 0 ? unit : -unit))))}
                >
                  <button type="button" aria-label={`Menos ${name.toLowerCase()}`} disabled={hours < unit} onClick={() => setHours((h) => Math.max(0, h - unit))}>−</button>
                  <span><strong>{value}</strong>{name}</span>
                  <button type="button" aria-label={`Más ${name.toLowerCase()}`} disabled={hours + unit > MAX_HOURS} onClick={() => setHours((h) => Math.min(MAX_HOURS, h + unit))}>+</button>
                </div>
              ))}
            </div>
          </div>
          <div className="zone-note-foot">
            <span className="zone-note-hint">{notes.length ? "Sustituye a la nota actual" : "El cliente la puede quitar"}</span>
            <button type="submit" className="zone-note-send" disabled={busy || !text.trim()}>
              {busy ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

/**
 * Marca de nota junto a la etiqueta de una tarjeta. Consultor: siempre visible
 * (para añadir), con el hilo de notas vivas. Cliente: solo si hay nota sin ver,
 * con «Visto» para quitarla.
 */
export function ZoneNoteMark({ anchor, label }: { anchor: string; label: string }) {
  const ctx = useContext(ZoneNotesContext);
  if (!ctx) return null;
  const notes = ctx.notes.filter((n) => n.anchor === anchor);
  const unseen = notes.filter((n) => !n.seen_at);
  if (!ctx.asConsultant && unseen.length === 0) return null;

  const count = ctx.asConsultant ? notes.length : unseen.length;
  return (
    <Popover>
      <Popover.Trigger>
        <button
          type="button"
          className="zone-note-mark"
          data-zone-note={unseen.length ? "unseen" : notes.length ? "seen" : "empty"}
          aria-label={count ? `${count} nota${count === 1 ? "" : "s"} sobre ${label}` : `Añadir nota sobre ${label}`}
          title={count ? "Nota del consultor" : "Añadir nota para el cliente"}
        >
          <MessageIcon aria-hidden="true" />
          {count ? <span>{count}</span> : <PlusIcon aria-hidden="true" className="zone-note-plus" />}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="zone-note-popover max-w-[calc(100vw-16px)]">
        <Popover.Dialog aria-label={`Notas sobre ${label}`} className="zone-note-pop">
          <header className="zone-note-head">
            <MessageIcon aria-hidden="true" />
            <div>
              <span>{ctx.asConsultant ? "Nota para el cliente" : "Tu consultor"}</span>
              <strong>{label}</strong>
            </div>
          </header>
          <NoteThread ctx={ctx} anchor={anchor} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

// Notas ya abiertas en este navegador: su tarjeta deja de llevar halo. Solo
// conveniencia por visor; «Visto · quitar» sigue siendo lo que cuenta.
const OPENED_KEY = "zone-notes-opened";
const readOpened = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/**
 * Tarjeta que admite notas. Con alguna nota visible, la tarjeta entera se
 * pulsa y abre un modal con el dato y sus comentarios (aquí entrarán también
 * los de la IA). `previewClassName` envuelve la copia del dato en el modal:
 * el portal sale del árbol de la vista y pierde sus tokens CSS.
 */
export function ZoneCard({ anchor, label, previewClassName, className, children, ...rest }: ComponentProps<"div"> & { anchor: string; label: string; previewClassName?: string }) {
  const ctx = useContext(ZoneNotesContext);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);
  useEffect(() => setOpened(readOpened()), []);
  const notes = ctx ? visibleNotes(ctx, anchor) : [];
  const clickable = notes.length > 0;
  const allOpened = clickable && notes.every((n) => opened.includes(n.id));

  function show() {
    setOpen(true);
    const next = [...new Set([...readOpened(), ...notes.map((n) => n.id)])].slice(-200);
    setOpened(next);
    try {
      localStorage.setItem(OPENED_KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento: el halo vuelve al recargar */
    }
  }
  const openFromCard = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    // Los clics del modal (portal) también suben por el árbol de React: solo cuentan los del DOM de la tarjeta.
    if (!event.currentTarget.contains(target) || target.closest("button, a, input, select, textarea")) return;
    show();
  };
  return (
    <>
      <div
        {...rest}
        className={`${className ?? ""} zone-card`}
        data-zone-open={clickable || undefined}
        data-zone-opened={allOpened || undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? openFromCard : undefined}
        onKeyDown={clickable ? (event) => { if (event.target === event.currentTarget && event.key === "Enter") show(); } : undefined}
      >
        {children}
      </div>
      {ctx && clickable ? (
        <Dialog isOpen={open} onOpenChange={setOpen} title={label} eyebrow={ctx.asConsultant ? "Nota para el cliente" : "Tu consultor"} cancelLabel={false}>
          <div className={`zone-card-stage ${previewClassName ?? ""}`}>
            <div className={`${className ?? ""} zone-card-preview`}>{children}</div>
          </div>
          <section className="zone-card-thread" aria-label="Comentarios">
            <h3>Comentarios</h3>
            <NoteThread ctx={ctx} anchor={anchor} />
          </section>
        </Dialog>
      ) : null}
    </>
  );
}
