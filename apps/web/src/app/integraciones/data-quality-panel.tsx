"use client";

/**
 * FASE 3 / D01 — la primera pantalla de toda la fase.
 *
 * Quince bloques de tablas llevaban meses sin que nadie pudiera verlas. Esta es
 * la primera que se abre, y se elige esta por dos motivos: contesta la pregunta
 * que va antes que todas las demas -- "¿me puedo fiar de lo que estoy
 * mirando?" -- y es la unica que ya tiene un motor escribiendo filas.
 *
 * LA DECISION DE DISENO, que no es cosmetica: **la etiqueta dice lo que el
 * fallo le hace al diagnostico, no lo buena que es la fuente**. "Fiabilidad
 * baja" obliga al consultor a traducir; "bloquea el diagnostico" ya esta
 * traducido. Es literalmente la columna `downstream_effect` del contrato de
 * D01, que existe justo para eso (apartado 17).
 *
 * Esto es la vista de consultor: lo ve todo, incluidos los fallos que son
 * nuestros. La del cliente es otra y solo lleva lo suyo y ya verificado
 * (`isVisibleToClient` en el contrato); no se pinta aqui.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  EmptyState,
  ErrorBlock,
  Banner,
  LoadingBlock,
  ProviderIcon,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

import {
  downstreamVerdict,
  sourceFacts,
  type DataQualitySource,
} from "./data-quality-view-model";

type ClientIssue = {
  id: string;
  source: string;
  issue_type: string;
  description: string;
  severity: string;
  status: string;
};

type Payload = {
  sources: DataQualitySource[];
  summary: {
    evaluated: number;
    blocked: number;
    degraded: number;
    client_actionable: number;
  };
};

function SourceRow({ source }: { source: DataQualitySource }) {
  const verdict = downstreamVerdict(source);

  return (
    <li className="border-t border-default-200 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ProviderIcon provider={source.source} />
        <span className="font-medium">{source.dataset}</span>
        {source.organization_name ? (
          <span className="text-muted text-sm">{source.organization_name}</span>
        ) : null}
        <Badge tone={verdict.tone}>{verdict.label}</Badge>
      </div>

      <p className="text-muted mt-1 text-sm">{sourceFacts(source)}</p>

      {source.issues.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {source.issues.map((issue) => (
            <li key={issue.id} className="flex flex-wrap items-start gap-2 text-sm">
              <span>{issue.description}</span>
              {issue.client_actionable ? (
                // Separado a proposito: es lo unico de esta pantalla que el
                // consultor puede pedirle al cliente en vez de arreglar el.
                <Badge tone="brand">Lo arregla el cliente</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function DataQualityPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/data-quality")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        setData((await response.json()) as Payload);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar la calidad del dato por un error de red.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !data) {
    return <LoadingBlock label="Evaluando la calidad del dato..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!data) return null;

  const { summary } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calidad del dato</CardTitle>
        <CardDescription>{summary.evaluated === 0
          ? "Todavía no se ha evaluado ninguna fuente."
          : `${summary.evaluated} fuentes evaluadas · ${summary.blocked} bloquean el diagnóstico · ${summary.degraded} lo degradan.`}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.sources.length === 0 ? (
          <EmptyState
            title="Sin evaluaciones"
            hint="El motor de calidad de datos aún no ha pasado sobre estas organizaciones."
          />
        ) : (
          <ul>
            {data.sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * F3/D01, vista de CLIENTE. Otra regla y por eso otro componente.
 *
 * El consultor ve las evaluaciones enteras; el cliente ve solo lo que ocurre en
 * sus sistemas y ya esta verificado. Lo que se le pide es una accion concreta
 * suya -- reconectar, dar un permiso -- nunca un diagnostico a medias.
 *
 * Si no hay nada que pueda arreglar, no se pinta nada. Un modulo vacio que dice
 * "todo correcto" es ruido: le obliga a leer para enterarse de que no pasa nada.
 */
export function ClientDataQualityNotice({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const [issues, setIssues] = useState<ClientIssue[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    apiFetch(`/v1/organizations/${organizationId}/data-quality`)
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as { issues: ClientIssue[] };
        setIssues(payload.issues);
      })
      // En silencio a proposito: esto es un aviso adicional dentro de una
      // pantalla que ya funciona. Que falle no puede romper /integraciones.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (issues.length === 0) return null;

  return (
    <Banner tone="warn">
      <p className="font-medium">
        {issues.length === 1
          ? "Hay algo en tus sistemas que necesita tu mano"
          : `Hay ${issues.length} cosas en tus sistemas que necesitan tu mano`}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {issues.map((issue) => (
          <li key={issue.id}>{issue.description}</li>
        ))}
      </ul>
    </Banner>
  );
}
