"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import { StatusStrip } from "@/components/trabajo-ui";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Checkbox,
  Drawer,
  Field,
  Input,
  LoadingBlock,
  toast,
} from "@/components/ui";
import { audienceSize, STATE_LABEL, type CampaignRow } from "./campaign-rows";
import { int, pct, ratio, type KWorkspace } from "./klaviyo-workspace";
import { fmtSchedule, toDatetimeLocal } from "./format";
import s from "./marketing-views.module.css";

type Props = {
  row: CampaignRow | null;
  organizationId: string;
  workspace: KWorkspace | undefined;
  onClose: () => void;
  onChanged: () => void;
  onWritePiece: (item: CampaignItem) => void;
  onOpenDraft: (draftId: string) => void;
};

/** Panel lateral de una campaña: qué es, a quién va, qué hacer con ella y cómo fue. */
export function CampaignDrawer({ row, organizationId, workspace, onClose, onChanged, onWritePiece, onOpenDraft }: Props) {
  return (
    <Drawer isOpen={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-label={row?.name ?? "Campaña"} className="w-[min(60rem,94vw)] max-w-[94vw] sm:w-[min(60rem,94vw)]">
            {row ? (
              <>
                <Drawer.Header>
                  <div className="grid gap-1">
                    <Drawer.Heading>{row.name}</Drawer.Heading>
                    <span className={s.row}>
                      <Badge tone={STATE_LABEL[row.state].tone}>{STATE_LABEL[row.state].label}</Badge>
                      <span className={s.muted}>
                        {row.date ? fmtSchedule(row.date) : "Sin fecha"} ·{" "}
                        {row.source === "klaviyo" ? "creada en Klaviyo" : "planificada en NORA"}
                      </span>
                    </span>
                  </div>
                  <Drawer.CloseTrigger />
                </Drawer.Header>
                <Drawer.Body>
                  <CampaignDetail
                    key={row.key}
                    row={row}
                    organizationId={organizationId}
                    workspace={workspace}
                    onChanged={onChanged}
                    onClose={onClose}
                    onWritePiece={onWritePiece}
                    onOpenDraft={onOpenDraft}
                  />
                </Drawer.Body>
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function CampaignDetail({ row, organizationId, workspace, onChanged, onClose, onWritePiece, onOpenDraft }: Omit<Props, "row"> & { row: CampaignRow }) {
  if (row.state === "nopiece" || (row.state === "late" && !row.draft)) {
    return (
      <div className="grid gap-3">
        <p>
          Esta campaña aún no tiene pieza.{" "}
          {row.date ? `Estaba prevista para el ${fmtSchedule(row.date)}.` : null}
        </p>
        <div className={s.acts}>
          {row.item ? (
            <Button onClick={() => onWritePiece(row.item!)}>Escribir la pieza</Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className={s.drawerGrid}>
        <EmailPreview organizationId={organizationId} row={row} />
        <div className="grid content-start gap-4">
          <dl className={s.kv}>
            <dt>Asunto</dt>
            <dd>{row.subject || row.draft?.subject || "—"}</dd>
            <dt>Preheader</dt>
            <dd>{row.campaign?.preview_text || row.draft?.preheader || "—"}</dd>
            <dt>Remitente</dt>
            <dd>
              {row.campaign?.from_label || row.draft?.from_name || workspace?.account?.default_from_label || "—"}
              {row.campaign?.from_email ? ` · ${row.campaign.from_email}` : ""}
            </dd>
            <dt>Envía a</dt>
            <dd>{audienceText(row.audiences.included)}</dd>
            <dt>Excluye</dt>
            <dd>{audienceText(row.audiences.excluded)}</dd>
          </dl>
          <Actions
            row={row}
            organizationId={organizationId}
            workspace={workspace}
            onChanged={onChanged}
            onClose={onClose}
            onOpenDraft={onOpenDraft}
          />
        </div>
      </div>
      {row.state === "sent" || row.state === "sending" ? (
        <Results row={row} organizationId={organizationId} currency={workspace?.account?.currency ?? "EUR"} />
      ) : null}
    </div>
  );
}

function audienceText(list: CampaignRow["audiences"]["included"]) {
  if (!list.length) return "—";
  const total = audienceSize(list);
  return `${list.map((audience) => audience.name).join(", ")}${total != null ? ` (${int(total)} perfiles)` : ""}`;
}

function EmailPreview({ organizationId, row }: { organizationId: string; row: CampaignRow }) {
  const templateId = row.draft?.html ? null : row.campaign?.template_id ?? null;
  const [html, setHtml] = useState<string | null>(row.draft?.html ?? null);
  const [loading, setLoading] = useState(Boolean(templateId));

  useEffect(() => {
    if (!templateId) return;
    let alive = true;
    void apiFetch(`/v1/organizations/${organizationId}/marketing/klaviyo/templates/${encodeURIComponent(templateId)}/html`)
      .then(async (response) => {
        if (!alive || !response.ok) return;
        const payload = (await response.json()) as { html: string | null };
        setHtml(payload.html);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [organizationId, templateId]);

  if (loading) return <LoadingBlock label="Cargando el email…" />;
  if (!html) return <div className={s.previewEmpty}>Sin vista previa de este email.</div>;
  // sandbox vacío: el HTML del email no ejecuta nada ni navega.
  return <iframe title={`Vista previa de ${row.name}`} className={s.preview} sandbox="" srcDoc={html} loading="lazy" />;
}

function Actions({ row, organizationId, workspace, onChanged, onClose, onOpenDraft }: Omit<Props, "row" | "onWritePiece"> & { row: CampaignRow }) {
  const [confirm, setConfirm] = useState<"cancel" | "revert" | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel(action: "cancel" | "revert") {
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
      onChanged();
      onClose();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function importTemplate(templateId: string) {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/klaviyo/templates/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { draft_id?: string };
      toast.success("Plantilla traída a NORA");
      onChanged();
      if (payload.draft_id) onOpenDraft(payload.draft_id);
    } finally {
      setBusy(false);
    }
  }

  if (row.state === "review" && row.draft) {
    return (
      <div className={s.acts}>
        <Button onClick={() => onOpenDraft(row.draft!.id)}>Revisar la pieza</Button>
      </div>
    );
  }

  if ((row.state === "ready" || row.state === "late") && row.draft) {
    if (!workspace?.connected) {
      return (
        <div className="grid gap-2">
          <Banner tone="warn" className="text-sm">
            Sin Klaviyo conectado, copia la pieza a tu herramienta de email.
          </Banner>
          <div className={s.acts}>
            <Button onClick={() => onOpenDraft(row.draft!.id)}>Abrir la pieza</Button>
            <ButtonLink href="/integraciones" variant="secondary">
              Conectar Klaviyo
            </ButtonLink>
          </div>
        </div>
      );
    }
    return (
      <ScheduleForm
        row={row}
        organizationId={organizationId}
        workspace={workspace}
        onDone={() => {
          onChanged();
          onClose();
        }}
      />
    );
  }

  if (row.state === "scheduled") {
    return confirm ? (
      <div className={s.warnBox}>
        <b>{confirm === "cancel" ? "¿Cancelar el envío?" : "¿Devolverla a borrador?"}</b>
        <span>
          {confirm === "cancel"
            ? "No se enviará a nadie. Para volver a sacarla habrá que crearla de nuevo."
            : "Deja de estar programada y queda como borrador en Klaviyo."}
        </span>
        <div className={s.acts}>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void cancel(confirm)}>
            Sí, {confirm === "cancel" ? "cancelar" : "devolver"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>
            No
          </Button>
        </div>
      </div>
    ) : (
      <div className={s.acts}>
        <Button variant="secondary" onClick={() => setConfirm("revert")}>
          Devolver a borrador
        </Button>
        <Button variant="ghost" onClick={() => setConfirm("cancel")}>
          Cancelar envío
        </Button>
      </div>
    );
  }

  if (row.state === "draft" && row.campaign?.template_id) {
    return (
      <div className={s.acts}>
        <Button disabled={busy} onClick={() => void importTemplate(row.campaign!.template_id!)}>
          Traer la plantilla a NORA
        </Button>
      </div>
    );
  }
  return null;
}

function defaultSendAt(row: CampaignRow) {
  const planned = row.item ? new Date(row.item.starts_at) : null;
  if (planned && planned.getTime() > Date.now() + 30 * 60_000) return toDatetimeLocal(planned.toISOString());
  const soon = new Date(Date.now() + 60 * 60_000);
  soon.setMinutes(0, 0, 0);
  return toDatetimeLocal(soon.toISOString());
}

function ScheduleForm({ row, organizationId, workspace, onDone }: { row: CampaignRow; organizationId: string; workspace: KWorkspace; onDone: () => void }) {
  const lists = workspace.audiences?.lists ?? [];
  const segments = workspace.audiences?.segments ?? [];
  const audiences = [
    ...lists.map((list) => ({ id: list.id, name: list.name, size: list.size, kind: "Lista" })),
    ...segments.map((segment) => ({ id: segment.id, name: segment.name, size: segment.size, kind: "Segmento" })),
  ];
  // Si la campaña aún no tiene audiencias, se parte de las que se eligieron al
  // escribir la pieza en el estudio.
  const studioSend = row.draft?.request?.design && "send" in row.draft.request.design ? row.draft.request.design.send : null;
  const [included, setIncluded] = useState<Set<string>>(() => new Set(row.audiences.included.length ? row.audiences.included.map((audience) => audience.id) : studioSend?.audiences ?? []));
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(row.audiences.excluded.length ? row.audiences.excluded.map((audience) => audience.id) : studioSend?.exclude ?? []));
  const [smartSending, setSmartSending] = useState(studioSend?.smart ?? true);
  const [subject, setSubject] = useState(row.draft?.subject ?? row.subject ?? "");
  const [preview, setPreview] = useState(row.draft?.preheader ?? "");
  const [fromEmail, setFromEmail] = useState(workspace.account?.default_from_email ?? "");
  const [fromLabel, setFromLabel] = useState(row.draft?.from_name || workspace.account?.default_from_label || "");
  const [sendAt, setSendAt] = useState(() => defaultSendAt(row));
  const [confirmNow, setConfirmNow] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!workspace.connection?.can_schedule) {
    return (
      <div className="grid gap-2">
        <Banner tone="warn" className="text-sm">
          Para programar desde NORA, Klaviyo tiene que dar permiso de campañas. Vuelve a conectar la
          cuenta aceptando «Campaigns». Mientras tanto puedes subir la pieza como plantilla.
        </Banner>
        <div className={s.acts}>
          <ButtonLink href="/integraciones" variant="secondary">
            Volver a conectar Klaviyo
          </ButtonLink>
        </div>
      </div>
    );
  }

  const reach = audiences
    .filter((audience) => included.has(audience.id))
    .reduce((sum, audience) => sum + (audience.size ?? 0), 0);
  const valid = subject.trim() && fromEmail.trim() && included.size > 0;

  function toggle(set: Set<string>, id: string, update: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  }

  async function submit(now: boolean) {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/klaviyo/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: row.draft!.id,
          calendarItemId: row.item?.id ?? null,
          name: row.name,
          subject,
          previewText: preview,
          fromEmail,
          fromLabel,
          includedAudiences: [...included],
          excludedAudiences: [...excluded],
          sendAt: now ? null : new Date(sendAt).toISOString(),
          smartSending,
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
    <div className="grid gap-3">
      <Field label="Asunto">
        <Input value={subject} maxLength={255} onChange={(event) => setSubject(event.target.value)} />
      </Field>
      <Field label="Preheader">
        <Input value={preview} maxLength={255} onChange={(event) => setPreview(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre del remitente">
          <Input value={fromLabel} maxLength={160} onChange={(event) => setFromLabel(event.target.value)} />
        </Field>
        <Field label="Email del remitente">
          <Input type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} />
        </Field>
      </div>
      <Field label={`Envía a${reach ? ` · ${int(reach)} perfiles` : ""}`}>
        <div className={s.audPick}>
          {audiences.length === 0 ? (
            <span className={s.muted}>Aún no hay listas ni segmentos sincronizados.</span>
          ) : (
            audiences.map((audience) => (
              <Checkbox
                key={`in-${audience.id}`}
                checked={included.has(audience.id)}
                onChange={() => toggle(included, audience.id, setIncluded)}
              >
                {audience.name} · {audience.kind}
                {audience.size != null ? ` · ${int(audience.size)}` : ""}
              </Checkbox>
            ))
          )}
        </div>
      </Field>
      {audiences.length ? (
        <Field label="Excluye">
          <div className={s.audPick}>
            {audiences.map((audience) => (
              <Checkbox
                key={`ex-${audience.id}`}
                checked={excluded.has(audience.id)}
                onChange={() => toggle(excluded, audience.id, setExcluded)}
              >
                {audience.name} · {audience.kind}
              </Checkbox>
            ))}
          </div>
        </Field>
      ) : null}
      <Field label="Fecha y hora de envío">
        <Input type="datetime-local" value={sendAt} onChange={(event) => setSendAt(event.target.value)} />
      </Field>
      <Checkbox checked={smartSending} onChange={setSmartSending}>
        No enviar a quien recibió un email en las últimas 16 horas (Smart Sending)
      </Checkbox>
      {confirmNow ? (
        <div className={s.warnBox}>
          <b>¿Enviar ahora{reach ? ` a ${int(reach)} perfiles` : ""}?</b>
          <span>Sale en cuanto Klaviyo lo procese. Después ya no se puede parar.</span>
          <div className={s.acts}>
            <Button size="sm" disabled={busy} onClick={() => void submit(true)}>
              Sí, enviar ahora
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmNow(false)}>
              No
            </Button>
          </div>
        </div>
      ) : (
        <div className={s.acts}>
          <Button disabled={busy || !valid} onClick={() => void submit(false)}>
            {busy ? "Programando…" : "Programar en Klaviyo"}
          </Button>
          <Button variant="ghost" disabled={busy || !valid} onClick={() => setConfirmNow(true)}>
            Enviar ahora
          </Button>
        </div>
      )}
    </div>
  );
}

function Results({ row, organizationId, currency }: { row: CampaignRow; organizationId: string; currency: string }) {
  const [links, setLinks] = useState<Array<{ url: string; clicks: number; people: number }> | null>(null);
  const externalId = row.campaign?.external_id;

  useEffect(() => {
    if (!externalId) return;
    let alive = true;
    void apiFetch(`/v1/organizations/${organizationId}/marketing/klaviyo/campaigns/${encodeURIComponent(externalId)}/clicks`)
      .then(async (response) => {
        if (!alive || !response.ok) return;
        const payload = (await response.json()) as { links: Array<{ url: string; clicks: number; people: number }> };
        setLinks(payload.links);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [organizationId, externalId]);

  const stats = row.stats;
  const max = Math.max(1, ...(links ?? []).map((link) => link.clicks));
  return (
    <div className="grid gap-4">
      {stats ? (
        <StatusStrip
          items={[
            { value: int(stats.recipients), label: "Destinatarios" },
            { value: pct(ratio(stats.opens_unique, stats.delivered)), label: "Aperturas" },
            { value: pct(ratio(stats.clicks_unique, stats.delivered)), label: "Clics" },
            { value: formatMoney(stats.revenue, currency), label: "EUR atribuidos por Klaviyo", tone: "good" },
            { value: int(stats.unsubscribes), label: "Bajas" },
          ]}
        />
      ) : (
        <p className={s.muted}>Klaviyo aún no ha dado resultados de este envío. Llegan en la siguiente sincronización.</p>
      )}
      {links && links.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold">Dónde hicieron clic</p>
          <div className={s.links}>
            {links.map((link) => (
              <div key={link.url} className={s.link}>
                <span className={s.linkUrl} title={link.url}>
                  {link.url.replace(/^https?:\/\//, "")}
                </span>
                <span className={s.num}>
                  {int(link.clicks)} <span className={s.muted}>· {int(link.people)} personas</span>
                </span>
                <span className={s.track}>
                  <i style={{ width: `${Math.round((100 * link.clicks) / max)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
