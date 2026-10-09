"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { getMetaDestinationUrl } from "../meta-ad-plan";
import {
  applyAiEdit,
  patchDraft,
  proposeAiEdit,
  type EditField,
  type ProposedEdit,
  type ThreadNote,
} from "./campaign-api";
import { cx, dateTimeLabel, emailLinks, plainText } from "./campaign-format";
import { Btn, Chip, IaTag, Panel, css as s } from "./campanas-parts";

/**
 * La pieza de una campaña: cómo se ve, qué le falta, edición a mano y edición
 * con IA. La IA propone cambios campo a campo y no escribe nada: una persona
 * los aplica o los descarta. Cada cambio aplicado guarda una versión de la pieza
 * y la devuelve a aprobación (lo hace la misma ruta que el editor de siempre).
 */

const PRESETS = {
  email: [
    { label: "Acorta el asunto", text: "Acorta el asunto para que quepa en el móvil (unos 40-50 caracteres) sin perder la idea." },
    { label: "Más urgencia", text: "Dale más urgencia al asunto y al preheader sin que suene a spam." },
    { label: "Ajusta el tono a la marca", text: "Ajusta el texto al tono de la marca del cliente." },
  ],
  meta: [
    { label: "Titular más corto", text: "Acorta el titular del anuncio para que no se corte en el feed." },
    { label: "Texto más directo", text: "Haz el texto principal más directo: primero lo que se compra y después el plazo." },
  ],
};

const fieldValue = (field: EditField, value: string) => {
  if (field === "body") return plainText(value);
  if (field === "starts_at") return dateTimeLabel(value);
  return value || "(vacío)";
};

export type AiEdit = {
  busy: boolean;
  answer: string | null;
  propose: (instruction: string) => Promise<void>;
};

/** Pide una propuesta a la IA sobre una campaña. Las propuestas llegan por el hilo (onChanged lo recarga). */
export function useAiEdit(organizationId: string, itemId: string, onChanged: () => void): AiEdit {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  async function propose(text: string) {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setAnswer(null);
    const result = await proposeAiEdit(organizationId, itemId, value);
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setAnswer(result.data.edits.length ? null : result.data.answer);
    onChanged();
  }
  return { busy, answer, propose };
}

export function PieceEditor({
  organizationId,
  itemId,
  draft,
  meta,
  canEdit,
  viewer,
  corrections,
  proposals,
  manualOpen,
  onManualOpen,
  onOpenStudio,
  onChanged,
  ai,
}: {
  organizationId: string;
  itemId: string;
  draft: MarketingDraft;
  meta: boolean;
  canEdit: boolean;
  viewer: "consultant" | "client";
  corrections: ThreadNote[];
  proposals: ThreadNote[];
  manualOpen: boolean;
  onManualOpen: (open: boolean) => void;
  onOpenStudio: (draft: MarketingDraft) => void;
  onChanged: () => void;
  /** La edición con IA vive fuera para poder lanzarla también desde una corrección del hilo. */
  ai: AiEdit;
}) {
  const staff = viewer === "consultant";
  const links = emailLinks(draft.html);
  const destination = meta ? getMetaDestinationUrl(draft) : null;
  const subjectLength = draft.subject.length;

  const checks: Array<{ text: string; tone: "good" | "warn" | "bad" }> = meta
    ? [
        { text: `Titular ${subjectLength} caracteres`, tone: subjectLength <= 40 ? "good" : "warn" },
        { text: destination ? "Enlace de destino" : "Sin enlace de destino", tone: destination ? "good" : "bad" },
      ]
    : [
        { text: `Asunto ${subjectLength} caracteres`, tone: subjectLength <= 60 ? "good" : "warn" },
        { text: links.length ? `${links.length} ${links.length === 1 ? "enlace" : "enlaces"} con destino` : "Sin enlace de destino", tone: links.length ? "good" : "bad" },
        { text: draft.preheader ? "Preheader puesto" : "Falta preheader", tone: draft.preheader ? "good" : "warn" },
      ];

  // --- edición a mano
  const [form, setForm] = useState(() => ({
    subject: draft.subject,
    preheader: draft.preheader,
    primary: draft.plain_text,
    destination: destination ?? "",
  }));
  const [saving, setSaving] = useState(false);
  async function saveManual() {
    setSaving(true);
    const result = await patchDraft(
      organizationId,
      draft.id,
      meta
        ? { headline: form.subject, description: form.preheader, primary_text: form.primary, destination_url: form.destination.trim() || null }
        : { subject: form.subject, preheader: form.preheader },
    );
    setSaving(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    toast.success("Versión guardada: la pieza vuelve a revisión");
    onManualOpen(false);
    onChanged();
  }

  // --- IA
  const [instruction, setInstruction] = useState("");
  const { busy, answer, propose } = ai;

  async function decide(note: ThreadNote, fields: EditField[], dismiss: boolean) {
    const result = await applyAiEdit(organizationId, itemId, note.id, { fields, dismiss });
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    toast.success(dismiss ? "Cambio descartado" : "Cambio aplicado: versión nueva y la pieza vuelve a revisión");
    onChanged();
  }

  const openProposals = proposals
    .map((note) => ({ note, edits: note.payload?.edits ?? [] }))
    .filter((entry) => entry.edits.some((edit) => edit.state === "open"))
    .slice(-2);

  const presets = [...(meta ? PRESETS.meta : PRESETS.email)];
  if (corrections.length) presets.unshift({ label: "Aplica lo pedido en el hilo", text: `Aplica las correcciones pendientes del hilo: ${corrections.map((note) => note.body).join(" | ")}` });

  return (
    <Panel>
      {meta ? (
        <div className={s.eml}>
          <div className={s.emlH}>
            <span>Meta Ads · Instagram · Feed</span>
            <strong>{draft.subject || "(sin titular)"}</strong>
            <span>{draft.preheader}</span>
          </div>
          <div className={s.emlB}>
            <p>{draft.plain_text || "(sin texto principal)"}</p>
            <span className={s.cta}>Más información</span>
            {destination ? <span className={s.foot}>{destination}</span> : null}
          </div>
        </div>
      ) : draft.html ? (
        <div className={s.eml}>
          <div className={s.emlH}>
            <span>De: {draft.from_name || "—"}</span>
            <strong>{draft.subject || "(sin asunto)"}</strong>
            <span>{draft.preheader}</span>
          </div>
          {/* sandbox vacío: el HTML del email no ejecuta nada ni navega. */}
          <iframe title={`Vista previa de ${draft.subject}`} className={s.iframe} sandbox="" srcDoc={draft.html} loading="lazy" />
        </div>
      ) : (
        <p className={s.empty}>Esta pieza todavía no tiene contenido.</p>
      )}

      <div className={s.legend} style={{ marginTop: 14 }}>
        <span>Comprobaciones:</span>
        {checks.map((check) => (
          <Chip key={check.text} tone={check.tone}>
            {check.text}
          </Chip>
        ))}
      </div>

      {canEdit ? (
        <>
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <div className={s.cRow}>
              <b style={{ fontSize: 14 }}>Editar a mano</b>
              <span className={s.alAct}>
                {!meta ? (
                  <Btn size="sm" variant="ghost" onClick={() => onOpenStudio(draft)}>
                    Editar el diseño en el estudio
                  </Btn>
                ) : null}
                <Btn size="sm" variant="ghost" onClick={() => onManualOpen(!manualOpen)}>
                  {manualOpen ? "Cerrar edición" : "Abrir edición"}
                </Btn>
              </span>
            </div>
            {manualOpen ? (
              <div className={s.form}>
                <div className={cx(s.fld, s.inline)}>
                  <label htmlFor="pe-subject">{meta ? "Titular del anuncio" : "Asunto"}</label>
                  <input id="pe-subject" type="text" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
                </div>
                <div className={cx(s.fld, s.inline)}>
                  <label htmlFor="pe-pre">{meta ? "Descripción" : "Preheader"}</label>
                  <input id="pe-pre" type="text" value={form.preheader} onChange={(event) => setForm({ ...form, preheader: event.target.value })} />
                </div>
                {meta ? (
                  <>
                    <div className={cx(s.fld, s.inline)}>
                      <label htmlFor="pe-primary">Texto principal</label>
                      <textarea id="pe-primary" value={form.primary} onChange={(event) => setForm({ ...form, primary: event.target.value })} />
                    </div>
                    <div className={cx(s.fld, s.inline)}>
                      <label htmlFor="pe-url">Enlace de destino</label>
                      <input id="pe-url" type="text" placeholder="https://" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} />
                    </div>
                  </>
                ) : null}
                <div className={s.cRow}>
                  <span className={s.foot}>Guardar crea una versión nueva y la pieza vuelve a revisión.</span>
                  <Btn disabled={saving} onClick={() => void saveManual()}>
                    Guardar versión
                  </Btn>
                </div>
              </div>
            ) : null}
          </div>

          <div className={s.aiBox} style={{ marginTop: 18 }}>
            <div className={s.cRow}>
              <b style={{ fontSize: 14 }}>
                <span className={s.ia} style={{ marginRight: 8 }}>
                  IA
                </span>
                {staff ? "Editar con IA · A05" : "Pedir ayuda a la IA"}
              </b>
              <span className={s.foot}>Propone cambios; no escribe nada hasta que los aplicas.</span>
            </div>
            <div className={s.prs}>
              {presets.map((preset) => (
                <button key={preset.label} type="button" className={s.pr} disabled={busy} onClick={() => void propose(preset.text)}>
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              aria-label="Qué quieres cambiar"
              placeholder="O cuéntale qué cambiar: «hazlo más sereno», «que el botón lleve a la cesta»…"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <div className={s.cRow}>
              <span className={s.foot}>{busy ? "La IA está leyendo la campaña…" : answer ?? "Hasta 10 propuestas por campaña y día."}</span>
              <Btn variant="acc" disabled={busy || !instruction.trim()} onClick={() => {
                  void propose(instruction);
                  setInstruction("");
                }}>
                <IaTag />
                Proponer cambios
              </Btn>
            </div>
            {openProposals.length ? (
              <div className={s.diffs}>
                {openProposals.map(({ note, edits }) => (
                  <ProposalCards key={note.id} note={note} edits={edits} onDecide={(fields, dismiss) => void decide(note, fields, dismiss)} />
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className={s.foot} style={{ marginTop: 14 }}>
          Esta pieza la lleva tu consultor. Si quieres un cambio, escríbele en el hilo.
        </p>
      )}
    </Panel>
  );
}

function ProposalCards({
  note,
  edits,
  onDecide,
}: {
  note: ThreadNote;
  edits: ProposedEdit[];
  onDecide: (fields: EditField[], dismiss: boolean) => void;
}) {
  const open = edits.filter((edit) => edit.state === "open");
  return (
    <>
      {edits.map((edit) => (
        <div key={edit.field} className={cx(s.diff, edit.state !== "open" && s.done)}>
          <div className={s.diffH}>
            <b>{edit.label}</b>
            <span className={s.alAct}>
              {edit.state === "open" ? (
                <>
                  <Btn size="sm" onClick={() => onDecide([edit.field], false)}>
                    Aplicar
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => onDecide([edit.field], true)}>
                    Descartar
                  </Btn>
                </>
              ) : (
                <Chip>{edit.state === "applied" ? "Aplicado" : "Descartado"}</Chip>
              )}
            </span>
          </div>
          <div className={s.was}>{fieldValue(edit.field, edit.was)}</div>
          <div className={s.now}>{fieldValue(edit.field, edit.now)}</div>
          <p className={s.why}>{edit.why}</p>
        </div>
      ))}
      <div className={s.cRow}>
        <span className={s.foot}>{open.length ? `${open.length} por decidir` : note.resolution ? "Todo decidido" : ""}</span>
        {open.length > 1 ? (
          <Btn size="sm" onClick={() => onDecide(open.map((edit) => edit.field), false)}>
            Aplicar todo
          </Btn>
        ) : null}
      </div>
    </>
  );
}
