"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Checkbox, DateTimePicker, MultiSearchableSelect, toast } from "@/components/ui";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import type { CampaignRow } from "../campaign-rows";
import { int, type KWorkspace } from "../klaviyo-workspace";
import { fmtSchedule, toDatetimeLocal } from "../format";
import { Btn, Panel, Section, css as s } from "./campanas-parts";
import { cx, emailLinks } from "./campaign-format";

/**
 * Enviar y programar, dentro de la propia campaña.
 *
 * Se crea en la cuenta de Klaviyo del cliente con la pieza aprobada. Programar
 * no envía nada hasta la hora elegida y se puede devolver a borrador. El
 * servidor decide quién puede: el cliente, o su consultor asignado, y un
 * cliente con consultor solo cuando la campaña ya está revisada.
 */

function defaultSendAt(item: CampaignItem) {
  const planned = new Date(item.starts_at);
  if (planned.getTime() > Date.now() + 30 * 60_000) return toDatetimeLocal(planned.toISOString());
  const soon = new Date(Date.now() + 60 * 60_000);
  soon.setMinutes(0, 0, 0);
  return toDatetimeLocal(soon.toISOString());
}

type Step = { ok: boolean; title: string; sub: string };

export function SendPanel({
  organizationId,
  row,
  item,
  draft,
  workspace,
  clientName,
  onDone,
}: {
  organizationId: string;
  row: CampaignRow;
  item: CampaignItem;
  draft: MarketingDraft | null;
  workspace: KWorkspace | undefined;
  clientName: string;
  /** Un cliente con consultor no programa mientras su campaña está en revisión. */
  onDone: () => void;
}) {
  const scheduled = (row.state === "scheduled" || row.state === "sending") && row.campaign;
  return (
    <Section
      id="enviar"
      title="Enviar y programar"
      lead="Se crea en la cuenta de Klaviyo del cliente con la pieza aprobada. Programar no envía nada hasta la hora elegida, y se puede devolver a borrador."
    >
      {scheduled ? (
        <ScheduledState organizationId={organizationId} row={row} onDone={onDone} />
      ) : (
        <ScheduleForm
          organizationId={organizationId}
          row={row}
          item={item}
          draft={draft}
          workspace={workspace}
          clientName={clientName}
          onDone={onDone}
        />
      )}
    </Section>
  );
}

function ScheduledState({ organizationId, row, onDone }: { organizationId: string; row: CampaignRow; onDone: () => void }) {
  const [confirm, setConfirm] = useState<"cancel" | "revert" | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(action: "cancel" | "revert") {
    if (!row.campaign) return;
    setBusy(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/klaviyo/campaigns/${encodeURIComponent(row.campaign.external_id)}/cancel`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(action === "cancel" ? "Envío cancelado" : "Vuelve a ser un borrador en Klaviyo");
      onDone();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  return (
    <Panel title="Programada en Klaviyo" sub={row.date ? `Sale el ${fmtSchedule(row.date)}` : undefined}>
      {confirm ? (
        <div className={s.confirm}>
          <span>
            {confirm === "cancel"
              ? "¿Cancelar el envío? No se enviará a nadie y para volver a sacarla habrá que crearla de nuevo."
              : "¿Devolverla a borrador? Deja de estar programada y queda como borrador en Klaviyo."}
          </span>
          <Btn size="sm" variant="dangerSolid" disabled={busy} onClick={() => void run(confirm)}>
            Sí, {confirm === "cancel" ? "cancelar" : "devolver"}
          </Btn>
          <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>
            No
          </Btn>
        </div>
      ) : (
        <div className={s.formF} style={{ borderTop: 0, paddingTop: 0 }}>
          <span className={s.foot}>Puedes devolverla a borrador hasta la hora de envío.</span>
          <span className={s.alAct}>
            <Btn variant="ghost" onClick={() => setConfirm("revert")}>
              Devolver a borrador
            </Btn>
            <Btn variant="danger" onClick={() => setConfirm("cancel")}>
              Cancelar envío
            </Btn>
          </span>
        </div>
      )}
    </Panel>
  );
}

function ScheduleForm({
  organizationId,
  row,
  item,
  draft,
  workspace,
  clientName,
  onDone,
}: {
  organizationId: string;
  row: CampaignRow;
  item: CampaignItem;
  draft: MarketingDraft | null;
  workspace: KWorkspace | undefined;
  clientName: string;
  onDone: () => void;
}) {
  const lists = workspace?.audiences?.lists ?? [];
  const segments = workspace?.audiences?.segments ?? [];
  const audiences = [
    ...lists.map((list) => ({ id: list.id, name: list.name, size: list.size, kind: "Lista" })),
    ...segments.map((segment) => ({ id: segment.id, name: segment.name, size: segment.size, kind: "Segmento" })),
  ];
  const studioSend = draft?.request?.design && "send" in draft.request.design ? draft.request.design.send : null;
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(row.audiences.included.length ? row.audiences.included.map((audience) => audience.id) : (studioSend?.audiences ?? [])),
  );
  const [excluded, setExcluded] = useState<Set<string>>(
    () => new Set(row.audiences.excluded.length ? row.audiences.excluded.map((audience) => audience.id) : (studioSend?.exclude ?? [])),
  );
  const [smart, setSmart] = useState(studioSend?.smart ?? true);
  const [subject, setSubject] = useState(draft?.subject ?? row.subject ?? "");
  const [fromEmail] = useState(workspace?.account?.default_from_email ?? "");
  const [fromLabel] = useState(draft?.from_name || workspace?.account?.default_from_label || clientName);
  const [sendAt, setSendAt] = useState(() => defaultSendAt(item));
  const [confirmNow, setConfirmNow] = useState(false);
  const [busy, setBusy] = useState(false);
  // La hora mínima se fija al abrir: «dentro de 5 minutos» no se mueve mientras se escribe.
  const [openedAt] = useState(() => Date.now());

  const approved = draft ? ["approved", "published"].includes(draft.status) : false;
  const connected = Boolean(workspace?.connected);
  const canSchedule = Boolean(workspace?.connection?.can_schedule);
  const reach = audiences.filter((audience) => included.has(audience.id)).reduce((sum, audience) => sum + (audience.size ?? 0), 0);
  const links = draft ? emailLinks(draft.html) : [];
  const timeOk = Date.parse(sendAt) >= openedAt + 5 * 60_000;

  const steps: Step[] = [
    { ok: approved, title: "Pieza aprobada", sub: approved ? "Se puede subir a Klaviyo" : "Aprueba la pieza para poder programarla" },
    { ok: connected && canSchedule, title: "Klaviyo conectado con permiso de campañas", sub: !connected ? "Conecta Klaviyo en Integraciones" : !canSchedule ? "Vuelve a conectar aceptando «Campaigns»" : `Cuenta del cliente · ${clientName}` },
    { ok: Boolean(subject.trim() && fromEmail.trim()), title: "Asunto y remitente", sub: !subject.trim() ? "Falta el asunto" : fromEmail || "Falta el email del remitente" },
    { ok: links.length > 0, title: "El email lleva a algún sitio", sub: links[0] ?? "No hay ningún enlace de destino en el email" },
    { ok: included.size > 0, title: "Audiencia elegida", sub: included.size ? `Llega a ${int(reach)} perfiles` : "Elige al menos una lista o segmento" },
    { ok: timeOk, title: "Hora válida", sub: "Al menos 5 minutos desde ahora" },
  ];
  const ready = steps.every((step) => step.ok);
  const firstBad = steps.findIndex((step) => !step.ok);

  async function submit(now: boolean) {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/klaviyo/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          calendarItemId: item.id,
          name: row.name,
          subject,
          previewText: draft.preheader,
          fromEmail,
          fromLabel,
          includedAudiences: [...included],
          excludedAudiences: [...excluded],
          sendAt: now ? null : new Date(sendAt).toISOString(),
          smartSending: smart,
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(now ? "Enviándose desde Klaviyo" : `Programada: ${fmtSchedule(new Date(sendAt).toISOString())}`);
      onDone();
    } finally {
      setBusy(false);
      setConfirmNow(false);
    }
  }

  return (
    <div className={s.two}>
      <Panel>
        <div className={s.sendGrid}>
          <div className={cx(s.fld, s.full, s.inline)}>
            <label htmlFor="send-subject">Asunto</label>
            <input id="send-subject" type="text" maxLength={255} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className={cx(s.fld, s.inline)}>
            <label htmlFor="send-from">Nombre del remitente</label>
            <input id="send-from" type="text" value={fromLabel} readOnly />
          </div>
          <div className={cx(s.fld, s.inline)}>
            <label htmlFor="send-email">Email del remitente</label>
            <input id="send-email" type="text" value={fromEmail} readOnly />
          </div>
          <div className={cx(s.fld, s.full)}>
            <span className={s.lbl}>Envía a{reach ? ` · ${int(reach)} perfiles` : ""}</span>
            {audiences.length === 0 ? (
              <span className={s.mut}>Aún no hay listas ni segmentos sincronizados.</span>
            ) : (
              <MultiSearchableSelect
                aria-label="Listas y segmentos a los que se envía"
                placeholder="Busca una lista o un segmento"
                emptyText="No hay ninguna lista ni segmento con ese nombre."
                values={[...included]}
                onChange={(next) => setIncluded(new Set(next))}
                options={audiences.map((audience) => ({ value: audience.id, label: audience.name, section: audience.kind === "Lista" ? "Listas" : "Segmentos", hint: audience.size != null ? `${int(audience.size)} perfiles` : undefined }))}
              />
            )}
          </div>
          {audiences.length ? (
            <div className={cx(s.fld, s.full)}>
              <span className={s.lbl}>Excluye</span>
              <MultiSearchableSelect
                aria-label="Listas y segmentos que se excluyen"
                placeholder="Nadie excluido"
                emptyText="No hay ninguna lista ni segmento con ese nombre."
                values={[...excluded]}
                onChange={(next) => setExcluded(new Set(next))}
                options={audiences.map((audience) => ({ value: audience.id, label: audience.name, section: audience.kind === "Lista" ? "Listas" : "Segmentos", hint: audience.size != null ? `${int(audience.size)} perfiles` : undefined }))}
              />
            </div>
          ) : null}
          <div className={cx(s.fld, s.inline)}>
            <label htmlFor="send-when">Fecha y hora de envío</label>
            <DateTimePicker id="send-when" aria-label="Fecha y hora de envío" min={toDatetimeLocal(new Date().toISOString())} value={sendAt} onChange={setSendAt} />
          </div>
          <div className={s.fld}>
            <span className={s.lbl}>Smart Sending</span>
            <Checkbox checked={smart} onCheckedChange={setSmart}>
              No enviar a quien recibió un email en las últimas 16 horas
            </Checkbox>
          </div>
        </div>
        {confirmNow ? (
          <div className={s.confirm} style={{ marginTop: 16 }}>
            <span>¿Enviar ahora{reach ? ` a ${int(reach)} perfiles` : ""}? Sale en cuanto Klaviyo lo procese y después ya no se puede parar.</span>
            <Btn size="sm" variant="dangerSolid" disabled={busy} onClick={() => void submit(true)}>
              Sí, enviar ahora
            </Btn>
            <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmNow(false)}>
              No
            </Btn>
          </div>
        ) : (
          <div className={s.formF} style={{ marginTop: 16 }}>
            <span className={s.alAct}>
              <Btn disabled={busy || !ready} onClick={() => void submit(false)}>
                {busy ? "Programando…" : "Programar en Klaviyo"}
              </Btn>
              <Btn variant="ghost" disabled={busy || !ready} onClick={() => setConfirmNow(true)}>
                Enviar ahora
              </Btn>
            </span>
          </div>
        )}
      </Panel>
      <Panel title="Antes de programar" sub={ready ? "Todo listo para programar." : `Falta ${steps.filter((step) => !step.ok).length} por resolver.`}>
        <div>
          {steps.map((step, index) => (
            <div key={step.title} className={cx(s.step, step.ok && s.ok, !step.ok && index === firstBad && s.now)}>
              <i>{step.ok ? "✓" : index + 1}</i>
              <div>
                {step.title}
                <span>{step.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
