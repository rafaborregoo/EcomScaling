"use client";

import { useState } from "react";
import { Select, Checkbox, toast } from "@/components/ui";
import { postThreadNote, resolveThreadNote, TARGET_LABEL, type NoteTarget, type ThreadNote } from "./campaign-api";
import { cx } from "./campaign-format";
import { Btn, Chip, IaTag, Panel, Seg, css as s } from "./campanas-parts";

/**
 * El hilo de revisión de una campaña: notas, correcciones sobre un apartado y
 * líneas de sistema. El consultor puede dejar notas internas (el cliente no las
 * ve ni recibe aviso) y correcciones; el cliente deja notas visibles y marca
 * como hechos los cambios que se le piden.
 */

const TARGETS = Object.keys(TARGET_LABEL) as NoteTarget[];

function when(value: string) {
  return new Date(value).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ThreadPanel({
  organizationId,
  itemId,
  notes,
  openCorrections,
  viewer,
  viewerUserId,
  hasConsultant,
  canCompose,
  subtitle,
  title,
  onChanged,
  onFixByHand,
  onFixWithAi,
}: {
  organizationId: string;
  itemId: string;
  notes: ThreadNote[];
  openCorrections: number;
  viewer: "consultant" | "client";
  viewerUserId: string;
  hasConsultant: boolean;
  canCompose: boolean;
  title: string;
  subtitle: string;
  onChanged: () => void;
  onFixByHand: (target: NoteTarget | null) => void;
  onFixWithAi: (note: ThreadNote) => void;
}) {
  const staff = viewer === "consultant";
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"note" | "correction">("note");
  const [target, setTarget] = useState<NoteTarget>("subject");
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const messages = notes.filter((note) => note.kind !== "ai_proposal");

  function who(note: ThreadNote) {
    if (note.kind === "system" || note.author_kind === "system") return "Sistema";
    if (note.author_kind === "ai") return staff ? "IA · A05" : "Tu asistente";
    const mine = note.author_user_id === viewerUserId;
    if (note.author_kind === "client") return mine ? "Tú" : staff ? `${note.author_name ?? "Cliente"} · cliente` : (note.author_name ?? "Tu equipo");
    return mine ? "Tú · consultor" : staff ? (note.author_name ?? "Consultor") : "Tu consultor";
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const result = await postThreadNote(organizationId, itemId, {
      body,
      kind: staff ? kind : "note",
      target: staff && kind === "correction" ? target : null,
      visibleToClient: staff ? visible : true,
    });
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setText("");
    toast.success(!staff ? "Mensaje enviado. Tu consultor recibe un aviso." : visible ? "Mensaje enviado. El cliente recibe un aviso." : "Nota interna guardada.");
    onChanged();
  }

  async function resolve(note: ThreadNote) {
    const result = await resolveThreadNote(organizationId, itemId, note.id);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    onChanged();
  }

  return (
    <Panel title={title} sub={subtitle}>
      <div className={s.thr}>
        {messages.length === 0 ? <p className={s.mut}>Todavía no hay mensajes en esta campaña.</p> : null}
        {messages.map((note) => {
          const system = note.kind === "system";
          const mine = note.author_user_id === viewerUserId && !system;
          const open = note.kind === "correction" && !note.resolution;
          return (
            <div key={`${note.source}-${note.id}`} className={cx(s.msg, system && s.sys, !system && note.author_kind === "ai" && s.ai, mine && s.me)}>
              <div className={s.msgH}>
                <b>{who(note)}</b>
                <span>{when(note.created_at)}</span>
                {note.target ? <span className={s.tgt}>{TARGET_LABEL[note.target]}</span> : null}
                {note.kind === "correction" ? <Chip tone={open ? "warn" : "good"}>{open ? "Pendiente" : staff ? "Resuelta" : "Hecha"}</Chip> : null}
                {staff && !note.visible_to_client ? <Chip>Solo tú</Chip> : null}
              </div>
              <p>{note.body}</p>
              {open ? (
                <div className={s.msgA}>
                  {staff ? (
                    <Btn size="sm" variant="ghost" onClick={() => onFixByHand(note.target)}>
                      Corregir a mano
                    </Btn>
                  ) : null}
                  <Btn size="sm" onClick={() => onFixWithAi(note)}>
                    <IaTag />
                    {staff ? "Que la IA lo aplique" : "Que la IA lo cambie"}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => void resolve(note)}>
                    {staff ? "Marcar resuelta" : "Ya lo he cambiado"}
                  </Btn>
                </div>
              ) : null}
            </div>
          );
        })}
        {openCorrections === 0 && messages.some((note) => note.kind === "correction") ? <p className={s.foot}>No quedan correcciones sin resolver.</p> : null}
      </div>
      {canCompose ? (
        <div className={s.composer}>
          <textarea
            aria-label={staff ? "Escribir en el hilo" : "Escribir a tu consultor"}
            placeholder={staff ? "Escribe una nota o una corrección…" : "Escríbele a tu consultor sobre esta campaña…"}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {staff ? (
            <div className={s.cRow}>
              <Seg
                label="Tipo de mensaje"
                value={kind}
                onChange={setKind}
                options={[
                  { key: "note", label: "Nota" },
                  { key: "correction", label: "Corrección" },
                ]}
              />
              {kind === "correction" ? (
                <Select
                  aria-label="A qué parte se refiere"
                  size="sm"
                  className="w-auto"
                  value={target}
                  onChange={(value) => setTarget(value as NoteTarget)}
                  options={TARGETS.map((key) => ({ value: key, label: TARGET_LABEL[key] }))}
                />
              ) : null}
            </div>
          ) : null}
          <div className={s.cRow}>
            {staff ? (
              <Checkbox checked={visible} onCheckedChange={setVisible}>Visible para el cliente</Checkbox>
            ) : (
              <span className={s.foot}>Tu consultor recibe un aviso.</span>
            )}
            <Btn disabled={busy || !text.trim()} onClick={() => void send()}>
              {staff ? (visible ? "Enviar al cliente" : "Guardar nota interna") : "Enviar"}
            </Btn>
          </div>
          {staff ? <p className={s.foot}>{visible ? "El cliente recibe un aviso con tu mensaje." : "Nota interna: el cliente no la ve ni recibe aviso."}</p> : null}
        </div>
      ) : !hasConsultant && !staff ? (
        <p className={s.foot} style={{ marginTop: 12 }}>
          Aquí queda el historial de lo que se ha hecho en esta campaña.
        </p>
      ) : null}
    </Panel>
  );
}
