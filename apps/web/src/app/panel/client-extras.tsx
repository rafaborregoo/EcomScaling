"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { MessageThread } from "@/components/consultant-messages";
import { toast } from "@/components/ui";
import { Chip } from "./panel-parts";
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
        placeholder={`Escribe a ${name.split(" ")[0]}…`}
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

const STATUS_LABEL: Record<string, string> = { pending: "Pendiente", in_progress: "En curso" };

/**
 * Bandeja de acciones del cliente: las tareas abiertas de la organización
 * (las que se crean con «Crear tarea» desde cualquier palanca llegan aquí),
 * con alta rápida y cierre sin salir del panel.
 */
export function ClientActions({ organizationId }: { organizationId: string }) {
  const base = `/v1/organizations/${organizationId}`;
  const query = useCachedQuery<{ tasks: OpenTask[] }>(`${base}/operations`);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const open = (query.data?.tasks ?? []).filter((task) => task.status === "pending" || task.status === "in_progress");

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

  async function setStatus(task: OpenTask, status: "in_progress" | "completed") {
    setBusy(task.id);
    try {
      const response = await apiFetch(`${base}/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
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
        {open.map((task) => (
          <li key={task.id} className={s.qi}>
            <span className={s.qn}>{task.status === "in_progress" ? "▶" : "·"}</span>
            <b>{task.title}</b>
            <span className={s.liR}>
              {task.status === "in_progress" ? <Chip tone="acc">{STATUS_LABEL.in_progress}</Chip> : <Chip>{STATUS_LABEL[task.status] ?? task.status}</Chip>}
              {task.status === "pending" ? (
                <button type="button" className={`${s.btn} ${s.ghost} ${s.sm}`} disabled={busy === task.id} onClick={() => setStatus(task, "in_progress")}>
                  Empezar
                </button>
              ) : null}
              <button type="button" className={`${s.btn} ${s.sm}`} disabled={busy === task.id} onClick={() => setStatus(task, "completed")}>
                Hecha
              </button>
            </span>
          </li>
        ))}
      </ul>
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
        <button type="submit" className={`${s.btn} ${s.sm}`} disabled={busy === "new" || !draft.trim()}>
          {busy === "new" ? "Creando…" : "Crear"}
        </button>
      </form>
    </>
  );
}
