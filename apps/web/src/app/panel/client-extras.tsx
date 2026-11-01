"use client";

import { buttonVariants } from "@/components/ui/button";
import { useState, type FormEvent } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { MessageThread } from "@/components/consultant-messages";
import Link from "next/link";
import { CheckIcon, toast } from "@/components/ui";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { createLeverTask } from "./panel-data";
import s from "./panel.module.css";

/**
 * Hilo con el cliente: el mismo canal que /mensajes (un hilo por organización),
 * leído y escrito desde el panel para no perder el contexto de las cifras.
 */
export function ClientThread({ organizationId, name }: { organizationId: string; name: string }) {
  return (
    <div className={s.thread}>
      <MessageThread
        organizationId={organizationId}
        className="min-h-0 flex-1"
        placeholder={`Escribe a ${name}…`}
      />
    </div>
  );
}

type OpenTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  is_visible_to_client: boolean;
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const SHOWN = 5;
const dueText = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/**
 * Acciones del cliente: las más urgentes de sus tareas abiertas (las que se
 * crean con «Crear tarea» desde cualquier palanca llegan aquí), con cierre de
 * un toque. La lista entera vive en Tareas; aquí solo lo que toca mirar ya.
 */
export function ClientActions({ organizationId }: { organizationId: string }) {
  const base = `/v1/organizations/${organizationId}`;
  const query = useCachedQuery<{ tasks: OpenTask[] }>(`${base}/operations`);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const open = (query.data?.tasks ?? [])
    .filter((task) => task.status === "pending" || task.status === "in_progress")
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
        (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"),
    );
  const today = new Date().toISOString().slice(0, 10);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setBusy("new");
    const ok = await createLeverTask(organizationId, title, "Creada desde el panel de rentabilidad.");
    setBusy(null);
    if (ok) {
      setDraft("");
      query.reload();
    }
  }

  async function complete(task: OpenTask) {
    setBusy(task.id);
    try {
      const response = await apiFetch(`${base}/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Tarea hecha.");
      invalidateApiGetCache();
      query.reload();
    } catch {
      toast.danger("No se pudo actualizar la tarea por un error de red.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {query.isLoading && !query.data ? <p className={s.empty}>Cargando acciones…</p> : null}
      {!query.isLoading && open.length === 0 ? (
        <p className={s.empty}>Sin acciones abiertas. Crea una aquí o con «Crear tarea» en cualquier palanca.</p>
      ) : null}
      <ul>
        {open.slice(0, SHOWN).map((task) => {
          const late = task.due_at !== null && task.due_at.slice(0, 10) < today;
          return (
            <li key={task.id} className={`${s.act} task-lift`}>
              <button
                type="button"
                className={s.actCheck}
                data-priority={task.priority}
                disabled={busy === task.id}
                aria-label={`Marcar como hecha: ${task.title}`}
                title="Marcar como hecha"
                onClick={() => complete(task)}
              >
                <CheckIcon aria-hidden="true" />
              </button>
              <span className={s.actBody}>
                <Link href={withPortalRouteContext(`/tareas?task=${encodeURIComponent(task.id)}`, organizationId)}>{task.title}</Link>
                <span className={s.actMeta}>
                  {task.priority === "urgent" ? <b className={s.neg}>Urgente</b> : task.priority === "high" ? <b>Prioridad alta</b> : null}
                  {task.status === "in_progress" ? <span>En curso</span> : null}
                  {task.due_at ? <span className={late ? s.neg : undefined}>{late ? "Vencida · " : ""}{dueText(task.due_at)}</span> : null}
                  {task.is_visible_to_client ? <span>La ve el cliente</span> : <span>Interna</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {open.length > SHOWN ? (
        <p className={s.foot} style={{ marginTop: 10 }}>
          <Link href={withPortalRouteContext("/tareas", organizationId)}>Ver las {open.length} en Tareas</Link>
        </p>
      ) : null}
      <form className={s.say} onSubmit={create}>
        <label className={s.sr} htmlFor="panel-accion">
          Nueva acción
        </label>
        <input
          id="panel-accion"
          type="text"
          value={draft}
          maxLength={255}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nueva acción para este cliente…"
        />
        <button type="submit" className={buttonVariants({ size: "sm" })} disabled={busy === "new" || !draft.trim()}>
          {busy === "new" ? "Creando…" : "Crear"}
        </button>
      </form>
    </>
  );
}
