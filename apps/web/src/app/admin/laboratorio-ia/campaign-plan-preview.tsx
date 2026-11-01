import type { AiModelLabResult } from "@e-nora/contracts";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function dateRange(start: unknown, end: unknown): string {
  const from = text(start);
  const to = text(end);
  return from && to ? `${from} → ${to}` : from || to || "Fechas por definir";
}

function MessageCard({ value }: { value: unknown }) {
  const message = record(value);
  if (!message) return null;
  return (
    <article className="space-y-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="font-semibold">{text(message.title) || "Acción"}</h5>
        <span className="text-sm text-muted">
          {dateRange(message.scheduled_date, null)}
          {text(message.scheduled_time) ? ` · ${text(message.scheduled_time)}` : ""}
        </span>
      </div>
      {text(message.purpose) ? <p className="text-sm">{text(message.purpose)}</p> : null}
      {text(message.creative_brief) ? (
        <p className="whitespace-pre-wrap text-sm text-muted">{text(message.creative_brief)}</p>
      ) : null}
    </article>
  );
}

function InitiativeCard({ value }: { value: unknown }) {
  const initiative = record(value);
  if (!initiative) return null;
  const klaviyo = record(initiative.klaviyo);
  const emailCampaigns = list(klaviyo?.campaigns);
  const flows = list(klaviyo?.flows);
  const metaCampaigns = list(initiative.meta_campaigns);
  const offer = record(initiative.offer);

  return (
    <article className="space-y-4 rounded-xl border border-line bg-background p-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-lg font-semibold">{text(initiative.name) || "Iniciativa"}</h4>
          <span className="text-sm text-muted">
            {dateRange(initiative.start_date, initiative.end_date)}
          </span>
        </div>
        {text(initiative.objective) ? <p className="text-sm">{text(initiative.objective)}</p> : null}
      </header>
      {text(initiative.audience) ? (
        <p className="text-sm"><strong>Audiencia:</strong> {text(initiative.audience)}</p>
      ) : null}
      {offer ? (
        <p className="text-sm"><strong>Oferta:</strong> {text(offer.status) || "sin indicar"} · {text(offer.description)}</p>
      ) : null}
      {text(initiative.hypothesis) ? (
        <p className="text-sm text-muted"><strong>Hipótesis:</strong> {text(initiative.hypothesis)}</p>
      ) : null}
      {emailCampaigns.length ? (
        <section className="space-y-3">
          <h5 className="font-semibold">Emails propuestos</h5>
          {emailCampaigns.map((campaign, index) => {
            const item = record(campaign);
            if (!item) return null;
            const paths = list(item?.paths);
            return (
              <div key={`${text(item?.name)}-${index}`} className="space-y-2 rounded-lg border border-line p-4">
                <p className="font-medium">{text(item?.name) || "Campaña de email"}</p>
                {text(item?.objective) ? <p className="text-sm text-muted">{text(item.objective)}</p> : null}
                {paths.map((path, pathIndex) => {
                  const pathRecord = record(path);
                  if (!pathRecord) return null;
                  return (
                    <div key={`${text(pathRecord?.name)}-${pathIndex}`} className="space-y-2">
                      {text(pathRecord?.name) ? <p className="text-sm font-medium">{text(pathRecord.name)}</p> : null}
                      {text(pathRecord?.audience) ? <p className="text-sm text-muted">Audiencia: {text(pathRecord.audience)}</p> : null}
                      {list(pathRecord?.messages).map((message, messageIndex) => (
                        <MessageCard key={messageIndex} value={message} />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      ) : null}
      {metaCampaigns.length ? (
        <section className="space-y-3">
          <h5 className="font-semibold">Meta propuesto</h5>
          {metaCampaigns.map((campaign, index) => {
            const item = record(campaign);
            if (!item) return null;
            return (
              <div key={`${text(item?.name)}-${index}`} className="space-y-2 rounded-lg border border-line p-4">
                <p className="font-medium">{text(item?.name) || "Anuncios"} · {dateRange(item?.start_date, item?.end_date)}</p>
                {text(item?.objective) ? <p className="text-sm">{text(item.objective)}</p> : null}
                {text(item?.budget_guidance) ? <p className="text-sm text-muted">Presupuesto: {text(item.budget_guidance)}</p> : null}
                {list(item?.ad_sets).flatMap((adSet) => list(record(adSet)?.ads)).map((ad, adIndex) => (
                  <MessageCard key={adIndex} value={ad} />
                ))}
              </div>
            );
          })}
        </section>
      ) : null}
      {flows.length ? (
        <section className="space-y-2">
          <h5 className="font-semibold">Automatizaciones a revisar</h5>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {flows.map((flow, index) => {
              const item = record(flow);
              return <li key={index}>{text(item?.name)} · preparación {text(item?.preparation_date)} · {text(item?.trigger)}</li>;
            })}
          </ul>
        </section>
      ) : null}
      {text(initiative.success_metric) ? (
        <p className="text-sm"><strong>Cómo medir:</strong> {text(initiative.success_metric)}</p>
      ) : null}
    </article>
  );
}

export function CampaignPlanPreview({ result }: { result: AiModelLabResult }) {
  let output: JsonRecord;
  try {
    const parsed: unknown = JSON.parse(result.raw_response);
    const safe = record(parsed);
    if (!safe) return null;
    output = safe;
  } catch {
    return null;
  }

  const initiatives = list(output.initiatives);
  const campaigns = list(output.campaigns);
  const warnings = list(output.warnings).filter((item): item is string => typeof item === "string");
  const hasPlan = initiatives.length > 0 || campaigns.length > 0;

  return (
    <section className="space-y-4 rounded-xl border border-brand/30 bg-brand/5 p-5" aria-label="Plan de campaña de A05">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resultado del modelo · borrador de laboratorio</p>
          <h4 className="mt-1 text-xl font-semibold">{text(output.plan_name) || "Plan A05"}</h4>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs">No enviado ni programado</span>
      </div>
      {text(output.diagnosis) ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{text(output.diagnosis)}</p> : null}
      {hasPlan ? (
        <div className="space-y-4">
          {initiatives.map((item, index) => <InitiativeCard key={index} value={item} />)}
          {campaigns.length ? (
            <section className="space-y-2 rounded-xl border border-line bg-background p-4">
              <h4 className="font-semibold">Acciones propuestas</h4>
              {campaigns.map((item, index) => <div key={index} className="rounded-lg border border-line p-4"><ReadableLegacyCampaign value={item} /></div>)}
            </section>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-background p-4">
          <p className="font-semibold">Este modelo no recomienda lanzar una campaña todavía.</p>
          <p className="mt-1 text-sm text-muted">El plan prioriza resolver los bloqueos y volver a decidir antes de comprometer envíos o presupuesto.</p>
        </div>
      )}
      {warnings.length ? (
        <details className="rounded-lg border border-line bg-background p-4">
          <summary className="cursor-pointer font-semibold">Hitos, condiciones y alertas ({warnings.length})</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {warnings.map((warning, index) => <li key={index} className="whitespace-pre-wrap">{warning}</li>)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ReadableLegacyCampaign({ value }: { value: unknown }) {
  const campaign = record(value);
  if (!campaign) return null;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">{text(campaign.title)} · {text(campaign.channel)}</p>
      {text(campaign.scheduled_date) ? <p>Fecha: {text(campaign.scheduled_date)}</p> : null}
      {text(campaign.objective) ? <p>Objetivo: {text(campaign.objective)}</p> : null}
      {text(campaign.audience) ? <p>Audiencia: {text(campaign.audience)}</p> : null}
      {text(campaign.creative_brief) ? <p className="whitespace-pre-wrap text-muted">{text(campaign.creative_brief)}</p> : null}
      {text(campaign.success_metric) ? <p>Medición: {text(campaign.success_metric)}</p> : null}
    </div>
  );
}
