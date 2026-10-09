"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/bootstrap";
import { getSupabaseClient } from "@/lib/supabase";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Banner,
  BrandLogo,
  Button,
  Card,
  ErrorBlock,
  Heading,
  Input,
  LoadingBlock,
} from "@/components/ui";

type Plan = {
  id: string;
  title: string;
  description: string | null;
  formatted_price: string | null;
  billing_period_days: number | null;
  trial_period_days: number | null;
  plan_code: string | null;
  store_limit: number | null;
  member_limit: number | null;
};

function periodo(dias: number | null) {
  if (!dias) return null;
  if (dias === 30) return "al mes";
  if (dias === 365) return "al año";
  return `cada ${dias} días`;
}

function tiendas(limite: number | null) {
  if (limite === null) return "Tiendas sin límite";
  return `${limite} ${limite === 1 ? "tienda" : "tiendas"}`;
}

function usuarios(limite: number | null) {
  if (limite === null) return "Usuarios sin límite";
  return `${limite} ${limite === 1 ? "usuario incluido" : "usuarios incluidos"}`;
}

function PlanesContent() {
  const params = useSearchParams();
  const vuelveDePago = params.get("estado") === "listo";

  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [customerTaxId, setCustomerTaxId] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        // Primero la organizacion: el plan de un cliente cuelga de ella, nunca
        // de su usuario -- eso ultimo le convertiria en consultor (ADR-0023).
        // Es idempotente, asi que recargar la pagina no crea una segunda.
        // El nombre del negocio se escribio en /registro y vive en el metadata
        // del usuario. Sin pasarlo, la organizacion nacia llamandose como la
        // persona -- el fallback del backend, pensado para quien no lo dio.
        const {
          data: { session },
        } = await getSupabaseClient().auth.getSession();
        const businessName = session?.user.user_metadata?.business_name;
        // §16: si /registro lo trajo, este es el unico sitio donde se
        // consume -- la organizacion todavia no existe hasta esta llamada, y
        // es ahi (registro.ts) donde el codigo la vincula a la consultora.
        const inviteCode = session?.user.user_metadata?.pending_invite_code;
        // Codigo de referido: igual que el de invitacion, se consume al crear
        // la organizacion (registro.ts) y de ahi sale el descuento del checkout.
        const referralCode = session?.user.user_metadata?.pending_referral_code;
        const referralConsent =
          session?.user.user_metadata?.referral_contact_consent === true;

        const orgResponse = await apiFetch("/v1/mi-organizacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(typeof businessName === "string" && businessName.trim()
              ? { business_name: businessName.trim() }
              : {}),
            ...(typeof inviteCode === "string" && inviteCode.trim()
              ? { invite_code: inviteCode.trim() }
              : {}),
            ...(typeof referralCode === "string" && referralCode.trim()
              ? {
                  referral_code: referralCode.trim(),
                  referral_contact_consent: referralConsent,
                }
              : {}),
          }),
        });
        if (cancelado) return;
        if (!orgResponse.ok) {
          setError(await readApiError(orgResponse));
          return;
        }
        const org = (await orgResponse.json()) as { organization_id: string };
        if (cancelado) return;
        setOrganizationId(org.organization_id);

        const planesResponse = await apiFetch("/v1/billing/plans");
        if (cancelado) return;
        if (!planesResponse.ok) {
          setError(await readApiError(planesResponse));
          return;
        }
        const payload = (await planesResponse.json()) as { plans: Plan[] };
        if (cancelado) return;
        setPlanes(payload.plans);
      } catch {
        if (!cancelado) {
          setError("No se pudieron cargar los planes. Revisa la conexión.");
        }
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function contratar(plan: Plan) {
    setBusyPlanId(plan.id);
    setError(null);
    try {
      const response = await apiFetch("/v1/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_id: plan.id,
          organization_id: organizationId,
          ...(customerTaxId.trim()
            ? { customer_tax_id: customerTaxId.trim() }
            : {}),
          redirect_url: `${window.location.origin}/planes?estado=listo`,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const { purchase_url } = (await response.json()) as {
        purchase_url: string;
      };
      // Externa (checkout de Stripe): `assign` y no `href`, que el compilador de
      // React trata como mutar un global.
      window.location.assign(purchase_url);
    } catch {
      setError("No se pudo abrir el pago. Revisa la conexión.");
    } finally {
      setBusyPlanId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="mb-8">
        <BrandLogo />
        <Heading level={1}>Elige tu plan</Heading>
      </div>

      {vuelveDePago ? (
        <div className="mb-6">
          {/* El plan lo escribe el webhook de Stripe, no esta redireccion: puede
              tardar unos segundos en aparecer. Decirlo evita que recarguen
              pensando que el pago no ha entrado. */}
          <Banner tone="success">
            Pago recibido. Tu plan se activa en unos segundos —{" "}
            <a className="underline" href="/dashboard">
              ir al panel
            </a>
            .
          </Banner>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}

      {!planes && !error ? <LoadingBlock label="Cargando planes..." /> : null}

      {planes?.length === 0 ? (
        <Card title="Todavía no hay planes">
          <p className="text-sm leading-6 text-muted">
            Escríbenos y te damos acceso a mano mientras tanto.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {(planes ?? []).map((plan) => (
          <Card key={plan.id} title={plan.title}>
            <div className="grid gap-4">
              <div>
                <span className="text-2xl font-semibold">
                  {plan.formatted_price ?? "—"}
                </span>{" "}
                <span className="text-sm text-muted">
                  {periodo(plan.billing_period_days)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{tiendas(plan.store_limit)}</Badge>
                <Badge>{usuarios(plan.member_limit)}</Badge>
                {plan.trial_period_days ? (
                  <Badge tone="success">
                    {plan.trial_period_days} días de prueba
                  </Badge>
                ) : null}
              </div>

              {plan.description ? (
                <p className="text-sm leading-6 text-muted">
                  {plan.description}
                </p>
              ) : null}

              <div>
                <Button
                  disabled={busyPlanId !== null || !organizationId}
                  onClick={() => void contratar(plan)}
                >
                  {busyPlanId === plan.id ? "Abriendo pago..." : "Empezar"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card
        kicker="Datos de facturación"
        title="¿Necesitas factura con NIF?"
        description="El nombre y email se toman de tu cuenta. Puedes añadir aquí el NIF de tu empresa o actividad antes de pagar."
      >
        <div className="max-w-sm">
          <Input
            value={customerTaxId}
            onChange={(event) => setCustomerTaxId(event.target.value)}
            placeholder="NIF/CIF (opcional)"
          />
        </div>
      </Card>
    </main>
  );
}

export default function PlanesPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando planes..." />}>
      <PlanesContent />
    </Suspense>
  );
}
