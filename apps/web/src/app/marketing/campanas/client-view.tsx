"use client";

import { useState } from "react";
import Link from "next/link";
import { buildClientViewCampaignsHeadline, needsClientApproval } from "@e-nora/contracts";
import { formatMoney } from "@/lib/money";
import { toast } from "@/components/ui";
import { useCopilotAsk } from "@/components/copilot-ask";
import { UPCOMING, type CampaignRow } from "../campaign-rows";
import { int, pct, ratio, type KWorkspace } from "../klaviyo-workspace";
import { createClientCampaign, decideDraft, submitDraft } from "./campaign-api";
import { clientState, cx, dateTimeLabel, dayParts, isMetaChannel, plainText, rowToBrief } from "./campaign-format";
import type { CampaignsNav } from "./campanas-nav";
import { Banner, Btn, Chip, Hero, Kpis, Panel, Section, Seg, Stage, css as s } from "./campanas-parts";
import { QuickActionsBar } from "./quick-actions";

/**
 * Campañas del CLIENTE, con su propia paleta (petróleo y azafrán) y su propia voz.
 *
 * Con consultor: lo que su consultor le prepara llega aquí para que lo
 * apruebe, y lo que crea él le llega al consultor para que lo revise. Sin
 * consultor se gobierna solo: su asistente escribe y él aprueba y programa. El
 * cliente no ve estados internos («Plan IA», «Sin pieza»): ve lo que le toca.
 */

const DAY_MS = 86_400_000;
type Filter = "next" | "sent" | "all";

export function ClientView({
  rows,
  organizationId,
  organizationName,
  hasConsultant,
  workspace,
  nav,
  onChanged,
  onWriteWithAi,
  onPropose,
}: {
  rows: CampaignRow[];
  organizationId: string;
  organizationName: string;
  hasConsultant: boolean;
  workspace: KWorkspace | undefined;
  nav: CampaignsNav;
  onChanged: () => void;
  onWriteWithAi: (itemId: string) => void;
  onPropose: () => void;
}) {
  const askCopilot = useCopilotAsk();
  const [nowMs] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("next");
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const currency = workspace?.account?.currency ?? "EUR";

  const own = rows.filter((row) => row.source !== "proposal");
  const isOwn = (row: CampaignRow) => row.item?.origin === "client";
  const needsApproval = (row: CampaignRow) => needsClientApproval(rowToBrief(row), hasConsultant);
  const pending = own.filter((row) => needsApproval(row) && Boolean(row.draft));
  const week = own.filter((row) => UPCOMING.includes(row.state) && row.state !== "late" && row.date && Date.parse(row.date) >= nowMs - DAY_MS && Date.parse(row.date) - nowMs <= 7 * DAY_MS);
  const underReview = own.filter((row) => isOwn(row) && row.item?.review_status === "pending");
  const late = own.find((row) => row.state === "late") ?? null;
  const mine = own.filter(isOwn);
  const sent = own.filter((row) => row.state === "sent").sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""));
  const sent30 = sent.filter((row) => row.date && nowMs - Date.parse(row.date) <= 30 * DAY_MS && row.stats?.delivered);
  const best = [...sent30].sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0))[0];
  const delivered = sent30.reduce((sum, row) => sum + (row.stats?.delivered ?? 0), 0);
  const opens = sent30.reduce((sum, row) => sum + (row.stats?.opens_unique ?? 0), 0);
  const clicks = sent30.reduce((sum, row) => sum + (row.stats?.clicks_unique ?? 0), 0);
  const revenue = sent30.reduce((sum, row) => sum + (row.stats?.revenue ?? 0), 0);

  const headline = buildClientViewCampaignsHeadline({
    clientHasConsultant: hasConsultant,
    weekCount: week.length,
    pendingApproval: pending.map(rowToBrief),
    ownUnderReview: underReview.map(rowToBrief),
    late: late ? rowToBrief(late) : null,
  });

  const preparing = own.find((row) => row.state === "nopiece" && !isOwn(row) && row.date && Date.parse(row.date) >= nowMs - DAY_MS);

  async function approve(row: CampaignRow) {
    if (!row.draft) return;
    setBusyKey(row.key);
    try {
      if (row.draft.status === "draft") {
        const submitted = await submitDraft(organizationId, row.draft.id);
        if (!submitted.ok) {
          toast.danger(submitted.error);
          return;
        }
      }
      const result = await decideDraft(organizationId, row.draft.id, "approved");
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setNote(
        hasConsultant
          ? `Aprobada «${row.name}». Tu consultor la programará y te avisará cuando salga.`
          : `Aprobada «${row.name}». Ya puedes programarla en Klaviyo desde su ficha.`,
      );
      onChanged();
    } finally {
      setBusyKey(null);
    }
  }

  const open = (row: CampaignRow) => {
    if (row.item) nav.campaign(organizationId, row.item.id);
  };

  const filtered = {
    next: own.filter((row) => row.state !== "sent"),
    sent,
    all: own,
  }[filter]
    .filter((row) => row.date)
    .sort((a, b) => (filter === "sent" ? Date.parse(b.date ?? "") - Date.parse(a.date ?? "") : Date.parse(a.date ?? "") - Date.parse(b.date ?? "")));

  const cards = [
    ...pending,
    ...own.filter((row) => ["ready", "scheduled"].includes(row.state) && Boolean(row.draft) && row.date && Date.parse(row.date) >= nowMs).slice(0, 2),
  ].filter((row, index, all) => all.findIndex((other) => other.key === row.key) === index);

  return (
    <Stage client>
      
      <Hero
        id="h-campanas-cliente"
        meta={["Marketing · Campañas", organizationName, new Date(nowMs).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })]}
        title={headline.title}
        lines={[
          headline.detail || null,
          best?.stats?.revenue ? `«${best.name}» es la que más ha traído este mes: ${formatMoney(best.stats.revenue, currency)} atribuidos por Klaviyo.` : null,
        ].filter(Boolean)}
        actions={
          <>
            <a className={cx(s.btn, s.acc)} href={pending.length ? "#aprobar" : "#prox"}>
              {pending.length ? "Revisar lo pendiente" : "Ver qué viene"}
            </a>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={() => setCreating(true)}>
              Crear una campaña
            </button>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={onPropose}>
              Planificar campañas con IA
            </button>
            {hasConsultant ? (
              <Link className={cx(s.btn, s.ghost)} href="/mensajes">
                Hablar con tu consultor
              </Link>
            ) : (
              <button
                type="button"
                className={cx(s.btn, s.ghost)}
                onClick={() => askCopilot({ question: "Ayúdame a planificar los próximos emails de mi tienda: qué enviar esta semana y por qué.", focusLabel: "Campañas" })}
              >
                Pedirle ayuda a tu asistente
              </button>
            )}
          </>
        }
        side={
          <div className={s.nextBox}>
            <h3>{hasConsultant ? "Tu consultor está en ello" : "Tu asistente de IA"}</h3>
            <p>
              {hasConsultant
                ? [
                    preparing ? `Está preparando «${preparing.name}», que sale el ${dayParts(preparing.date).day} de ${dayParts(preparing.date).mon}.` : null,
                    underReview[0] ? `Está revisando tu «${underReview[0].name}».` : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Ahora mismo no tiene nada pendiente contigo."
                : "Escribe el email, ajusta el asunto y lo programa en Klaviyo por ti. Tú decides si sale."}
            </p>
            <p>{hasConsultant ? "Te avisará aquí en cuanto haya algo para revisar." : "Si más adelante te asignan un consultor, verá lo que has creado y podrá revisarlo."}</p>
          </div>
        }
      />

      <Kpis
        label="Cifras de campañas"
        items={[
          { label: "Salen esta semana", value: week.length, foot: "emails, en los próximos 7 días" },
          { label: "Esperan tu visto bueno", value: pending.length, foot: pending.length ? "revísalos antes de que salgan" : "todo al día" },
          { label: "Enviadas · 30 días", value: sent30.length, foot: delivered ? `apertura media ${pct(ratio(opens, delivered))}` : "todavía sin envíos" },
          { label: "Ingresos atribuidos por Klaviyo", value: sent30.length ? formatMoney(revenue, currency) : "—", foot: sent30.length ? `de ${sent30.length === 1 ? "esa campaña" : `esas ${sent30.length} campañas`}` : "—" },
        ]}
      />

      {note ? <Banner onClose={() => setNote(null)}>{note}</Banner> : null}

      {creating ? (
        <CreateCampaign
          organizationId={organizationId}
          hasConsultant={hasConsultant}
          workspace={workspace}
          onClose={() => setCreating(false)}
          onCreated={(itemId, withAi, title) => {
            setCreating(false);
            onChanged();
            setNote(
              hasConsultant
                ? `Creada «${title}». Tu consultor recibe un aviso y la revisará; puedes seguir editándola.`
                : `Creada «${title}». ${withAi ? "Tu asistente prepara el primer borrador." : "Escribe el email cuando quieras."}`,
            );
            if (withAi) onWriteWithAi(itemId);
          }}
        />
      ) : null}

      <Section
        id="aprobar"
        title={hasConsultant ? "Para aprobar" : "Para aprobar y programar"}
        lead={
          hasConsultant
            ? "Tu consultor no programa nada sin tu visto bueno. Mira cómo lo recibirán tus clientes y dile si sale."
            : "Aprueba la pieza y prográmala en Klaviyo desde su ficha. Puedes pedirle otra versión a tu asistente."
        }
      >
        {cards.length === 0 ? (
          <Panel>
            <p className={s.empty}>No hay nada esperando tu visto bueno.</p>
          </Panel>
        ) : (
          <div className={s.apr}>
            {cards.map((row) => {
              const state = clientState(row, hasConsultant);
              const needs = needsApproval(row);
              const draft = row.draft;
              return (
                <div key={row.key} className={cx(s.card, !needs && s.done)}>
                  <div className={s.cardH}>
                    <div>
                      <b>{row.name}</b>
                      <span>{row.date ? `Sale el ${dateTimeLabel(row.date)}` : "Sin fecha de envío todavía"}</span>
                    </div>
                    <Chip tone={needs ? "warn" : "good"}>{needs ? "Espera tu visto bueno" : state.label}</Chip>
                  </div>
                  <div className={s.mail}>
                    <small>Asunto</small>
                    <strong>{draft?.subject || row.subject || "—"}</strong>
                    <p>{draft ? plainText(draft.plain_text || draft.html, 220) : ""}</p>
                  </div>
                  <div className={s.facts}>
                    <span>Para: {row.audiences.included.length ? row.audiences.included.map((audience) => audience.name).join(", ") : draft?.audience || "—"}</span>
                    {draft?.from_name ? <span>Enviado desde {draft.from_name}</span> : null}
                  </div>
                  <div className={s.cardF}>
                    {needs ? (
                      <>
                        <Btn variant="acc" disabled={busyKey === row.key} onClick={() => void approve(row)}>
                          {hasConsultant ? "Aprobar y que salga" : "Aprobar"}
                        </Btn>
                        <Btn variant="ghost" onClick={() => open(row)}>
                          {hasConsultant ? "Pedir cambios" : "Pedir otra versión a mi asistente"}
                        </Btn>
                      </>
                    ) : null}
                    <Btn variant="ghost" onClick={() => open(row)}>
                      {needs ? "Ver el email completo" : "Ver el email"}
                    </Btn>
                    {!needs && !hasConsultant && row.state === "ready" ? <Btn onClick={() => open(row)}>Programar en Klaviyo</Btn> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        id="mias"
        title="Las que has creado tú"
        lead={hasConsultant ? "Tu consultor las ve y puede anotar o corregir; tú las sigues editando." : "Las escribe tu asistente y las apruebas tú."}
      >
        <Panel>
          {mine.length === 0 ? (
            <p className={s.empty}>Todavía no has creado ninguna. Pulsa «Crear una campaña».</p>
          ) : (
            <div className={s.tl}>
              {mine.map((row) => {
                const state = clientState(row, hasConsultant);
                const parts = dayParts(row.date);
                return (
                  <div key={row.key} className={s.tlR}>
                    <div className={s.tlD}>
                      <b>{parts.day}</b>
                      <small>{parts.mon}</small>
                    </div>
                    <div>
                      <b>{row.name}</b>
                      <p>{row.subject || (isMetaChannel(row.channel) ? "Meta Ads" : "Email")}</p>
                    </div>
                    <span className={s.alAct}>
                      <Chip tone={state.tone}>{state.label}</Chip>
                      <Btn size="sm" variant="ghost" onClick={() => open(row)}>
                        Abrir
                      </Btn>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </Section>

      <Section
        id="prox"
        title="Qué viene"
        lead="Los envíos planificados, en el orden en que salen."
        action={
          <Seg
            label="Filtrar envíos"
            value={filter}
            onChange={setFilter}
            options={[
              { key: "next", label: "Próximos", count: own.filter((row) => row.state !== "sent" && row.date).length },
              { key: "sent", label: "Enviados", count: sent.length },
              { key: "all", label: "Todos", count: own.filter((row) => row.date).length },
            ]}
          />
        }
      >
        <Panel>
          {filtered.length === 0 ? (
            <p className={s.empty}>Nada en este filtro.</p>
          ) : (
            <div className={s.tl}>
              {filtered.map((row) => {
                const state = clientState(row, hasConsultant);
                const parts = dayParts(row.date);
                return (
                  <div key={row.key} className={s.tlR}>
                    <div className={s.tlD}>
                      <b>{parts.day}</b>
                      <small>{parts.mon}</small>
                    </div>
                    <div>
                      <b>{row.name}</b>
                      <p>{row.subject || (isMetaChannel(row.channel) ? "Anuncio en Meta" : "")}</p>
                    </div>
                    <span className={s.alAct}>
                      <Chip tone={state.tone}>{state.label}</Chip>
                      {row.item ? (
                        <Btn size="sm" variant="ghost" onClick={() => open(row)}>
                          Abrir
                        </Btn>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </Section>

      <Section id="trajo" title="Qué ha traído" lead="Lo que han hecho tus últimos envíos de email, contado por Klaviyo.">
        <Panel>
          {sent30.length === 0 ? (
            <p className={s.empty}>Cuando salgan tus próximos envíos verás aquí cómo les va.</p>
          ) : (
            <div className={s.res}>
              <div>
                <small>Personas que lo abrieron</small>
                <b>{delivered ? pct(ratio(opens, delivered)) : "—"}</b>
                <em>media de {sent30.length === 1 ? "la última" : `las ${sent30.length} últimas`}</em>
              </div>
              <div>
                <small>Personas que hicieron clic</small>
                <b>{delivered ? pct(ratio(clicks, delivered)) : "—"}</b>
                <em>media de {sent30.length === 1 ? "la última" : `las ${sent30.length} últimas`}</em>
              </div>
              <div>
                <small>Ingresos atribuidos por Klaviyo</small>
                <b>{formatMoney(revenue, currency)}</b>
                <em>suma de {sent30.length === 1 ? "esa" : `esas ${sent30.length}`}, no es el total de la tienda · {int(delivered)} entregados</em>
              </div>
            </div>
          )}
          <p className={s.foot} style={{ marginTop: 14 }}>
            Ingresos atribuidos por Klaviyo durante toda la vida de cada campaña, en la moneda indicada. No se suman a Meta ni a las ventas de Shopify.
          </p>
        </Panel>
      </Section>

      <QuickActionsBar
        mode="client"
        organizationId={organizationId}
        rows={rows}
        storeId={null}
        hasConsultant={hasConsultant}
        onChanged={onChanged}
        onWriteWithAi={onWriteWithAi}
      />
    </Stage>
  );
}

function CreateCampaign({
  organizationId,
  hasConsultant,
  workspace,
  onClose,
  onCreated,
}: {
  organizationId: string;
  hasConsultant: boolean;
  workspace: KWorkspace | undefined;
  onClose: () => void;
  onCreated: (itemId: string, withAi: boolean, title: string) => void;
}) {
  const audiences = [...(workspace?.audiences?.lists ?? []), ...(workspace?.audiences?.segments ?? [])];
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"Email" | "Meta">("Email");
  const [date, setDate] = useState(() => new Date(Date.now() + 7 * DAY_MS).toISOString().slice(0, 10));
  const [audience, setAudience] = useState("");
  const [brief, setBrief] = useState("");
  const [ai, setAi] = useState(true);
  const [busy, setBusy] = useState(false);

  async function save() {
    const title = name.trim();
    if (!title) {
      toast.danger("Ponle un nombre a la campaña para crearla.");
      return;
    }
    setBusy(true);
    const description = [audience ? `Para: ${audience}` : null, brief.trim() || null].filter(Boolean).join("\n\n");
    const result = await createClientCampaign(organizationId, {
      title,
      channel,
      startsAt: new Date(`${date}T10:00:00`).toISOString(),
      description: description || null,
    });
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    onCreated(result.data.id, ai && channel === "Email", title);
  }

  return (
    <Section
      id="crear"
      title="Crear una campaña"
      lead={
        hasConsultant
          ? "Puedes crear tu propia campaña aunque tengas consultor. Le llegará un aviso para que la revise."
          : "Dinos qué quieres contar y tu asistente prepara el borrador. Tú lo apruebas."
      }
    >
      <div className={s.newBox}>
        <div className={s.row2}>
          <div className={s.fld}>
            <label htmlFor="c-name">Nombre</label>
            <input id="c-name" type="text" maxLength={60} value={name} placeholder="Ej. Promoción de fin de mes" onChange={(event) => setName(event.target.value)} />
          </div>
          <div className={s.fld}>
            <span className={s.lbl}>Canal</span>
            <div className={s.opts}>
              {(["Email", "Meta"] as const).map((value) => (
                <button key={value} type="button" className={s.opt} aria-pressed={channel === value} onClick={() => setChannel(value)}>
                  {value === "Meta" ? "Meta Ads" : "Email"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={s.row2}>
          <div className={s.fld}>
            <label htmlFor="c-date">Fecha prevista</label>
            <input id="c-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className={s.fld}>
            <label htmlFor="c-aud">Para quién</label>
            <select id="c-aud" value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="">Que lo decida quien la prepara</option>
              {audiences.map((entry) => (
                <option key={entry.id} value={entry.name}>
                  {entry.name}
                  {entry.size != null ? ` · ${int(entry.size)} personas` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={s.fld}>
          <label htmlFor="c-brief">Qué quieres contar</label>
          <textarea id="c-brief" value={brief} placeholder="El producto, la oferta y el plazo. Con eso basta." onChange={(event) => setBrief(event.target.value)} />
        </div>
        {channel === "Email" ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={ai} onChange={(event) => setAi(event.target.checked)} /> Que la IA prepare el primer borrador del email
          </label>
        ) : null}
        <p className={s.hint}>
          {hasConsultant
            ? "Tu consultor podrá anotar, corregir y ajustar tu campaña. Verás sus notas en el hilo de la propia campaña y nada sale sin tu visto bueno."
            : "Sin consultor, tú apruebas y programas. Todo queda guardado por versiones por si quieres volver atrás."}
        </p>
        <div className={s.formF}>
          <span className={s.foot}>{hasConsultant ? "Se avisa a tu consultor al crearla." : "Nadie más recibe aviso."}</span>
          <span className={s.alAct}>
            <Btn variant="ghost" onClick={onClose}>
              Cancelar
            </Btn>
            <Btn variant="acc" disabled={busy} onClick={() => void save()}>
              {hasConsultant ? "Crear y avisar a mi consultor" : "Crear campaña"}
            </Btn>
          </span>
        </div>
      </div>
    </Section>
  );
}
