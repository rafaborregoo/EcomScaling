import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, EmptyState, IconChevronDown } from "@/components/ui";
import type { CampaignPlanSummary } from "./campaign-rows";

export function CampaignPlanAccountCard({
  proposal,
  isConsultant,
  onReview,
  isLoading,
  hasError,
  onRetry,
}: {
  proposal: CampaignPlanSummary | null;
  isConsultant: boolean;
  onReview: () => void;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  const content = proposal?.content;
  if (isLoading) {
    return <section className="mb-5 rounded-2xl border border-line bg-surface p-5 text-sm text-muted" aria-live="polite">Cargando el último resultado de A05 para esta tienda…</section>;
  }
  if (hasError) {
    return (
      <section className="mb-5 rounded-2xl border border-danger/30 bg-danger/5 p-5" role="alert">
        <p className="font-semibold">No se pudo cargar el plan de campañas de A05.</p>
        <p className="mt-1 text-sm text-muted">Vuelve a intentarlo para consultar el resultado de esta tienda.</p>
        <Button className="mt-3" type="button" size="sm" variant="secondary" onClick={onRetry}>Reintentar</Button>
      </section>
    );
  }
  if (!proposal || !content) {
    return (
      <section className="mb-5 rounded-2xl border border-line bg-surface p-5" aria-live="polite">
        <Badge tone="neutral">A05 · Sin resultado</Badge>
        <EmptyState size="sm" className="mt-2" title="Todavía no hay una planificación de campañas guardada para esta tienda." />
      </section>
    );
  }

  const actionCount = content.calendar_actions?.length ?? content.campaigns.length;
  const warnings = content.warnings ?? [];
  const planWindow = content.planning_window;
  const modelLabel = proposal.model?.includes("sol")
    ? "GPT-6.1 Sol"
    : proposal.model ?? "Modelo A05";
  const statusLabel = proposal.status === "pending_approval"
    ? "Pendiente de revisión"
    : proposal.status === "published"
      ? "Compartido"
      : proposal.status === "approved"
        ? "Aprobado"
        : "Plan de IA";

  return (
    <section className="mb-5 space-y-4 rounded-2xl border border-brand/30 bg-brand/5 p-5" aria-labelledby="a05-plan-account-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={proposal.status === "pending_approval" ? "warn" : "brand"}>A05 · {statusLabel}</Badge>
            <span className="text-xs text-muted">Modelo: {modelLabel}</span>
            {proposal.execution_source === "cli_simulation" ? (
              <span className="rounded-full border border-line px-2 py-1 text-xs text-muted">Simulación CLI</span>
            ) : null}
          </div>
          <h2 id="a05-plan-account-title" className="text-xl font-semibold">
            {content.plan_name || "Plan de campañas"}
          </h2>
          {planWindow ? (
            <p className="text-sm text-muted">
              Ventana: {planWindow.start_date} – {planWindow.end_date}
              {planWindow.timezone ? ` · ${planWindow.timezone}` : ""}
            </p>
          ) : null}
        </div>
        {isConsultant ? (
          <Button type="button" size="sm" variant="secondary" onClick={onReview}>
            Revisar con A05
          </Button>
        ) : null}
      </header>

      {content.diagnosis ? (
        <p className="max-w-5xl whitespace-pre-wrap text-sm leading-relaxed">{content.diagnosis}</p>
      ) : null}

      {actionCount === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="font-semibold">Este resultado no propone nuevas acciones fechadas.</p>
          <p className="mt-1 text-sm text-muted">
            Consulta el diagnóstico y los hitos del plan para entender la decisión. Esto no cancela los envíos que ya estuvieran programados.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(content.calendar_actions ?? content.campaigns.map((campaign, index) => ({
            index,
            title: campaign.title,
            channel: campaign.channel,
            objective: campaign.objective,
            scheduled_date: campaign.scheduled_date,
          }))).map((action) => (
            <article key={action.index} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{action.title}</h3>
                <span className="text-xs text-muted">{action.channel}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{action.scheduled_date}</p>
              <p className="mt-2 text-sm">{action.objective}</p>
            </article>
          ))}
        </div>
      )}

      {warnings.length ? (
        <Collapsible className="rounded-xl border border-line bg-surface p-4">
          <CollapsibleTrigger className="w-full justify-between font-medium">Ver hitos, condiciones y alertas ({warnings.length})<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {warnings.map((warning, index) => <li key={index} className="whitespace-pre-wrap">{warning}</li>)}
          </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      <p className="text-xs text-muted">
        Esta planificación es informativa. No crea borradores de email/anuncios ni envía o programa campañas.
      </p>
    </section>
  );
}
