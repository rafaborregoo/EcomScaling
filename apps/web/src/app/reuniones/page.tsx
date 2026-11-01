"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { getViewAs } from "@/lib/view-as";
import { StatusStrip, WorkPageHeader } from "@/components/trabajo-ui";
import { Badge, Banner, Button, EmptyState, ErrorBlock, LoadingBlock, Tabs } from "@/components/ui";
import { BookingDialog } from "./booking-dialog";
import { MeetingDetail } from "./meeting-detail";
import { AvailabilityPanel, TypesPanel, type MeetingConfig } from "./staff-settings";
import { fmtDay, fmtTime, groupByDay, isUpcoming, KIND_LABEL, STATUS_LABEL, type Meeting } from "./meetings-model";
import s from "./reuniones.module.css";

function MeetingRow({ meeting, staff, onOpen }: { meeting: Meeting; staff: boolean; onOpen: () => void }) {
  const state = STATUS_LABEL[meeting.status];
  const start = new Date(meeting.starts_at);
  return (
    <li>
      <button type="button" className={s.row} onClick={onOpen} data-focus-id={meeting.id}>
        <span className={s.date}>
          <b>{start.getDate()}</b>
          <span>{fmtDay(start, { month: "short" })}</span>
        </span>
        <span className={s.rowMain}>
          <b>{meeting.title}</b>
          <span>
            {fmtTime(meeting.starts_at)}–{fmtTime(meeting.ends_at)} · {KIND_LABEL[meeting.kind]}
            {staff && meeting.organization_name ? ` · ${meeting.organization_name}` : ""}
          </span>
        </span>
        {meeting.status !== "scheduled" || !isUpcoming(meeting) ? <Badge tone={state.tone}>{state.label}</Badge> : null}
      </button>
    </li>
  );
}

function MeetingList({ meetings, staff, onOpen }: { meetings: Meeting[]; staff: boolean; onOpen: (meeting: Meeting) => void }) {
  const upcoming = meetings.filter(isUpcoming).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = meetings.filter((meeting) => !isUpcoming(meeting)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return (
    <div className={s.stack}>
      {upcoming.length === 0 ? <EmptyState title="No hay reuniones próximas" /> : null}
      {groupByDay(upcoming).map(([key, items]) => (
        <section key={key}>
          <h3 className={s.dayTitle}>{fmtDay(items[0]!.starts_at)}</h3>
          <ul className={s.list}>
            {items.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} staff={staff} onOpen={() => onOpen(meeting)} />
            ))}
          </ul>
        </section>
      ))}
      {past.length ? (
        <section>
          <h3 className={s.dayTitle}>Anteriores</h3>
          <ul className={s.list}>
            {past.slice(0, 30).map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} staff={staff} onOpen={() => onOpen(meeting)} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MeetingsContent({ staff }: { staff: boolean }) {
  const { organizationId } = useActiveOrganization();
  const focusId = useSearchParams().get("meeting");
  const [tab, setTab] = useState("agenda");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [config, setConfig] = useState<MeetingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);
  const [moving, setMoving] = useState<Meeting | null>(null);

  const load = useCallback(async () => {
    if (!staff && !organizationId) return;
    try {
      const path = staff ? "/v1/consultant/meetings" : `/v1/organizations/${organizationId}/meetings`;
      const response = await apiFetch(path, { cache: "no-store" });
      if (!response.ok) return setError(await readApiError(response));
      setMeetings(((await response.json()) as { meetings: Meeting[] }).meetings);
      setError(null);
    } catch {
      setError("No se pudieron cargar las reuniones. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [staff, organizationId]);

  const loadConfig = useCallback(async () => {
    if (!staff) return;
    try {
      const response = await apiFetch("/v1/consultant/meetings/config", { cache: "no-store" });
      if (response.ok) setConfig((await response.json()) as MeetingConfig);
    } catch {
      /* la pestaña de ajustes muestra su propio vacío */
    }
  }, [staff]);

  useEffect(() => {
    void load();
    void loadConfig();
  }, [load, loadConfig]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Un aviso apunta a ?meeting=<id>: se abre su ficha una vez.
  useEffect(() => {
    if (!focusId) return;
    const match = meetings.find((meeting) => meeting.id === focusId);
    if (match) setSelected((current) => current ?? match);
  }, [focusId, meetings]);

  const strip = useMemo(() => {
    if (now === null) return [];
    const today = new Date(now).toDateString();
    const upcoming = meetings.filter(isUpcoming);
    return [
      { value: upcoming.filter((meeting) => new Date(meeting.starts_at).toDateString() === today).length, label: "Hoy" },
      { value: upcoming.filter((meeting) => Date.parse(meeting.starts_at) < now + 7 * 86_400_000).length, label: "Próximos 7 días" },
      {
        value: meetings.filter((meeting) => meeting.status !== "cancelled" && Date.parse(meeting.ends_at) < now && meeting.call?.summary !== "published").length,
        label: "Por documentar",
        tone: "warn" as const,
      },
    ];
  }, [meetings, now]);

  if (!staff && !organizationId) return <Banner tone="warn">Selecciona una tienda en la barra superior para ver tus reuniones.</Banner>;

  const canBook = Boolean(organizationId);
  const agenda = loading ? <LoadingBlock label="Cargando reuniones…" /> : <MeetingList meetings={meetings} staff={staff} onOpen={setSelected} />;

  return (
    <div className={`portal-page space-y-6 ${s.page}`}>
      <div className={s.header}>
        <WorkPageHeader title="Reuniones">
          {staff ? "Tu agenda con los clientes, tu disponibilidad y lo que sale de cada llamada." : "Reserva una reunión con tu consultor."}
        </WorkPageHeader>
        {canBook ? <Button onClick={() => setBooking(true)}>{staff ? "Reservar para este cliente" : "Reservar reunión"}</Button> : null}
      </div>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {staff ? <StatusStrip items={strip} /> : null}

      {staff ? (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "agenda", label: "Agenda" },
            { value: "disponibilidad", label: "Disponibilidad" },
            { value: "tipos", label: "Tipos de reunión" },
          ]}
          panels={{
            agenda: <div className="pt-4">{agenda}</div>,
            disponibilidad: <div className="pt-4">{config ? <AvailabilityPanel config={config} reload={loadConfig} /> : <LoadingBlock label="Cargando…" />}</div>,
            tipos: <div className="pt-4">{config ? <TypesPanel types={config.types} reload={loadConfig} /> : <LoadingBlock label="Cargando…" />}</div>,
          }}
        />
      ) : (
        agenda
      )}

      <MeetingDetail
        meeting={selected}
        staff={staff}
        onClose={() => setSelected(null)}
        onChanged={load}
        onReschedule={(meeting) => {
          setSelected(null);
          setMoving(meeting);
        }}
      />
      {organizationId ? (
        <BookingDialog
          organizationId={moving?.organization_id ?? organizationId}
          open={booking || moving !== null}
          onOpenChange={(open) => {
            if (!open) {
              setBooking(false);
              setMoving(null);
            }
          }}
          onDone={load}
          reschedule={moving}
        />
      ) : null}
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <PortalShell title="Reuniones">
      {(bootstrap) => <MeetingsContent staff={!getViewAs() && ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role)} />}
    </PortalShell>
  );
}
