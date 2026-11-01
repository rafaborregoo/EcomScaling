"use client";

import { useRouter } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import {
  ButtonLink,
  EmptyState,
  Heading,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { useMarketingPortal } from "../marketing-portal-context";
import { TemplateLibrary } from "../template-library";
import { SYSTEM_TEMPLATES } from "../studio/studio-design";

function TemplateLibraryPage({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const router = useRouter();
  const { organizationId } = useActiveOrganization();
  const membership = bootstrap.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  const canView =
    ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ||
    ["owner", "manager"].includes(membership?.role ?? "");

  return (
    <div className="portal-page marketing-workspace space-y-7">
      <header className="mkt-page-header">
        <div className="min-w-0">
          <Heading size="lg" className="mkt-page-title">
            Biblioteca de plantillas
          </Heading>
          <p className="mkt-page-description">
            Diseños propios y referencias de Klaviyo, con su historial y resultados atribuibles.
          </p>
        </div>
        {organizationId ? (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/marketing?section=crear" variant="secondary">
              Crear un email
            </ButtonLink>
          </div>
        ) : null}
      </header>

      {!organizationId ? (
        <EmptyState
          title="Selecciona una tienda"
          hint="La biblioteca pertenece a cada marca. Usa el selector de cliente de la barra superior para abrir la biblioteca correspondiente."
        />
      ) : !canView ? (
        <EmptyState
          title="Sin acceso a la biblioteca"
          hint="Necesitas ser propietario, manager, consultor o administrador de plataforma."
        />
      ) : (
        <>
        <section className="grid gap-3" aria-labelledby="nora-templates">
          <h2 id="nora-templates" className="text-base font-semibold">Plantillas de NORA</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SYSTEM_TEMPLATES.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ButtonLink href={`/marketing?section=crear&system=${template.id}`} variant="secondary">
                    Usar esta plantilla
                  </ButtonLink>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <TemplateLibrary
          organizationId={organizationId}
          isOpen
          onUseTemplate={(template) => {
            window.sessionStorage.setItem(
              "e-nora:marketing:reference-template",
              JSON.stringify({
                id: template.id,
                name: template.template_name,
                subject: template.subject,
                design: template.request?.design,
              }),
            );
            router.push(
              `/marketing?section=crear&reference=${encodeURIComponent(template.id)}`,
            );
          }}
        />
        </>
      )}
    </div>
  );
}

export default function MarketingTemplatesPage() {
  const { bootstrap } = useMarketingPortal();
  return <TemplateLibraryPage bootstrap={bootstrap} />;
}
