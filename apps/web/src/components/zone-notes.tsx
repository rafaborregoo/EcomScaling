"use client";

import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MessageIcon, PlusIcon, Popover, toast } from "@/components/ui";
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
  hours === 0 ? "Sin límite" : hours < 24 ? `${hours} h` : `${hours} h · ${Math.floor(hours / 24)} d${hours % 24 ? ` ${hours % 24} h` : ""}`;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/**
 * Marca de nota junto a la etiqueta de una tarjeta. Consultor: siempre visible
 * (para añadir), con el hilo de notas vivas. Cliente: solo si hay nota sin ver,
 * con «Visto» para quitarla.
 */
export function ZoneNoteMark({ anchor, label }: { anchor: string; label: string }) {
  const ctx = useContext(ZoneNotesContext);
  const [text, setText] = useState("");
  const [hours, setHours] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!ctx) return null;
  const notes = ctx.notes.filter((n) => n.anchor === anchor);
  const unseen = notes.filter((n) => !n.seen_at);
  if (!ctx.asConsultant && unseen.length === 0) return null;

  async function call(path: string, init: RequestInit, done: string) {
    setBusy(true);
    try {
      const response = await apiFetch(path, init);
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success(done);
      invalidateApiGetCache();
      ctx?.reload();
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
    if (!body || !ctx) return;
    const ok = await call(
      ctx.path,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anchor, body, expiresAt: expiryFor(hours), connectionId: ctx.connectionId }) },
      "Nota publicada. El cliente verá la tarjeta resaltada.",
    );
    if (ok) {
      setText("");
      setHours(0);
    }
  }

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
      <Popover.Content placement="bottom start" className="max-w-[22rem]">
        <Popover.Dialog aria-label={`Notas sobre ${label}`} className="zone-note-pop">
          <p className="zone-note-eyebrow">{ctx.asConsultant ? `Nota para el cliente · ${label}` : `Tu consultor · ${label}`}</p>
          {(ctx.asConsultant ? notes : unseen).length ? (
            <ul className="zone-note-list">
              {(ctx.asConsultant ? notes : unseen).map((note) => (
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
          {ctx.asConsultant ? (
            <form className="zone-note-form" onSubmit={(event) => void submit(event)}>
              <label className="sr-only" htmlFor={`zone-note-${anchor}`}>Nota para el cliente</label>
              <textarea
                id={`zone-note-${anchor}`}
                rows={3}
                maxLength={2000}
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
                <label htmlFor={`zone-note-dur-${anchor}`}>Duración</label>
                <input
                  id={`zone-note-dur-${anchor}`}
                  type="range"
                  min={0}
                  max={MAX_HOURS}
                  step={1}
                  value={hours}
                  onChange={(event) => setHours(Number(event.target.value))}
                  aria-valuetext={hoursLabel(hours)}
                  style={{ ["--zone-fill" as string]: `${(hours / MAX_HOURS) * 100}%` }}
                />
                <output htmlFor={`zone-note-dur-${anchor}`}>{hoursLabel(hours)}</output>
              </div>
              <div className="zone-note-foot">
                <span className="zone-note-hint">{notes.length ? "Sustituye a la nota actual" : "El cliente la puede quitar"}</span>
                <button type="submit" className="zone-note-send" disabled={busy || !text.trim()}>
                  {busy ? "Publicando…" : "Publicar"}
                </button>
              </div>
            </form>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
