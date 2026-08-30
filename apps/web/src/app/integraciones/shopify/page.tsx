"use client";

import { FormEvent, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { type BootstrapResponse } from "@/lib/bootstrap";
import {
  AsyncState,
  Banner,
  Button,
  Card,
  ErrorBlock,
  Input,
  Label,
  Radio,
  RadioGroup,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  LastErrorBanner,
  ProviderStatusCard,
  Steps,
  useIntegrations,
} from "../shared";

function ShopifyIntegrationPage({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { payload, provider, isLoading, error, actions, pending, actionError } =
    useIntegrations(bootstrap);
  const [shopDomain, setShopDomain] = useState("");
  const [appMode, setAppMode] = useState<"public" | "custom">("public");

  useEffect(() => {
    if (payload?.shopify_custom_app_available) setAppMode("custom");
  }, [payload?.shopify_custom_app_available]);

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando Shopify..." />;
  }
  if (error) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }

  const shopify = provider("shopify");
  if (!shopify) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <AsyncState
          status="empty"
          emptyTitle="Shopify no está disponible"
          emptyHint="Este conector no aparece en la configuración de esta organización."
        />
      </div>
    );
  }

  const configured = shopify.configuration.status === "configured";
  const canConnect = shopify.available && configured;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopDomain.trim()) return;
    await actions.connectShopify(shopDomain.trim(), appMode);
  }

  return (
    <div className="portal-page space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={shopify}>
        <p className="mt-3 text-sm leading-6 text-muted">
          Al autorizar una tienda se importan catálogo, inventario, pedidos y
          clientes, y se mantienen al día con webhooks y una reconciliación
          periódica.
        </p>
      </ProviderStatusCard>

      <Card
        title="Encontrar tu dominio .myshopify.com"
        description="No es el dominio público de tu web, sino el interno que Shopify asignó al crear la tienda y que nunca cambia."
      >
        <Steps
          items={[
            <>
              Abre el admin de tu tienda. En la URL verás{" "}
              <span className="font-mono">admin.shopify.com/store/TU-HANDLE</span>
              : tu dominio es{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span>.
            </>,
            <>
              O entra en{" "}
              <span className="font-medium">Configuración → Dominios</span>: ahí
              aparece el dominio <span className="font-mono">
                xxxx.myshopify.com
              </span>{" "}
              exacto.
            </>,
            <>
              Si al conectar ves una página de Shopify tipo{" "}
              <span className="italic">&laquo;This store will be right
              back&raquo;</span>
              , el dominio no corresponde a tu tienda activa: revisa el handle.
            </>,
          ]}
        />
      </Card>

      <Card title="Conectar la tienda">
        {!shopify.available ? (
          <Banner tone="warn">
            Shopify está desactivado por configuración. El administrador puede
            habilitarlo con{" "}
            <span className="font-mono">INTEGRATION_FEATURE_FLAGS</span>.
          </Banner>
        ) : !configured ? (
          <Banner tone="warn">
            Shopify está habilitado en la interfaz, pero faltan las credenciales
            de la app en el servidor. La conexión se activará automáticamente
            cuando estén completas.
          </Banner>
        ) : null}

        <Steps
          items={[
            <>
              Escribe el dominio{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span> abajo y
              pulsa <span className="font-medium">Conectar Shopify</span>.
            </>,
            <>
              En la pantalla de Shopify revisa los permisos y pulsa{" "}
              <span className="font-medium">Instalar</span> (necesitas ser owner
              o staff con permiso de apps, con la sesión de Shopify iniciada).
            </>,
            <>
              Vuelves aquí solo y la sincronización inicial arranca sola. Los
              datos aparecen en la sección Shopify en unos minutos.
            </>,
          ]}
        />

        {payload?.shopify_custom_app_available ? (
          <div className="mt-4">
            <RadioGroup
              value={appMode}
              onChange={(value) => setAppMode(value as "custom" | "public")}
            >
              <Label className="text-sm font-medium">App de Shopify a usar</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Radio value="custom">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    App personalizada (clientes reales, ya activa)
                  </Radio.Content>
                </Radio>
                <Radio value="public">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    App pública (pendiente de revisión de Shopify)
                  </Radio.Content>
                </Radio>
              </div>
            </RadioGroup>
            <p className="mt-1 text-xs text-muted">
              Usa la personalizada para conectar tiendas reales ahora. Cambia a
              la pública para clientes nuevos cuando pase la revisión.
            </p>
          </div>
        ) : null}

        <form className="mt-4 flex flex-col gap-3 md:flex-row" onSubmit={submit}>
          <Input
            className="min-w-0 flex-1"
            aria-label="Dominio .myshopify.com de la tienda"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="tu-tienda.myshopify.com"
            autoComplete="off"
            required
          />
          <Button
            type="submit"
            disabled={pending === "shopify" || !canConnect}
          >
            {pending === "shopify"
              ? "Conectando..."
              : shopify.connection
                ? "Reconectar Shopify"
                : "Conectar Shopify"}
          </Button>
        </form>
        {actionError ? (
          <Banner className="mt-3" tone="danger">
            {actionError}
          </Banner>
        ) : null}
      </Card>

      <LastErrorBanner
        provider={shopify}
        retrying={pending === "retry-shopify"}
        onRetry={
          shopify.connection
            ? () => void actions.retrySync("shopify", shopify.connection!.id)
            : undefined
        }
      />

      <Card title="Estado de la conexión">
        <ConnectionFacts provider={shopify} />
      </Card>
    </div>
  );
}

export default function ShopifyPage() {
  return (
    <PortalShell title="Integración · Shopify">
      {(bootstrap) => <ShopifyIntegrationPage bootstrap={bootstrap} />}
    </PortalShell>
  );
}
