"use client";

/**
 * FASE 3 / D07 — por donde puede ir la cosa, y por donde no.
 *
 * Esta pantalla hace dos cosas que no se parecen y van juntas a proposito:
 * **ensena las rutas candidatas** de cada caso y **deja declarar relaciones
 * nuevas**. Van juntas porque la primera sin la segunda es una lista de "nadie
 * mide eso" que no se puede arreglar desde ningun sitio -- que es exactamente lo
 * que le pasaba a `D04` antes de tener su declarador.
 *
 * LO QUE ESTA PANTALLA NO PUEDE DEJAR QUE PASE: que "nadie lo ha mirado" se lea
 * como "descartado". Son los dos estados que el ojo confunde, y separarlos es el
 * bloque entero. Una rama descartada dice donde **no** esta el problema, que hoy
 * es lo mas util que produce la cadena; una rama sin comprobar es una pregunta
 * abierta que nadie ha contestado.
 *
 * Y NO HAY RANKING. Las rutas no se ordenan por confianza: quien lee el primero
 * de una lista entiende que es el bueno, y el guardrail 48 dice que D07 no
 * prioriza. Se ordenan por lo que aportan hoy -- primero lo que descarta.
 *
 * Solo consultor. Son causas **candidatas**, y una lista de hipotesis causales
 * delante de un cliente se lee como un diagnostico cerrado por mucho que ponga
 * "parcial" al lado.
 */

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
} from "@/components/ui";

import {
  confidenceLabel,
  declarableNodes,
  failingFits,
  groupByCase,
  pathStatusLabel,
  stepSentence,
  type CausalEdgeView,
  type CausalNodeView,
  type CausalPathView,
  type CausalStepView,
} from "./causal-view-model";

/**
 * Los tipos de relacion que un consultor puede declarar.
 *
 * `mathematical` **no** esta: la aritmetica del ecommerce ya viene declarada en
 * el grafo global, y dejar declarar una identidad a mano es como se acaban
 * metiendo formulas que no cuadran. `limits`, `requires` e `interaction` tampoco:
 * el motor todavia no los recorre, y ofrecerlos seria prometer algo que no pasa.
 */
const RELACIONES = [
  {
    value: "mechanistic",
    label: "Actua sobre (mecanismo fisico o del sistema)",
  },
  { value: "behavioral", label: "Cambia el comportamiento de la gente" },
  { value: "economic", label: "Mueve economicamente" },
  { value: "operational", label: "Condiciona la operativa" },
  { value: "technical", label: "Afecta tecnicamente" },
  { value: "contextual", label: "Contextualiza" },
];

const SIGNOS = [
  { value: "positive", label: "en el mismo sentido (mas causa, mas efecto)" },
  {
    value: "negative",
    label: "en sentido contrario (mas causa, menos efecto)",
  },
  { value: "non_monotonic", label: "no siempre igual (sube y luego baja)" },
  { value: "context_dependent", label: "depende del contexto" },
];

const BORRADOR_VACIO = {
  organization_id: "",
  from_node_id: "",
  to_node_id: "",
  relation_type: "economic",
  expected_sign: "positive",
  mechanism: "",
  diagnostic_rationale: "",
  expected_lag_days: "",
};

type Borrador = typeof BORRADOR_VACIO;

/**
 * Lo que falta para poder declarar, en una frase.
 *
 * El mecanismo de 20 caracteres no es un capricho de longitud: el guardrail 9
 * dice que un eslogan no es un mecanismo, y "el precio afecta" cabe en menos.
 */
function queFalta(draft: Borrador): string | null {
  if (!draft.organization_id) return "Elige la tienda.";
  if (!draft.from_node_id || !draft.to_node_id)
    return "Elige las dos cosas que se relacionan.";
  if (draft.from_node_id === draft.to_node_id)
    return "Tienen que ser dos cosas distintas.";
  if (draft.mechanism.trim().length < 20) {
    return "Escribe por que lo uno mueve a lo otro. Sin mecanismo esto es una correlacion, no una causa.";
  }
  if (!draft.diagnostic_rationale.trim()) {
    return "Di para que sirve diagnosticando: que permite distinguir que no se distinguia antes.";
  }
  return null;
}

function Paso({
  step,
  edges,
  nodes,
}: {
  step: CausalStepView;
  edges: readonly CausalEdgeView[];
  nodes: readonly CausalNodeView[];
}) {
  const edge = edges.find((e) => e.id === step.edge_id);
  const fallos = failingFits(step);

  return (
    <li className="border-default-200 border-t py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{stepSentence(step, edges, nodes)}</span>
        {step.is_mediator ? (
          <Badge tone="neutral">paso intermedio</Badge>
        ) : null}
        {step.cause_role === "contributory" ? (
          // Guardrail 28: contribuir no es bastar por su cuenta, y son dos
          // afirmaciones muy distintas delante de alguien que va a decidir.
          <Badge tone="warn">contribuye, no basta</Badge>
        ) : null}
      </div>

      {edge?.mechanism ? (
        <p className="text-muted mt-1 max-w-prose text-sm leading-6">
          {edge.mechanism}
        </p>
      ) : null}

      {step.contribution_note ? (
        <p className="mt-1 max-w-prose text-sm leading-6">
          {step.contribution_note}
        </p>
      ) : null}

      {fallos.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {fallos.map((f) => (
            <li key={f.axis} className="flex items-center gap-2">
              <Badge tone={f.tone}>{f.axis}</Badge>
              <span className="text-muted">{f.verdict}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {step.evidence.length > 0 ? (
        <ul className="text-muted mt-2 space-y-1 text-sm">
          {step.evidence.map((e) => (
            <li key={e.id}>
              {e.stance === "contradicting" ? "En contra: " : "A favor: "}
              {e.observation}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Ruta({
  path,
  edges,
  nodes,
}: {
  path: CausalPathView;
  edges: readonly CausalEdgeView[];
  nodes: readonly CausalNodeView[];
}) {
  const estado = pathStatusLabel(path.status);
  const confianza = confidenceLabel(path.path_confidence);

  return (
    <div className="border-default-200 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone={estado.tone}>{estado.label}</Badge>
        <Badge tone={confianza.tone}>{confianza.label}</Badge>
        {/* La frase que impide confundir descartada con sin comprobar. */}
        <span className="text-muted text-sm">{estado.hint}</span>
      </div>

      <ul className="mt-3">
        {path.steps.map((step) => (
          <Paso key={step.id} step={step} edges={edges} nodes={nodes} />
        ))}
      </ul>

      {path.missing_evidence.length > 0 ? (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning-soft/20 p-3">
          <p className="text-xs uppercase tracking-wide">
            Lo que falta por comprobar
          </p>
          <ul className="text-muted mt-1 space-y-1 text-sm leading-6">
            {path.missing_evidence.map((m) => (
              <li key={m}>· {m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {path.next_evidence ? (
        // Una sola cosa, a proposito: este campo existe para decidir que se mide
        // manana, y diez pendientes no deciden.
        <p className="mt-3 max-w-prose text-sm leading-6">
          Lo siguiente que despeja esto: {path.next_evidence}
        </p>
      ) : null}
    </div>
  );
}

export function CausalPathsPanel() {
  const [paths, setPaths] = useState<CausalPathView[] | null>(null);
  const [nodes, setNodes] = useState<CausalNodeView[]>([]);
  const [edges, setEdges] = useState<CausalEdgeView[]>([]);
  const [draft, setDraft] = useState(BORRADOR_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const cargar = useCallback(async () => {
    const response = await apiFetch("/v1/consultant/causal-paths");
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    const payload = (await response.json()) as {
      paths: CausalPathView[];
      nodes: CausalNodeView[];
      edges: CausalEdgeView[];
    };
    setPaths(payload.paths);
    setNodes(payload.nodes);
    setEdges(payload.edges);
    setError(null);
  }, []);

  useEffect(() => {
    cargar()
      .catch(() =>
        setError(
          "No se pudieron cargar las rutas causales por un error de red.",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [cargar]);

  const problema = queFalta(draft);
  const tiendas = [
    ...new Map(
      (paths ?? [])
        .filter((p) => p.organization_name)
        .map((p) => [p.organization_id, p.organization_name as string]),
    ).entries(),
  ].map(([value, label]) => ({ value, label }));

  const disponibles = declarableNodes(nodes, draft.organization_id || null).map(
    (n) => ({
      value: n.id,
      label: n.label,
    }),
  );

  async function declarar() {
    if (problema) return;
    setIsSaving(true);
    try {
      const response = await apiFetch("/v1/consultant/causal-edges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organization_id: draft.organization_id,
          from_node_id: draft.from_node_id,
          to_node_id: draft.to_node_id,
          relation_type: draft.relation_type,
          expected_sign: draft.expected_sign,
          mechanism: draft.mechanism.trim(),
          diagnostic_rationale: draft.diagnostic_rationale.trim(),
          expected_lag_days: draft.expected_lag_days
            ? Number(draft.expected_lag_days)
            : null,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setDraft({ ...BORRADOR_VACIO, organization_id: draft.organization_id });
      await cargar();
    } catch {
      setError("No se pudo guardar la relacion por un error de red.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !paths) {
    return <LoadingBlock label="Cargando las rutas causales..." />;
  }

  const casos = groupByCase(paths ?? []);

  return (
    <Card
      title="Por dónde puede ir, y por dónde no"
      description="Recorridos hacia atrás desde lo que se movió. Ninguno está sostenido todavía, y eso no es un fallo: lo que hoy aporta el bloque es descartar. Si las ventas cayeron y los pedidos, que sí se vigilan, no se movieron, esa rama queda cerrada y lo que se hundió es el ticket."
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {casos.length === 0 ? (
        <EmptyState
          title="Sin rutas causales"
          hint="Aparecen cuando hay un caso abierto con una señal y el motor recorre el grafo declarado hacia atrás desde ella."
        />
      ) : (
        <div className="space-y-6">
          {casos.map(({ caseId, paths: rutas }) => (
            <div key={caseId}>
              {rutas.map((path) => (
                <Ruta key={path.id} path={path} edges={edges} nodes={nodes} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="border-default-200 mt-6 border-t pt-4">
        <p className="text-xs uppercase tracking-wide">
          Declarar una relación de esta tienda
        </p>
        <p className="text-muted mt-1 max-w-prose text-sm leading-6">
          El grafo que viene de serie solo trae lo que se sostiene con las
          métricas que la plataforma lee hoy. Lo que sepas de esta tienda en
          concreto no cabía en ningún sitio, y sin ello el motor casi no tiene
          por dónde recorrer.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Tienda">
            <Select
              value={draft.organization_id}
              onChange={(organization_id) =>
                setDraft({
                  ...draft,
                  organization_id,
                  from_node_id: "",
                  to_node_id: "",
                })
              }
              options={tiendas}
              placeholder="Elige la tienda"
              aria-label="Tienda"
            />
          </Field>

          <Field label="Tipo de relación">
            <Select
              value={draft.relation_type}
              onChange={(relation_type) =>
                setDraft({ ...draft, relation_type })
              }
              options={RELACIONES}
              aria-label="Tipo de relación"
            />
          </Field>

          <Field label="Cuando cambia esto">
            <Select
              value={draft.from_node_id}
              onChange={(from_node_id) => setDraft({ ...draft, from_node_id })}
              options={disponibles}
              placeholder="Elige la causa"
              aria-label="Causa"
            />
          </Field>

          <Field label="Se mueve esto">
            <Select
              value={draft.to_node_id}
              onChange={(to_node_id) => setDraft({ ...draft, to_node_id })}
              options={disponibles}
              placeholder="Elige el efecto"
              aria-label="Efecto"
            />
          </Field>

          <Field label="En qué sentido">
            <Select
              value={draft.expected_sign}
              onChange={(expected_sign) =>
                setDraft({ ...draft, expected_sign })
              }
              options={SIGNOS}
              aria-label="Sentido esperado"
            />
          </Field>

          <Field label="Cuántos días tarda en notarse">
            <Input
              value={draft.expected_lag_days}
              onChange={(e) =>
                setDraft({ ...draft, expected_lag_days: e.target.value })
              }
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4">
          <Field label="Por qué lo uno mueve a lo otro">
            <Input
              value={draft.mechanism}
              onChange={(e) =>
                setDraft({ ...draft, mechanism: e.target.value })
              }
              placeholder="Subir el mínimo de envío gratis empuja a añadir un producto más al carrito para alcanzarlo, y deja fuera a quien no quiere gastar tanto."
            />
          </Field>

          <Field label="Qué permite distinguir">
            <Input
              value={draft.diagnostic_rationale}
              onChange={(e) =>
                setDraft({ ...draft, diagnostic_rationale: e.target.value })
              }
              placeholder="Separa una subida de ticket por cambio de política de una por cambio de mezcla de productos."
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void declarar()}
            disabled={Boolean(problema) || isSaving}
          >
            Declarar relación
          </Button>
          {/* El motivo por el que el botón está apagado, en vez de una pared. */}
          {problema ? (
            <span className="text-muted text-sm">{problema}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
