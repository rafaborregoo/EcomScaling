"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui";
import { pct, ratio, type KFlow, type KFlowMessage, type KFlowNode } from "./klaviyo-workspace";
import s from "./marketing-views.module.css";

const KIND_LABEL: Record<KFlowNode["kind"], string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  delay: "Espera",
  split: "División condicional",
  update: "Perfil",
  webhook: "Webhook",
  end: "Fin",
  other: "Paso",
};

// Un flow real no pasa de unas decenas de pasos; el tope evita que un grafo
// mal formado (ciclo, enlaces rotos) cuelgue la pantalla.
const MAX_DEPTH = 60;

/**
 * Diagrama de un flow tal como está en Klaviyo: disparador, esperas, emails y
 * divisiones con sus dos ramas. Cada email lleva su rendimiento del periodo.
 */
export function FlowDiagram({ flow, currency }: { flow: KFlow; currency: string }) {
  const live = (flow.status ?? "").toLowerCase() === "live";
  const byAction = new Map<string, KFlowMessage>();
  for (const message of flow.messages) if (message.action_id) byAction.set(message.action_id, message);
  const graph = flow.graph;

  const trigger = (
    <div className={s.node} data-kind="trigger">
      <span className={s.nodeType}>Disparador</span>
      {(graph?.triggers.length ? graph.triggers : [{ type: flow.trigger_type ?? "", label: triggerFallback(flow.trigger_type) }]).map(
        (entry, index) => (
          <b key={index}>{entry.label}</b>
        ),
      )}
    </div>
  );

  if (!graph || !graph.entry) {
    // Sin grafo todavía (se trae en la siguiente sincronización): se enseñan
    // los emails del flow en orden, que ya están guardados.
    return (
      <div className={s.chain}>
        {trigger}
        {flow.messages.map((message) => (
          <FragmentWithConn key={message.message_id}>
            <EmailNode
              node={{ id: message.message_id, kind: "email", label: message.name ?? "Email", subject: message.subject }}
              message={message}
              live={live}
              currency={currency}
            />
          </FragmentWithConn>
        ))}
        <p className={s.muted} style={{ marginTop: 12 }}>
          El esquema completo, con esperas y divisiones, llega en la próxima sincronización.
        </p>
      </div>
    );
  }

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();

  function sequence(startId: string | null | undefined, depth: number): ReactNode[] {
    const out: ReactNode[] = [];
    let current = startId ?? null;
    let steps = depth;
    while (current && steps < MAX_DEPTH) {
      const node = nodes.get(current);
      if (!node || seen.has(current)) break;
      seen.add(current);
      steps += 1;
      out.push(<div key={`c-${node.id}`} className={s.conn} />);
      if (node.kind === "split") {
        out.push(
          <div key={node.id} className={s.node} data-kind="split">
            <span className={s.nodeType}>{KIND_LABEL.split}</span>
            <b>{node.label}</b>
          </div>,
        );
        out.push(<div key={`cb-${node.id}`} className={s.conn} />);
        out.push(
          <div key={`b-${node.id}`} className={s.branches}>
            {(
              [
                ["Sí", node.yes],
                ["No", node.no],
              ] as const
            ).map(([label, target]) => {
              const branch = sequence(target, steps);
              return (
                <div key={label} className={s.branch}>
                  <div className={s.conn} />
                  <span className={s.branchLabel}>{label}</span>
                  {branch.length ? branch : [<div key="c" className={s.conn} />, <div key="e" className={s.node} data-kind="end">Sale del flow</div>]}
                </div>
              );
            })}
          </div>,
        );
        break;
      }
      if (node.kind === "email" || node.kind === "sms" || node.kind === "push") {
        out.push(<EmailNode key={node.id} node={node} message={byAction.get(node.id)} live={live} currency={currency} />);
      } else if (node.kind === "delay" || node.kind === "end") {
        out.push(
          <div key={node.id} className={s.node} data-kind={node.kind}>
            {node.label}
          </div>,
        );
      } else {
        out.push(
          <div key={node.id} className={s.node} data-kind="other">
            <span className={s.nodeType}>{KIND_LABEL[node.kind]}</span>
            <b>{node.label}</b>
          </div>,
        );
      }
      current = node.next ?? null;
    }
    return out;
  }

  return (
    <div className={s.chain}>
      {trigger}
      {sequence(graph.entry, 0)}
      {graph.truncated ? <p className={s.muted}>Flow muy largo: se muestran los primeros 80 pasos.</p> : null}
    </div>
  );
}

function FragmentWithConn({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={s.conn} />
      {children}
    </>
  );
}

function EmailNode({ node, message, live, currency }: { node: KFlowNode; message: KFlowMessage | undefined; live: boolean; currency: string }) {
  const stats = message?.stats;
  return (
    <div className={s.node} data-kind={node.kind} data-off={live ? undefined : ""}>
      <span className={s.nodeType}>
        <span>{KIND_LABEL[node.kind]}</span>
        {live ? null : <Badge tone="warn">Sin enviar</Badge>}
      </span>
      <b>{message?.name ?? node.label}</b>
      {node.subject || message?.subject ? <span className={s.muted}>«{node.subject ?? message?.subject}»</span> : null}
      {stats && stats.delivered > 0 ? (
        <span className={s.nodeStats}>
          <span>
            Aperturas <b>{pct(ratio(stats.opens_unique, stats.delivered))}</b>
          </span>
          <span>
            Clics <b>{pct(ratio(stats.clicks_unique, stats.delivered))}</b>
          </span>
          <span>
            EUR atrib. <b>{formatMoney(stats.revenue, currency)}</b>
          </span>
        </span>
      ) : live ? (
        <span className={s.muted}>Sin envíos en el periodo</span>
      ) : null}
    </div>
  );
}

function triggerFallback(type: string | null) {
  const value = (type ?? "").toLowerCase();
  if (value.includes("list")) return "Al entrar en una lista";
  if (value.includes("segment")) return "Al entrar en un segmento";
  if (value.includes("metric")) return "Cuando ocurre un evento";
  if (value.includes("date")) return "En una fecha del perfil";
  if (value.includes("price")) return "Cuando baja un precio";
  return "Disparador";
}
