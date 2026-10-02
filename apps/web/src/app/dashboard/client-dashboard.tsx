"use client";

import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { EmptyState, LoadingBlock } from "@/components/ui";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { useUrlSection } from "@/lib/use-url-section";
import { ClientPulse } from "./client-pulse";
import { ClientShopify } from "./client-shopify";
import { ClientMeta } from "./client-meta";
import { ClientKlaviyo } from "./client-klaviyo";

const CLIENT_DASHBOARD_TABS = ["todo", "shopify", "meta", "klaviyo"] as const;

/**
 * El panel del cliente.
 *
 * Antes era el panel del consultor con tres cosas tapadas: el mismo
 * `DashboardContent`, las mismas pestañas, y hasta un `<ConsultantAgenda>`
 * incrustado. Pero las dos vistas responden preguntas distintas:
 *
 *   consultor -> "¿qué cliente necesita mi atención y qué hago hoy?"
 *   cliente   -> "¿cómo va mi tienda y qué tengo que hacer?"
 *
 * Y hay un segundo eje: **si el cliente tiene consultor o no**. Sin consultor,
 * los agentes son su acompañamiento, no un extra. El orquestador ya los
 * ejecutaba dos veces al día para todas las organizaciones; lo que faltaba era
 * que llegaran a alguien.
 */

export function ClientDashboard({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [activeTab] = useUrlSection(
    "tab",
    CLIENT_DASHBOARD_TABS,
    "todo",
  );
  const organization = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  )?.organization;

  // La forma del panel depende de si hay consultor, así que no se pinta nada
  // definitivo hasta saberlo: cambiar de forma delante del usuario es peor
  // que esperar medio segundo más.
  const { consultant, resolved: consultantResolved } =
    useAssignedConsultant(organizationId ?? null);
  const resolved = consultantResolved;

  if (!organizationId || !organization) {
    return (
      <div className="portal-page">
        <EmptyState
          title="Sin tienda todavía"
          hint="Cuando se te asigne una tienda, aquí verás cómo va."
        />
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando tu tienda…" />
      </div>
    );
  }

  // El segundo nav del Dashboard es la navegación de estas cuatro vistas. El
  // Resumen por proveedor: el Dashboard sirve para decidir, no para duplicar
  // la analítica exhaustiva, que vive en el módulo Analítica.
  if (activeTab === "shopify") {
    return (
      <ClientShopify
        organizationId={organizationId}
        organizationName={organization.display_name}
        connectionId={connectionId || null}
        userId={bootstrap.user.id}
        consultant={consultant}
      />
    );
  }

  if (activeTab === "meta") {
    return (
      <ClientMeta
        organizationId={organizationId}
        organizationName={organization.display_name}
        connectionId={connectionId || null}
        userId={bootstrap.user.id}
        consultant={consultant}
      />
    );
  }

  if (activeTab === "klaviyo") {
    return (
      <ClientKlaviyo
        organizationId={organizationId}
        organizationName={organization.display_name}
        connectionId={connectionId || null}
        hasConsultant={Boolean(consultant)}
      />
    );
  }

  // La portada es la vista "Pulso": titular, curva, cifras y lo accionable
  // (propuestas de la IA, tareas, consultor/copiloto). Sin consultor, el
  // análisis de email entra también en sus propuestas: los agentes SON el
  // acompañamiento.
  return (
    <ClientPulse
      userId={bootstrap.user.id}
      organizationId={organizationId}
      organizationName={organization.display_name}
      connectionId={connectionId || null}
      consultant={consultant}
    />
  );
}
