"use client";

import { PortalShell } from "@/components/portal-shell";
import { type BootstrapResponse } from "@/lib/bootstrap";
import {
  AsyncState,
  Banner,
  Card,
  CollapsibleSection,
  ErrorBlock,
} from "@/components/ui";
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
    <div className="portal-page space-y-5 sm:space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={instagram}>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          Cuando esté disponible, conectará el rendimiento de contenido e
          insights de una cuenta profesional para completar la lectura de tus
          canales.
        </p>
      </ProviderStatusCard>

      <Card
        className="border border-channel-instagram"
        title="Esta conexión aún no está abierta"
        description="Preferimos esperar a que el acceso sea real antes que mostrar una conexión o métricas que no funcionan."
      >
        <Banner tone="warn">
          El conector está preparado pero no se activa aún: no se muestran
          métricas simuladas ni un botón de conexión prematuro.
        </Banner>
        <CollapsibleSection
          className="mt-5"
          title="Ver qué tendrá que estar listo"
        >
          <Steps
            items={[
              <>
                Una conexión de <span className="font-medium">Meta</span> válida
                (o Instagram Login) sobre una cuenta profesional de Instagram.
              </>,
              <>
                Los permisos de lectura de contenido e insights aprobados para
                esa cuenta.
              </>,
              <>
                Cuando estén, esta página habilitará la conexión y la
                sincronización real.
              </>,
            ]}
          />
        </CollapsibleSection>
      </Card>

      <CollapsibleSection title="Detalles técnicos de la conexión">
        <Card title="Detalles de la conexión">
          <ConnectionFacts provider={instagram} />
        </Card>
      </CollapsibleSection>
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
