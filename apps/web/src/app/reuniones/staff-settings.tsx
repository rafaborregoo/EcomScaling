"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, ErrorBlock, Field, Input, PlusIcon, Select, Switch, TrashIcon, Textarea, TimeInput, TimezoneCombobox, toast, DateTimePicker } from "@/components/ui";
import { browserTimezone, fmtDay, fmtTime, KIND_LABEL, WEEKDAYS, type Meeting, type MeetingType } from "./meetings-model";
import s from "./reuniones.module.css";

export type MeetingConfig = {
  settings: { timezone: string; slot_step_minutes: number; default_location_url: string | null };
  rules: Array<{ id: string; weekday: number; start_time: string; end_time: string }>;
  blocks: Array<{ id: string; starts_at: string; ends_at: string; reason: string | null }>;
  types: MeetingType[];
};

type Range = { start: string; end: string };
const hhmm = (value: string) => value.slice(0, 5);

async function call(path: string, method: string, body?: unknown) {
  const response = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response;
}

/** Horario semanal, zona horaria, intervalo entre huecos y bloqueos puntuales (vacaciones, médico…). */
export function AvailabilityPanel({ config, reload }: { config: MeetingConfig; reload: () => Promise<void> }) {
  const [week, setWeek] = useState<Record<number, Range[]>>({});
  const [timezone, setTimezone] = useState(config.settings.timezone);
  const [step, setStep] = useState(String(config.settings.slot_step_minutes));
  const [link, setLink] = useState(config.settings.default_location_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockReason, setBlockReason] = useState("");

  useEffect(() => {
    const next: Record<number, Range[]> = {};
    for (const rule of config.rules) {
      next[rule.weekday] = [...(next[rule.weekday] ?? []), { start: hhmm(rule.start_time), end: hhmm(rule.end_time) }];
    }
    setWeek(next);
    setTimezone(config.settings.timezone);
    setStep(String(config.settings.slot_step_minutes));
    setLink(config.settings.default_location_url ?? "");
  }, [config]);

  const setRanges = (weekday: number, ranges: Range[]) => setWeek((current) => ({ ...current, [weekday]: ranges }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await call("/v1/consultant/meetings/availability", "PUT", {
        timezone,
        slotStepMinutes: Number(step),
        defaultLocationUrl: link,
        rules: Object.entries(week).flatMap(([weekday, ranges]) => ranges.map((range) => ({ weekday: Number(weekday), ...range }))),
      });
      toast.success("Disponibilidad guardada");
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function addBlock() {
    try {
      await call("/v1/consultant/meetings/blocks", "POST", {
        startsAt: new Date(blockFrom).toISOString(),
        endsAt: new Date(blockTo).toISOString(),
        reason: blockReason,
      });
      setBlockFrom("");
      setBlockTo("");
      setBlockReason("");
      await reload();
    } catch (failure) {
      toast.danger(failure instanceof Error ? failure.message : "No se pudo bloquear.");
    }
  }

  const local = browserTimezone();
  return (
    <div className={s.stack}>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <section className={s.panel}>
        <h2>Horario semanal</h2>
        <div className={s.weekRows}>
          {WEEKDAYS.map(({ value, label }) => {
            const ranges = week[value] ?? [];
            return (
              <div key={value} className={s.weekRow}>
                <Switch
                  isSelected={ranges.length > 0}
                  onChange={(on: boolean) => setRanges(value, on ? [{ start: "09:00", end: "14:00" }] : [])}
                  aria-label={`${label} disponible`}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
                <b>{label}</b>
                {ranges.length === 0 ? <span className="text-muted">No disponible</span> : null}
                <div className={s.ranges}>
                  {ranges.map((range, index) => (
                    <span key={index} className={s.range}>
                      <TimeInput
                        aria-label={`${label}: desde`}
                        value={range.start}
                        onChange={(event) => setRanges(value, ranges.map((item, at) => (at === index ? { ...item, start: event.target.value } : item)))}
                      />
                      <span>–</span>
                      <TimeInput
                        aria-label={`${label}: hasta`}
                        value={range.end}
                        onChange={(event) => setRanges(value, ranges.map((item, at) => (at === index ? { ...item, end: event.target.value } : item)))}
                      />
                      <Button size="sm" variant="ghost" aria-label="Quitar franja" onClick={() => setRanges(value, ranges.filter((_, at) => at !== index))}>
                        <TrashIcon />
                      </Button>
                    </span>
                  ))}
                  {ranges.length > 0 ? (
                    <Button size="sm" variant="ghost" aria-label={`Añadir franja el ${label}`} onClick={() => setRanges(value, [...ranges, { start: "16:00", end: "18:00" }])}>
                      <PlusIcon />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className={s.formGrid}>
          <Field label="Zona horaria">
            <TimezoneCombobox value={timezone} onChange={setTimezone} />
            {timezone !== local ? <p className="mt-1 text-xs text-muted">Tu navegador está en {local}.</p> : null}
          </Field>
          <Field label="Un hueco cada">
            <Select
              aria-label="Intervalo entre huecos"
              value={step}
              onChange={setStep}
              options={[10, 15, 20, 30, 60].map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))}
            />
          </Field>
          <Field label="Enlace por defecto (si el tipo no lleva uno)">
            <Input type="url" placeholder="https://meet.google.com/…" value={link} onChange={(event) => setLink(event.target.value)} />
          </Field>
        </div>
        <div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar disponibilidad"}
          </Button>
        </div>
      </section>

      <section className={s.panel}>
        <h2>Bloqueos</h2>
        {config.blocks.length === 0 ? <EmptyState size="sm" title="Sin bloqueos próximos" /> : null}
        <ul className={s.blockList}>
          {config.blocks.map((block) => (
            <li key={block.id}>
              <span>
                {fmtDay(block.starts_at, { day: "numeric", month: "short" })} {fmtTime(block.starts_at)} → {fmtDay(block.ends_at, { day: "numeric", month: "short" })} {fmtTime(block.ends_at)}
                {block.reason ? <span className="text-muted"> · {block.reason}</span> : null}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Quitar bloqueo"
                onClick={() => void call(`/v1/consultant/meetings/blocks/${block.id}`, "DELETE").then(reload).catch(() => toast.danger("No se pudo quitar."))}
              >
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
        <div className={s.formGrid}>
          <Field label="Desde">
            <DateTimePicker aria-label="Desde" value={blockFrom} onChange={setBlockFrom} />
          </Field>
          <Field label="Hasta">
            <DateTimePicker aria-label="Hasta" min={blockFrom} value={blockTo} onChange={setBlockTo} />
          </Field>
          <Field label="Motivo (opcional)">
            <Input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} />
          </Field>
        </div>
        <div>
          <Button variant="secondary" disabled={!blockFrom || !blockTo || blockTo <= blockFrom} onClick={() => void addBlock()}>
            Bloquear
          </Button>
        </div>
      </section>
    </div>
  );
}

const EMPTY_TYPE = {
  name: "",
  description: "",
  durationMinutes: "30",
  bufferMinutes: "0",
  minNoticeHours: "12",
  maxDaysAhead: "45",
  maxPerDay: "",
  kind: "video",
  locationUrl: "",
  isActive: true,
};

/** Los tipos de reunión que el cliente puede reservar, con su duración y reglas. */
export function TypesPanel({ types, reload }: { types: MeetingType[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<MeetingType | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_TYPE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setError(null);
    setForm(
      editing === "new"
        ? EMPTY_TYPE
        : {
            name: editing.name,
            description: editing.description ?? "",
            durationMinutes: String(editing.duration_minutes),
            bufferMinutes: String(editing.buffer_minutes),
            minNoticeHours: String(editing.min_notice_hours ?? 12),
            maxDaysAhead: String(editing.max_days_ahead ?? 45),
            maxPerDay: editing.max_per_day ? String(editing.max_per_day) : "",
            kind: editing.kind,
            locationUrl: editing.location_url ?? "",
            isActive: editing.is_active ?? true,
          },
    );
  }, [editing]);

  const set = <K extends keyof typeof EMPTY_TYPE>(key: K, value: (typeof EMPTY_TYPE)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        bufferMinutes: Number(form.bufferMinutes),
        minNoticeHours: Number(form.minNoticeHours),
        maxDaysAhead: Number(form.maxDaysAhead),
        maxPerDay: form.maxPerDay ? Number(form.maxPerDay) : null,
        kind: form.kind,
        locationUrl: form.locationUrl,
        isActive: form.isActive,
      };
      await (editing === "new" ? call("/v1/consultant/meetings/types", "POST", body) : call(`/v1/consultant/meetings/types/${(editing as MeetingType).id}`, "PATCH", body));
      toast.success("Tipo guardado");
      setEditing(null);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (editing === "new" || !editing) return;
    try {
      await call(`/v1/consultant/meetings/types/${editing.id}`, "DELETE");
      setEditing(null);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo borrar.");
    }
  }

  const number = (key: "durationMinutes" | "bufferMinutes" | "minNoticeHours" | "maxDaysAhead" | "maxPerDay", label: string, min: number, max: number) => (
    <Field label={label}>
      <Input type="number" min={min} max={max} value={form[key]} onChange={(event) => set(key, event.target.value)} />
    </Field>
  );

  return (
    <div className={s.stack}>
      <div>
        <Button onClick={() => setEditing("new")}>Nuevo tipo</Button>
      </div>
      {types.length === 0 ? <EmptyState title="Aún no tienes tipos de reunión" hint="Crea uno para que tus clientes puedan reservar." /> : null}
      <div className={s.typeGrid}>
        {types.map((type) => (
          <button key={type.id} type="button" className={s.typeCard} onClick={() => setEditing(type)}>
            <b>{type.name}</b>
            <span>
              {type.duration_minutes} min · {KIND_LABEL[type.kind]}
              {type.buffer_minutes ? ` · +${type.buffer_minutes} min de colchón` : ""}
            </span>
            {type.is_active === false ? <Badge>Oculto</Badge> : null}
          </button>
        ))}
      </div>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} busy={saving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nuevo tipo de reunión" : "Editar tipo"}</DialogTitle>
          </DialogHeader>
          {error ? <ErrorBlock>{error}</ErrorBlock> : null}
          <Field label="Nombre">
            <Input value={form.name} onChange={(event) => set("name", event.target.value)} />
          </Field>
          <Field label="Descripción (la ve el cliente)">
            <Textarea maxLength={500} value={form.description} onChange={(event) => set("description", event.target.value)} />
          </Field>
          <div className={s.formGrid}>
            {number("durationMinutes", "Duración (min)", 10, 240)}
            {number("bufferMinutes", "Colchón después (min)", 0, 120)}
            {number("minNoticeHours", "Antelación mínima (h)", 0, 720)}
            {number("maxDaysAhead", "Reservable hasta (días)", 1, 365)}
            {number("maxPerDay", "Máximo por día (vacío = sin tope)", 1, 20)}
            <Field label="Formato">
              <Select
                aria-label="Formato"
                value={form.kind}
                onChange={(value) => set("kind", value)}
                options={(Object.keys(KIND_LABEL) as Meeting["kind"][]).map((value) => ({ value, label: KIND_LABEL[value] }))}
              />
            </Field>
          </div>
          <Field label="Enlace o lugar">
            <Input placeholder="https://meet.google.com/…" value={form.locationUrl} onChange={(event) => set("locationUrl", event.target.value)} />
          </Field>
          <Switch isSelected={form.isActive} onChange={(on: boolean) => set("isActive", on)} aria-label="Visible para los clientes">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="ml-2 text-sm">Visible para los clientes</span>
          </Switch>
          <DialogFooter>
            <div className="flex flex-wrap items-center gap-2 empty:hidden sm:mr-auto">{editing && editing !== "new" ? (
            <Button variant="ghost" className="text-danger" onClick={() => void remove()}>
              Borrar
            </Button>
          ) : undefined}</div>
            <DialogClose>Cancelar</DialogClose>
            <Button disabled={saving || !form.name.trim()} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
