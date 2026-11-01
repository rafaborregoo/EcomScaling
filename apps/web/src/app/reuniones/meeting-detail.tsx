"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { ScrollArea, FieldTitle, Badge, Button, ButtonLink, Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, EYEBROW, ErrorBlock, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { fmtDay, fmtTime, isUpcoming, KIND_LABEL, STATUS_LABEL, type Meeting } from "./meetings-model";
import s from "./reuniones.module.css";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Pendiente" },
  { value: "completed", label: "Celebrada" },
  { value: "no_show", label: "No asistió" },
];

/** Dónde está la llamada en el flujo de análisis (transcripción → resumen del agente → publicado). */
function callState(call: NonNullable<Meeting["call"]>) {
  if (call.summary === "published") return "Resumen publicado";
  if (call.summary === "draft") return "Resumen en borrador, pendiente de aprobar";
  return call.has_transcript ? "Transcripción lista; falta el resumen" : "Sin transcripción todavía";
}

/**
 * Ficha de una reunión. El cliente ve la cita y el enlace, y el resumen cuando
 * el consultor lo ha publicado; el consultor, además, sus notas internas, el
 * estado y la llamada asociada (donde viven la transcripción y el análisis).
 */
export function MeetingDetail({
  meeting,
  staff,
  onClose,
  onChanged,
  onReschedule,
}: {
  meeting: Meeting | null;
  staff: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onReschedule: (meeting: Meeting) => void;
}) {
  const [link, setLink] = useState("");
  const isDesktop = useIsDesktop();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Meeting["status"]>("scheduled");
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meeting) return;
    setLink(meeting.location_url ?? "");
    setNote(meeting.consultant_note ?? "");
    setStatus(meeting.status);
    setReason("");
    setCancelling(false);
    setError(null);
  }, [meeting]);

  if (!meeting) return null;
  const base = `/v1/organizations/${meeting.organization_id}/meetings/${meeting.id}`;
  const upcoming = isUpcoming(meeting);
  const state = STATUS_LABEL[meeting.status];
  const callHref = meeting.call ? `/llamadas/${meeting.call.id}?organizationId=${meeting.organization_id}` : "#";

  async function send(path: string, init: RequestInit, done: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(path, { ...init, headers: { "Content-Type": "application/json" } });
      if (!response.ok) return setError(await readApiError(response));
      toast.success(done);
      onClose();
      await onChanged();
    } catch {
      setError("No se pudo guardar por un error de red. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  function save() {
    void send(
      base,
      {
        method: "PATCH",
        body: JSON.stringify({
          locationUrl: link,
          consultantNote: note,
          ...(meeting?.status === "cancelled" ? {} : { status }),
        }),
      },
      "Reunión guardada",
    );
  }

  async function downloadIcs() {
    const response = await apiFetch(`${base}/ics`);
    if (!response.ok) return toast.danger(await readApiError(response));
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reunion.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const when = `${fmtDay(meeting.starts_at)} · ${fmtTime(meeting.starts_at)}–${fmtTime(meeting.ends_at)}`;

  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      busy={saving}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={!isDesktop}
    >
      <DrawerContent className="sm:max-w-[44rem]">
      <DrawerHeader>
        {(staff ? meeting.organization_name : KIND_LABEL[meeting.kind]) ? (
          <span className={EYEBROW}>{staff ? meeting.organization_name : KIND_LABEL[meeting.kind]}</span>
        ) : null}
        <DrawerTitle>{meeting.title}</DrawerTitle>
      </DrawerHeader>
      <ScrollArea className="flex-1 space-y-4 p-4 sm:px-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <div className={s.facts}>
        <Badge tone={state.tone}>{state.label}</Badge>
        <span>{when}</span>
        {staff ? <span className="text-muted">{KIND_LABEL[meeting.kind]}</span> : null}
      </div>

      {meeting.status === "cancelled" && meeting.cancel_reason ? <p className="text-sm text-muted">Motivo: {meeting.cancel_reason}</p> : null}

      {staff ? (
        <Field label="Enlace de la reunión">
          <Input type="url" placeholder="https://meet.google.com/…" value={link} onChange={(event) => setLink(event.target.value)} />
        </Field>
      ) : null}
      <div className={s.actionsRow}>
        {meeting.location_url && upcoming ? (
          <ButtonLink href={meeting.location_url} target="_blank" rel="noreferrer">
            Unirme
          </ButtonLink>
        ) : null}
        {meeting.status === "scheduled" ? (
          <Button variant="secondary" onClick={() => void downloadIcs()}>
            Añadir a mi calendario
          </Button>
        ) : null}
      </div>

      {meeting.client_note ? (
        <Field>
          <FieldTitle>Nota del cliente</FieldTitle>
          <p className="text-sm">{meeting.client_note}</p>
        </Field>
      ) : null}

      {staff ? (
        <>
          <Field label="Notas internas (el cliente no las ve)">
            <Textarea maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className={s.callSection}>
            <h3>La llamada</h3>
            <Field label="Estado">
              <Select aria-label="Estado de la reunión" value={status} onChange={(value) => setStatus(value as Meeting["status"])} options={STATUS_OPTIONS} disabled={meeting.status === "cancelled"} />
            </Field>
            {meeting.call ? (
              <>
                <p className="text-sm text-muted">{callState(meeting.call)}</p>
                <div>
                  <ButtonLink variant="secondary" href={callHref}>
                    Abrir la llamada
                  </ButtonLink>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Esta reunión no tiene llamada asociada.</p>
            )}
          </div>
        </>
      ) : meeting.call?.summary === "published" ? (
        <div>
          <ButtonLink variant="secondary" href={callHref}>
            Ver el resumen de la llamada
          </ButtonLink>
        </div>
      ) : null}
      </ScrollArea>
      <DrawerFooter>
        {staff ? (
          <Button disabled={saving} onClick={save}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        ) : null}
        {upcoming ? (
          cancelling ? (
            <span className={s.cancelRow}>
              <Input placeholder="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} />
              <Button variant="destructive" disabled={saving} onClick={() => void send(`${base}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }, "Reunión cancelada")}>
                Cancelar reunión
              </Button>
              <Button variant="ghost" onClick={() => setCancelling(false)}>
                Volver
              </Button>
            </span>
          ) : (
            <span className={s.cancelRow}>
              <Button variant="ghost" onClick={() => onReschedule(meeting)}>
                Mover
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setCancelling(true)}>
                Cancelar
              </Button>
            </span>
          )
        ) : null}
        <DrawerClose render={<Button variant="outline" />}>Cerrar</DrawerClose>
      </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
