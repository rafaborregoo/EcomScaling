"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { int, type KWorkspace } from "../klaviyo-workspace";
import { cx } from "./campaign-format";
import type { CampaignsNav } from "./campanas-nav";
import { Btn, Chip, Hero, Panel, ScopeBar, Seg, Stage, css as s } from "./campanas-parts";
import {
  BAR_LIMIT,
  ICONS,
  Icon,
  VISIBILITY,
  describe,
  dowName,
  iconPath,
  removeQuickAction,
  reorderQuickActions,
  saveQuickAction,
  scopeOf,
  toneOf,
  useQuickActions,
  type QuickAction,
  type QuickActionDraft,
} from "./quick-actions";

/**
 * Gestor de acciones rápidas: lista ordenable, filtro por visibilidad y
 * formulario con vista previa de cómo queda el atajo en Campañas.
 * Solo lo abre el consultor; las 8 primeras salen en la barra.
 */

const BLANK: QuickActionDraft = {
  id: null,
  visibility: "me",
  name: "",
  icon: "mail",
  kind: "plan",
  channel: "email",
  audience: "Suscriptores activos",
  when_kind: "off",
  dow: 4,
  offset_days: 7,
  brief: "",
};

const FALLBACK_AUDIENCES = ["Suscriptores activos", "Clientes VIP", "No abrieron el último envío", "Sin compra en 90 días", "Visitantes de 14 días"];

const toDraft = ({ id, visibility, name, icon, kind, channel, audience, when_kind, dow, offset_days, brief }: QuickAction): QuickActionDraft => ({
  id, visibility, name, icon, kind, channel, audience, when_kind, dow, offset_days, brief,
});

type Scope = "all" | QuickAction["visibility"];

export function QuickActionsManager({
  organizationId,
  organizationName,
  workspace,
  nav,
}: {
  organizationId: string;
  organizationName: string;
  workspace: KWorkspace | undefined;
  nav: CampaignsNav;
}) {
  const { actions, isLoading, error } = useQuickActions(organizationId);
  const [scope, setScope] = useState<Scope>("all");
  const [draft, setDraft] = useState<QuickActionDraft | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audiences = [
    ...new Set([
      ...(workspace?.audiences?.lists ?? []).map((entry) => entry.name),
      ...(workspace?.audiences?.segments ?? []).map((entry) => entry.name),
      ...FALLBACK_AUDIENCES,
      ...(draft?.audience ? [draft.audience] : []),
    ]),
  ];
  const count = (key: Scope) => actions.filter((action) => key === "all" || action.visibility === key).length;
  const shown = actions.filter((action) => scope === "all" || action.visibility === scope);
  const barCount = Math.min(BAR_LIMIT, actions.length);
  const patch = (changes: Partial<QuickActionDraft>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
    setFormError(null);
  };

  async function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setFormError("Ponle un nombre para guardarla.");
    if (actions.some((action) => action.id !== draft.id && action.name.toLowerCase() === name.toLowerCase())) {
      return setFormError("Ya tienes una acción con ese nombre.");
    }
    setBusy(true);
    const result = await saveQuickAction(organizationId, { ...draft, name });
    setBusy(false);
    if (!result.ok) return setFormError(result.error);
    setDraft(toDraft(result.data));
    toast.success(`Guardada «${name}». Ya aparece en la barra de Campañas.`);
  }

  async function remove(action: QuickAction) {
    const result = await removeQuickAction(organizationId, action.id);
    setConfirming(null);
    if (!result.ok) return toast.danger(result.error);
    if (draft?.id === action.id) setDraft(null);
    toast.success(`Eliminada «${action.name}».`);
  }

  async function duplicate(action: QuickAction) {
    const result = await saveQuickAction(organizationId, {
      ...toDraft(action),
      id: null,
      name: `${action.name} (copia)`.slice(0, 32),
    });
    if (!result.ok) return toast.danger(result.error);
    setDraft(toDraft(result.data));
    toast.success(`Duplicada «${action.name}». Edita la copia y guárdala.`);
  }

  async function move(action: QuickAction, direction: -1 | 1) {
    const ids = shown.map((entry) => entry.id);
    const at = ids.indexOf(action.id);
    const other = ids[at + direction];
    if (!other) return;
    // El orden de la barra es el de la lista completa: se intercambian los dos y se guarda entera.
    const all = actions.map((entry) => entry.id);
    const i = all.indexOf(action.id);
    const j = all.indexOf(other);
    [all[i], all[j]] = [all[j]!, all[i]!];
    const result = await reorderQuickActions(organizationId, all);
    if (!result.ok) toast.danger(result.error);
  }

  const preview = draft ?? BLANK;
  const previewScope = scopeOf(preview.visibility);
  const isNew = draft !== null && draft.id === null;

  return (
    <Stage>
      <ScopeBar
        right={
          <Btn variant="ghost" size="sm" onClick={nav.closeQuickActions}>
            Volver a Campañas
          </Btn>
        }
      />
      <Hero
        id="h-qa"
        meta={["Marketing · Campañas", "Acciones rápidas", organizationName]}
        title={`${actions.length} ${actions.length === 1 ? "acción rápida" : "acciones rápidas"}: ${count("shared")} compartidas con el cliente, ${count("me")} tuyas y ${count("client")} solo de este cliente.`}
        lines={["Cada pulsación ahorra montar la campaña desde cero. Edita lo que ya no uses: una barra con demasiadas acciones deja de ser rápida."]}
        actions={
          <>
            <Btn variant="acc" onClick={() => setDraft({ ...BLANK })}>
              Nueva acción
            </Btn>
            <Btn variant="ghost" onClick={nav.closeQuickActions}>
              Ver cómo quedan en Campañas
            </Btn>
          </>
        }
        side={
          <div className={s.nextBox}>
            <h3>Quién ve cada acción</h3>
            <p><strong>Mía</strong> · solo tú, en todos tus clientes.</p>
            <p><strong>Este cliente</strong> · tú y tu equipo, solo en {organizationName}.</p>
            <p><strong>Compartida</strong> · además {organizationName} la ve como atajo y, al usarla, te llega el encargo.</p>
          </div>
        }
      />

      <div className={s.mgr}>
        <Panel
          title="Tus acciones"
          sub={`Las ${BAR_LIMIT} primeras salen en la barra de Campañas, por este orden.`}
          aside={
            <span className={s.limit}>
              <i><b style={{ width: `${Math.round((barCount / BAR_LIMIT) * 100)}%` }} /></i>
              {barCount} de {BAR_LIMIT} en la barra
            </span>
          }
        >
          <div className={s.scopeTabs}>
            <Seg
              label="Filtrar por visibilidad"
              value={scope}
              onChange={setScope}
              options={[
                { key: "all", label: "Todas", count: count("all") },
                { key: "me", label: "Mías", count: count("me") },
                { key: "client", label: "Este cliente", count: count("client") },
                { key: "shared", label: "Compartidas", count: count("shared") },
              ]}
            />
          </div>
          {error ? <p className={s.neg}>{error}</p> : null}
          <div className={s.al}>
            {shown.map((action, index) => {
              const entry = scopeOf(action.visibility);
              const position = actions.findIndex((candidate) => candidate.id === action.id);
              return (
                <div key={action.id}>
                  <div className={cx(s.alR, draft?.id === action.id && s.sel2)}>
                    <span className={s.alOrd}>
                      <button type="button" aria-label={`Subir ${action.name}`} disabled={index === 0} onClick={() => void move(action, -1)}>
                        <Icon path="M6 15l6-6 6 6" size={12} />
                      </button>
                      <button type="button" aria-label={`Bajar ${action.name}`} disabled={index === shown.length - 1} onClick={() => void move(action, 1)}>
                        <Icon path="M6 9l6 6 6-6" size={12} />
                      </button>
                    </span>
                    <span className={cx(s.qaIc, toneOf(action))} style={{ width: 34, height: 34 }}>
                      <Icon path={iconPath(action.icon)} />
                    </span>
                    <button type="button" className={s.alMain} onClick={() => { setDraft(toDraft(action)); setFormError(null); setConfirming(null); }}>
                      <b>{action.name}</b>
                      <span>{describe(action)}</span>
                    </button>
                    <span className={s.alAct}>
                      <Chip tone={entry.tone}>{entry.scope}</Chip>
                      {position >= BAR_LIMIT ? <Chip tone="warn">Fuera de la barra</Chip> : null}
                      <Btn size="sm" variant="ghost" icon aria-label={`Duplicar ${action.name}`} onClick={() => void duplicate(action)}>
                        <Icon path="M8 8h12v12H8z M4 16V4h12" />
                      </Btn>
                      <Btn size="sm" variant="danger" icon aria-label={`Eliminar ${action.name}`} onClick={() => setConfirming(action.id)}>
                        <Icon path="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13" />
                      </Btn>
                    </span>
                  </div>
                  {confirming === action.id ? (
                    <div className={s.confirm} role="alert">
                      <span>¿Eliminar «{action.name}»? Las campañas que ya creó se quedan en el calendario.</span>
                      <Btn size="sm" variant="dangerSolid" onClick={() => void remove(action)}>
                        Eliminar
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                        Cancelar
                      </Btn>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!isLoading && shown.length === 0 ? (
            <div className={s.emptyBox}>
              <b>{scope === "all" ? "Todavía no tienes acciones rápidas" : "Nada en este filtro"}</b>
              <span>{scope === "all" ? "Crea la primera con una campaña que repites cada semana." : "Cambia de filtro o crea una acción con esta visibilidad."}</span>
              <Btn variant="acc" onClick={() => setDraft({ ...BLANK, visibility: scope === "all" ? "me" : scope })}>
                Crear la primera
              </Btn>
            </div>
          ) : null}
        </Panel>

        <Panel>
          {!draft ? (
            <div className={s.emptyBox}>
              <b>Elige una acción para editarla</b>
              <span>O crea una nueva: guarda una campaña que repites y, la próxima vez, será un clic.</span>
              <Btn variant="acc" onClick={() => setDraft({ ...BLANK })}>
                Nueva acción
              </Btn>
            </div>
          ) : (
            <>
              <div className={s.panelH}>
                <div>
                  <h3>{isNew ? "Nueva acción rápida" : "Editar acción rápida"}</h3>
                  <p className={s.sub}>{isNew ? "Se añade al final de la barra." : "Los cambios se aplican en Campañas al guardar."}</p>
                </div>
              </div>
              <div className={s.form}>
                <div className={s.preview}>
                  <small>Así se verá en Campañas</small>
                  <div className={s.qaTile}>
                    <span className={cx(s.qaIc, toneOf(preview))}><Icon path={iconPath(preview.icon)} /></span>
                    <span className={s.qaT}>{preview.name || "Sin nombre"}</span>
                    <span className={s.qaD}>{describe(preview)}</span>
                    <span className={s.qaF}><Chip tone={previewScope.tone}>{previewScope.scope}</Chip><span>Sin usar todavía</span></span>
                  </div>
                </div>

                <div className={s.fld}>
                  <label htmlFor="qa-name">Nombre</label>
                  <input id="qa-name" type="text" maxLength={32} value={draft.name} placeholder="Ej. Newsletter semanal" onChange={(event) => patch({ name: event.target.value })} />
                  <small>{32 - draft.name.length} caracteres libres</small>
                  {formError ? <small className={s.neg} role="alert">{formError}</small> : null}
                </div>

                <div className={s.fld}>
                  <span className={s.lbl}>Icono</span>
                  <div className={s.opts}>
                    {ICONS.map((icon) => (
                      <button key={icon.key} type="button" className={cx(s.opt, s.ic2)} aria-pressed={draft.icon === icon.key} aria-label={icon.label} onClick={() => patch({ icon: icon.key })}>
                        <Icon path={icon.path} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className={s.fld}>
                  <span className={s.lbl}>Qué hace al pulsarla</span>
                  <div className={s.opts}>
                    {([["plan", "Planificar en el calendario"], ["ia", "Escribir con IA"]] as const).map(([key, label]) => (
                      <button key={key} type="button" className={s.opt} aria-pressed={draft.kind === key} onClick={() => patch({ kind: key })}>{label}</button>
                    ))}
                  </div>
                  <small>
                    {draft.kind === "plan"
                      ? "Crea la campaña en el calendario con su fecha, canal y audiencia. La pieza se escribe después."
                      : "Crea la campaña en el calendario y abre Crear con el brief ya puesto para que la IA escriba la pieza."}
                  </small>
                </div>

                <div className={s.row2}>
                  <div className={s.fld}>
                    <span className={s.lbl}>Canal</span>
                    <div className={s.opts}>
                      {([["email", "Email"], ["meta", "Meta Ads"]] as const).map(([key, label]) => (
                        <button key={key} type="button" className={s.opt} aria-pressed={draft.channel === key} onClick={() => patch({ channel: key })}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className={s.fld}>
                    <label htmlFor="qa-aud">Audiencia</label>
                    <select id="qa-aud" value={draft.audience} onChange={(event) => patch({ audience: event.target.value })}>
                      {audiences.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={s.row2}>
                  <div className={s.fld}>
                    <span className={s.lbl}>Cuándo se planifica</span>
                    <div className={s.opts}>
                      {([["dow", "Un día de la semana"], ["off", "En N días"]] as const).map(([key, label]) => (
                        <button key={key} type="button" className={s.opt} aria-pressed={draft.when_kind === key} onClick={() => patch({ when_kind: key })}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className={s.fld}>
                    {draft.when_kind === "dow" ? (
                      <>
                        <label htmlFor="qa-dow">Día de la semana</label>
                        <select id="qa-dow" value={draft.dow} onChange={(event) => patch({ dow: Number(event.target.value) })}>
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                            <option key={day} value={day}>{dowName(day).replace(/^./, (c) => c.toUpperCase())}</option>
                          ))}
                        </select>
                        <small>El primer {dowName(draft.dow)} sin una igual en el calendario.</small>
                      </>
                    ) : (
                      <>
                        <label htmlFor="qa-off">Días desde hoy</label>
                        <input id="qa-off" type="number" min={0} max={120} value={draft.offset_days} onChange={(event) => patch({ offset_days: Math.max(0, Math.min(120, Number(event.target.value) || 0)) })} />
                        <small>0 = hoy. Máximo 120 días.</small>
                      </>
                    )}
                  </div>
                </div>

                <div className={s.fld}>
                  <label htmlFor="qa-brief">Brief para la IA</label>
                  <textarea id="qa-brief" value={draft.brief} maxLength={2000} placeholder="Qué se cuenta, con qué tono y qué producto empujar. Se pasa al generador al escribir la pieza." onChange={(event) => patch({ brief: event.target.value })} />
                </div>

                <div className={s.fld}>
                  <span className={s.lbl}>Quién la ve</span>
                  <div className={s.vis}>
                    {VISIBILITY.map((option) => (
                      <button key={option.key} type="button" className={s.visO} aria-pressed={draft.visibility === option.key} onClick={() => patch({ visibility: option.key })}>
                        <i /><b>{option.label}</b><span>{option.text.replace("este cliente", organizationName).replace("El cliente", organizationName)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={s.formF}>
                  <span className={s.alAct}>
                    <Btn variant="acc" disabled={busy} onClick={() => void save()}>{isNew ? "Crear acción" : "Guardar cambios"}</Btn>
                    <Btn variant="ghost" onClick={() => { setDraft(null); setFormError(null); }}>Cancelar</Btn>
                  </span>
                  {!isNew ? (
                    <Btn variant="danger" onClick={() => setConfirming(draft.id)}>Eliminar esta acción</Btn>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
      <p className={s.foot}>{int(actions.length)} en total · {organizationName}</p>
    </Stage>
  );
}
