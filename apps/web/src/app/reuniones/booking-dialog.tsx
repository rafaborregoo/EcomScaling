"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EYEBROW, EmptyState, ErrorBlock, Field, LoadingBlock, RadioCard, RadioGroup, Textarea, toast } from "@/components/ui";
import { browserTimezone, dayKey, fmtDay, fmtTime, groupByDay, KIND_LABEL, type Meeting, type MeetingType } from "./meetings-model";
import s from "./reuniones.module.css";

type BookingContext = {
  consultant: { user_id: string; full_name: string | null } | null;
  timezone: string;
  types: MeetingType[];
};

const RANGE_DAYS = 30;

/**
 * Reservar (o mover) una reunión: tipo → día → hora → nota. Los huecos los
 * calcula la API con la agenda real del consultor, así que lo que se ve libre
 * ya cuenta sus otras reuniones con cualquier cliente.
 */
export function BookingDialog({
  organizationId,
  open,
  onOpenChange,
  onDone,
  reschedule,
  initialDay,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void> | void;
  /** Con una reunión, el diálogo la mueve en vez de crear otra. */
  reschedule?: Meeting | null;
  /** Día (YYYY-MM-DD) que se abre seleccionado; si no tiene huecos, el primero libre. */
  initialDay?: string | null;
}) {
  const [context, setContext] = useState<BookingContext | null>(null);
  const [typeId, setTypeId] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSlot("");
    setDay(initialDay ?? "");
    setNote("");
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const response = await apiFetch(`/v1/organizations/${organizationId}/meetings/booking-context`);
        if (!response.ok) return setError(await readApiError(response));
        const payload = (await response.json()) as BookingContext;
        setContext(payload);
        setTypeId(reschedule?.meeting_type_id ?? payload.types[0]?.id ?? "");
      } catch {
        setError("No se pudo cargar la disponibilidad. Reintenta.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, organizationId, reschedule, initialDay]);

  const loadSlots = useCallback(async () => {
    if (!typeId) return setSlots([]);
    setLoading(true);
    const from = new Date();
    const to = new Date(from.getTime() + RANGE_DAYS * 86_400_000);
    const params = new URLSearchParams({ typeId, from: dayKey(from), to: dayKey(to) });
    if (reschedule) params.set("excludeMeetingId", reschedule.id);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/meetings/slots?${params}`, { cache: "no-store" });
      if (!response.ok) return setError(await readApiError(response));
      const payload = (await response.json()) as { slots: string[] };
      setSlots(payload.slots);
      setDay((current) =>
        current && payload.slots.some((starts) => dayKey(new Date(starts)) === current)
          ? current
          : payload.slots[0] ? dayKey(new Date(payload.slots[0])) : "",
      );
    } catch {
      setError("No se pudieron cargar los huecos. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [typeId, organizationId, reschedule]);

  useEffect(() => {
    if (open) void loadSlots();
  }, [open, loadSlots]);

  const byDay = useMemo(() => groupByDay(slots.map((starts_at) => ({ starts_at }))), [slots]);
  const times = byDay.find(([key]) => key === day)?.[1] ?? [];
  const type = context?.types.find((item) => item.id === typeId);
  const sameZone = !context || context.timezone === browserTimezone();

  async function confirm() {
    if (!slot) return;
    setSaving(true);
    setError(null);
    try {
      const response = reschedule
        ? await apiFetch(`/v1/organizations/${organizationId}/meetings/${reschedule.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startsAt: slot }),
          })
        : await apiFetch(`/v1/organizations/${organizationId}/meetings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ typeId, startsAt: slot, note: note.trim() || null }),
          });
      if (!response.ok) {
        setError(await readApiError(response));
        // Otro cliente pudo coger el hueco: se recalculan para que elija entre los que quedan.
        setSlot("");
        await loadSlots();
        return;
      }
      toast.success(reschedule ? "Reunión movida" : "Reunión reservada");
      onOpenChange(false);
      await onDone();
    } catch {
      setError("No se pudo guardar por un error de red. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  const noConsultant = !loading && context && !context.consultant;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} busy={saving} dirty={Boolean(slot || note.trim())}>
      <DialogContent className="sm:max-w-[44rem]">
        <DialogHeader>
          {context?.consultant?.full_name ?? undefined ? <span className={EYEBROW}>{context?.consultant?.full_name ?? undefined}</span> : null}
          <DialogTitle>{reschedule ? "Mover reunión" : "Reservar reunión"}</DialogTitle>
        </DialogHeader>
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {noConsultant ? (
          <EmptyState title="Aún no tienes consultor asignado" hint="Cuando lo tengas podrás reservar aquí." />
        ) : (
          <>
            {!reschedule && context && context.types.length > 1 ? (
              <RadioGroup
                aria-label="Tipo de reunión"
                className={s.typeList}
                value={typeId}
                onValueChange={(id) => {
                  setTypeId(id);
                  setSlot("");
                  setDay("");
                }}
              >
                {context.types.map((item) => (
                  <RadioCard key={item.id} value={item.id} title={item.name} description={`${item.duration_minutes} min · ${KIND_LABEL[item.kind]}`} />
                ))}
              </RadioGroup>
            ) : type ? (
              <p className="text-sm text-muted">
                {type.name} · {type.duration_minutes} min · {KIND_LABEL[type.kind]}
              </p>
            ) : null}

            {loading && !slots.length ? (
              <LoadingBlock label="Buscando huecos…" />
            ) : byDay.length === 0 ? (
              <EmptyState title="No hay huecos libres en los próximos 30 días" hint="Escríbele a tu consultor y lo vemos." />
            ) : (
              <div className={s.picker}>
                <div className={s.days} role="listbox" aria-label="Día">
                  {byDay.map(([key, items]) => (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={key === day}
                      className={s.dayChip}
                      data-selected={key === day}
                      onClick={() => {
                        setDay(key);
                        setSlot("");
                      }}
                    >
                      <span>{fmtDay(items[0]!.starts_at, { weekday: "short" })}</span>
                      <b>{new Date(items[0]!.starts_at).getDate()}</b>
                      <span>{fmtDay(items[0]!.starts_at, { month: "short" })}</span>
                    </button>
                  ))}
                </div>
                <div className={s.times} role="listbox" aria-label="Hora">
                  {times.map(({ starts_at }) => (
                    <button
                      key={starts_at}
                      type="button"
                      role="option"
                      aria-selected={starts_at === slot}
                      className={s.timeChip}
                      data-selected={starts_at === slot}
                      onClick={() => setSlot(starts_at)}
                    >
                      {fmtTime(starts_at)}
                    </button>
                  ))}
                </div>
                {!sameZone ? (
                  <p className="text-xs text-muted">Horas en tu zona ({browserTimezone()}). Tu consultor trabaja en {context?.timezone}.</p>
                ) : null}
              </div>
            )}

            {!reschedule && slot ? (
              <Field label="¿De qué quieres hablar? (opcional)">
                <Textarea maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
            ) : null}
          </>
        )}
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button disabled={saving || !slot} onClick={() => void confirm()}>{saving ? "Guardando…" : reschedule ? "Mover" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
