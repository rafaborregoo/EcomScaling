"use client";

import { PortalShell } from "@/components/portal-shell";
import { type BootstrapResponse } from "@/lib/bootstrap";
import {
  AsyncState,
  Banner,
  ErrorBlock,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  InfoModalButton,
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

      <ProviderStatusCard provider={instagram}>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          Cuando esté disponible, conectará el rendimiento de contenido e
          insights de una cuenta profesional para completar la lectura de tus
          canales.
        </p>
      </ProviderStatusCard>

      <Card className="border border-channel-instagram">
        <CardHeader>
          <CardTitle>Esta conexión aún no está abierta</CardTitle>
          <CardDescription>Preferimos esperar a que el acceso sea real antes que mostrar una conexión o métricas que no funcionan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Banner tone="warn">
            Instagram llegará pronto. Mientras tanto no enseñamos cifras de
            ejemplo.
          </Banner>
          <div className="mt-4">
            <InfoModalButton
              title="Requisitos para activar Instagram"
              label="Ver requisitos"
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
            </InfoModalButton>
          </div>
        </CardContent>
      </Card>

      <InfoModalButton title="Detalles técnicos de Instagram" label="Detalles técnicos">
          <ConnectionFacts provider={instagram} />
      </InfoModalButton>
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
