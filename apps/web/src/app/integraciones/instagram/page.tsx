"use client";

import { PortalShell } from "@/components/portal-shell";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { AsyncState, Banner, Card, ErrorBlock } from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  ProviderStatusCard,
  Steps,
  useIntegrations,
} from "../shared";

function InstagramIntegrationPage({
  bootstrap,
}: {
  bootstrap: BootstrapResponse;
}) {
  const { provider, isLoading, error } = useIntegrations(bootstrap);
  const instagram = provider("instagram");

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando Instagram..." />;
  }
  if (error) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!instagram) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <AsyncState
          status="empty"
          emptyTitle="Instagram no está disponible"
          emptyHint="Este conector no aparece en la configuración de esta organización."
        />
      </div>
    );
  }

  return (
    <div className="portal-page space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={instagram} />

      <Card title="Todavía no disponible">
        <Banner tone="warn">
          El conector está preparado pero no se activa aún: no se muestran
          métricas simuladas ni un botón de conexión prematuro.
        </Banner>
        <p className="mt-3 text-sm font-medium text-ink">Qué hace falta</p>
        <Steps
          items={[
            <>
              Una conexión de <span className="font-medium">Meta</span> válida (o
              Instagram Login) sobre una cuenta profesional de Instagram.
            </>,
            <>
              Los permisos de lectura de contenido e insights aprobados para esa
              cuenta.
            </>,
            <>
              Cuando estén, esta página habilitará la conexión y la
              sincronización real.
            </>,
          ]}
        />
      </Card>

      <Card title="Estado de la conexión">
        <ConnectionFacts provider={instagram} />
      </Card>
    </div>
  );
}

export default function InstagramPage() {
  return (
    <PortalShell title="Integración · Instagram">
      {(bootstrap) => <InstagramIntegrationPage bootstrap={bootstrap} />}
    </PortalShell>
  );
}
