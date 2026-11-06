"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useCopilotAsk } from "@/components/copilot-ask";
import { StatusStrip } from "@/components/trabajo-ui";
import { Badge, Button, ButtonLink, EmptyState, Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { FlowDiagram } from "./flow-diagram";
import { FlowBuilder, type FlowDesignRow } from "./flows/flow-builder";
import { FLOW_TEMPLATES, blankFlow, walk, type FlowAccount } from "./flows/flow-design";
import { fmtDate } from "./format";
import { flowKind, flowStatus, KEY_FLOWS, ratio, type KFlow, type KWorkspace } from "./klaviyo-workspace";
import s from "./marketing-views.module.css";

type BuilderInitial = { row: FlowDesignRow | null; doc: { name: string; design: FlowDesignRow["design"] } };

type DesignsPayload = {
  designs: FlowDesignRow[];
  metrics: FlowAccount["metrics"];
  can_write: boolean;
  connected: boolean;
};

/**
 * Marketing -> Flows: automatizaciones de Klaviyo con su diagrama y
 * rendimiento, y el constructor para diseñar flows nuevos a mano. El
 * constructor se abre con `?flow=` (id guardado, `new` o `new:<plantilla>`),
 * así un enlace o una recarga vuelven al mismo flow.
 */
export function FlowsView({
  organizationId,
  workspace,
  drafts,
  onOpenPiece,
  onNewPiece,
  basePath = "/marketing",
  isConsultant = false,
}: {
  organizationId: string;
  workspace: KWorkspace | undefined;
  drafts: MarketingDraft[];
  onOpenPiece: (draftId: string) => void;
  onNewPiece: () => void;
  basePath?: string;
  isConsultant?: boolean;
}) {
  const askCopilot = useCopilotAsk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowParam = searchParams.get("flow");
  const designsKey = organizationId ? `/v1/organizations/${organizationId}/marketing/flow-designs` : null;
  const designsQuery = useCachedQuery<DesignsPayload>(designsKey);
  const designs = designsQuery.data?.designs ?? [];
  // Lo que tiene abierto el constructor. Se fija al abrir (o al guardar un flow
  // nuevo), no se deriva de la URL en cada render: cuando el flow nuevo se
  // guarda, la URL pasa de `new` a su id y el constructor no debe montarse otra vez.
  const [opened, setOpened] = useState<{ key: number; initial: BuilderInitial } | null>(null);

  const flows = workspace?.flows ?? [];
  const currency = workspace?.account?.currency ?? "EUR";
  const kinds = new Map(flows.map((flow) => [flow.id, flowKind(flow)]));
  const stopped = flows.filter((flow) => kinds.get(flow.id) && flowStatus(flow.status).key !== "live");
  const missing = KEY_FLOWS.filter((kind) => !flows.some((flow) => kinds.get(flow.id) === kind.key));
  const sorted = [...flows].sort(
    (a, b) =>
      Number(flowStatus(b.status).key === "live") - Number(flowStatus(a.status).key === "live") ||
      (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = flows.find((flow) => flow.id === selectedId) ?? stopped[0] ?? sorted[0] ?? null;

  const account: FlowAccount = useMemo(
    () => ({
      metrics: designsQuery.data?.metrics ?? [],
      lists: (workspace?.audiences?.lists ?? []).map((list) => ({ id: list.id, name: list.name })),
      segments: (workspace?.audiences?.segments ?? []).map((segment) => ({ id: segment.id, name: segment.name })),
      fromEmail: workspace?.account?.default_from_email ?? "",
      fromLabel: workspace?.account?.default_from_label ?? workspace?.account?.name ?? "",
    }),
    [designsQuery.data?.metrics, workspace],
  );
  const pieces = useMemo(
    () => drafts.filter((draft) => draft.request?.channel === "email_klaviyo" && draft.content_type !== "popup"),
    [drafts],
  );

  function initialFor(value: string): BuilderInitial | null {
    if (value.startsWith("new")) {
      const template = FLOW_TEMPLATES.find((item) => item.key === value.slice(4));
      const built = template ? template.build(account) : blankFlow();
      return { row: null, doc: { name: built.name, design: built.design } };
    }
    const row = designs.find((item) => item.id === value);
    return row ? { row, doc: { name: row.name, design: row.design } } : null;
  }

  function setFlowParam(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("flow", value);
    else params.delete("flow");
    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
  }

  function openFlow(value: string | null) {
    const initial = value ? initialFor(value) : null;
    setOpened(initial ? { key: Date.now(), initial } : null);
    setFlowParam(value);
  }

  // Al entrar por enlace o recarga no hay nada fijado todavía: un flow guardado
  // se busca en la lista; uno nuevo (plantilla) se abre en cuanto hay datos.
  const directNew = Boolean(flowParam?.startsWith("new")) && !opened;
  const savedRow = flowParam && !flowParam.startsWith("new") ? designs.find((item) => item.id === flowParam) : undefined;
  const initial = opened?.initial ?? (savedRow ? { row: savedRow, doc: { name: savedRow.name, design: savedRow.design } } : null);
  const ready = Boolean(designsQuery.data);
  useEffect(() => {
    if (directNew && ready && flowParam) openFlow(flowParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al llegar los datos
  }, [directNew, ready]);

  if (flowParam) {
    if (designsQuery.isLoading || directNew) return <div className={s.root}><p className={s.muted}>Abriendo el flow…</p></div>;
    if (!initial) {
      return (
        <div className={s.root}>
          <EmptyState
            title="Ese flow ya no existe"
            hint="Puede que se borrara. Vuelve a Flows para ver los que hay."
            action={<Button onClick={() => openFlow(null)}>Volver a Flows</Button>}
          />
        </div>
      );
    }
    return (
      <FlowBuilder
        key={opened?.key ?? "enlace"}
        organizationId={organizationId}
        account={account}
        pieces={pieces}
        initial={initial}
        canWrite={designsQuery.data?.can_write ?? false}
        connected={Boolean(workspace?.connected)}
        onClose={() => {
          designsQuery.reload();
          openFlow(null);
        }}
        onSaved={(row, created) => {
          designsQuery.reload();
          if (created) {
            setOpened((current) => ({ key: current?.key ?? 0, initial: { row, doc: { name: row.name, design: row.design } } }));
            setFlowParam(row.id);
          }
        }}
        onDeleted={() => {
          designsQuery.reload();
          openFlow(null);
        }}
        onOpenPiece={onOpenPiece}
        onNewPiece={onNewPiece}
      />
    );
  }

  const designSection = designs.length ? (
    <section className={s.designs} aria-labelledby="flow-designs-title">
      <h2 id="flow-designs-title">Diseñados en NORA</h2>
      <div className={s.designGrid}>
        {designs.map((row) => {
          let count = 0;
          walk(row.design?.steps ?? [], (step) => {
            if (step.type === "email") count += 1;
          });
          const pending = row.pushed_at && Date.parse(row.updated_at) > Date.parse(row.pushed_at) + 2000;
          return (
            <button key={row.id} type="button" className={s.flowCard} onClick={() => openFlow(row.id)}>
              <span className={s.flowTop}>
                <b>{row.name}</b>
                <Badge tone={row.klaviyo_flow_id ? (pending ? "warn" : "success") : "neutral"}>
                  {row.klaviyo_flow_id ? (pending ? "Cambios sin subir" : "En Klaviyo · borrador") : "Borrador en NORA"}
                </Badge>
              </span>
              <span className={s.muted}>
                {count} email{count === 1 ? "" : "s"} · editado {fmtDate(row.updated_at)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  if (!workspace?.connected) {
    return (
      <div className={s.root}>
        <Header onNew={() => openFlow("new")} isConsultant={isConsultant} />
        {designSection}
        <EmptyState
          title="Los flows viven en Klaviyo"
          hint="Puedes diseñar flows aquí ya. Para crearlos en Klaviyo y ver los que tienes, con sus pasos y el resultado de cada email, conecta la cuenta."
          action={
            <ButtonLink href="/integraciones" variant="default">
              Conectar Klaviyo
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const live = flows.filter((flow) => flowStatus(flow.status).key === "live").length;
  const emails = flows.reduce((sum, flow) => sum + flow.messages.length, 0);
  const flowRevenue = workspace.totals_flow?.revenue ?? 0;
  const emailRevenue = workspace.totals?.revenue ?? 0;

  return (
    <div className={s.root}>
      <Header onNew={() => openFlow("new")} isConsultant={isConsultant} />
      <StatusStrip
        items={[
          {
            value: formatMoney(flowRevenue, currency),
            label: `Ingresos atribuidos por flows · ${workspace.period.days} d`,
            hint: emailRevenue ? `${Math.round(100 * ratio(flowRevenue, emailRevenue))} % del email` : undefined,
            tone: "good",
          },
          { value: `${live} / ${flows.length}`, label: "Activos" },
          { value: emails, label: "Emails en flows" },
          {
            value: missing.length + stopped.length,
            label: "Flows clave parados o que faltan",
            tone: missing.length + stopped.length ? "warn" : undefined,
          },
        ]}
      />
      {designSection}
      {flows.length === 0 ? (
        <EmptyState
          title="Esta cuenta no tiene flows"
          hint="Empieza por la bienvenida y el carrito abandonado: son los que más venden solos."
          action={<Button onClick={() => openFlow("new:cart")}>Crear el carrito abandonado</Button>}
        />
      ) : (
        <div className={s.flows}>
          <div className={s.flowList} role="group" aria-label="Flows">
            {sorted.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                currency={currency}
                active={selected?.id === flow.id}
                onSelect={() => setSelectedId(flow.id)}
              />
            ))}
            {missing.map((kind) => (
              <div key={kind.key} className={s.flowCard} data-missing="">
                <span className={s.flowTop}>
                  <b>{kind.label}</b>
                  <Badge tone="brand">Te falta</Badge>
                </span>
                <span className={s.muted}>{kind.why}</span>
                <span>
                  <Button size="sm" variant="secondary" onClick={() => openFlow(`new:${kind.key}`)}>
                    Crear desde plantilla
                  </Button>
                </span>
              </div>
            ))}
          </div>
          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
                <CardAction><Badge tone={flowStatus(selected.status).tone}>{flowStatus(selected.status).label}</Badge></CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {kinds.get(selected.id) && flowStatus(selected.status).key !== "live" ? (
                    <div className={s.warnBox}>
                      <b>Este flow no está enviando</b>
                      <span>
                        Está en «{flowStatus(selected.status).label.toLowerCase()}». Mientras siga así, nadie que
                        cumpla el disparador recibe estos emails. Se activa desde Klaviyo.
                      </span>
                    </div>
                  ) : null}
                  <FlowDiagram flow={selected} currency={currency} />
                  <div className={s.acts}>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        askCopilot({
                          question: `Analiza el flow «${selected.name}» de Klaviyo: qué email rinde peor, dónde se pierde la gente y qué cambiarías.`,
                          focusLabel: `Flow · ${selected.name}`,
                          reference: { kind: "entity", entity: { type: "klaviyo_flow", id: selected.id } },
                        })
                      }
                    >
                      Analizar con NORA
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Header({ onNew, isConsultant }: { onNew: () => void; isConsultant: boolean }) {
  return (
    <div className={s.head}>
      <div className="client-sr-title">
        <h1>Flows</h1>
        <p>Tus automatizaciones de Klaviyo: qué está activo, cuánto rinde cada email y qué falta.</p>
      </div>
      <div className={s.acts}>
        {/* La revisión vive en los especialistas de /klaviyo, que solo ve el consultor */}
        {isConsultant ? <ButtonLink href="/klaviyo#revision-contenido-email" variant="secondary">Revisión de contenido A26</ButtonLink> : null}
        <Button onClick={onNew}>Nuevo flow</Button>
      </div>
    </div>
  );
}

function FlowCard({ flow, currency, active, onSelect }: { flow: KFlow; currency: string; active: boolean; onSelect: () => void }) {
  const status = flowStatus(flow.status);
  const stats = flow.stats;
  return (
    <button type="button" className={s.flowCard} aria-pressed={active} onClick={onSelect}>
      <span className={s.flowTop}>
        <b>{flow.name}</b>
        <Badge tone={status.tone}>{status.label}</Badge>
      </span>
      <span className={s.muted}>{flow.messages.length} emails</span>
      <span className={s.flowStats}>
        <span>
          Ingresos atrib. <b>{stats?.revenue ? formatMoney(stats.revenue, currency) : "—"}</b>
        </span>
        <span>
          Por destinatario{" "}
          <b>{stats?.recipients ? formatMoney(ratio(stats.revenue, stats.recipients), currency) : "—"}</b>
        </span>
      </span>
    </button>
  );
}
