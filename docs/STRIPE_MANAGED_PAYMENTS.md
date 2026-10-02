# Stripe Managed Payments: piloto

Este flujo está aislado de los precios comerciales existentes. Solo la
variable server-side `STRIPE_MANAGED_PAYMENTS_PRICE_ID` activa Managed Payments;
los demás precios siguen usando el Checkout y la facturación actuales.

## Producto de prueba creado

En la cuenta Stripe de test `Entorno de prueba de E-NORA`:

- Product: `prod_VLq3Rxt4Zr25Qb` (`Basic subscription`)
- Price: `price_1UL8N7ALkWlI3CKL9SvBrhgL` (USD 10 al mes)
- Tax code: `txcd_10103100`, tal como exige el blueprint

El precio todavía no tiene `ecomscaling_plan_code` ni `ecomscaling_store_limit`.
No lo ofrezcas a usuarios de producción hasta decidir su correspondencia con el
catálogo comercial; hoy la aplicación usa el ID de precio como código de plan de
respaldo y limita el acceso a una tienda.

## Configuración local

Añade estas variables al entorno local del API. Usa la clave restringida de
Stripe en test mode y el secreto que imprime `stripe listen`; no guardes claves
en el repositorio:

```dotenv
STRIPE_SECRET_KEY=rk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2026-08-26.dahlia
STRIPE_MANAGED_PAYMENTS_PRICE_ID=price_1UL8N7ALkWlI3CKL9SvBrhgL
```

Managed Payments usa `2026-08-26.preview` en la solicitud de Checkout para
incluir el parámetro `managed_payments[enabled]`; el resto de llamadas conserva
la versión configurada para el API.

## Webhooks locales

Desde la raíz del proyecto, ejecuta Stripe CLI y reenvía estos eventos al
endpoint existente. Copia el secreto temporal `whsec_...` de la CLI a
`STRIPE_WEBHOOK_SECRET` en el entorno del API:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,charge.refunded \
  --forward-to localhost:4000/v1/stripe/webhooks
```

`checkout.session.completed` y `checkout.session.async_payment_succeeded` se
guardan como snapshots en `private.webhook_events`. Los eventos
`customer.subscription.*` siguen siendo la fuente de acceso a la cuenta. Para
preparar una compra manual, abre el precio desde el endpoint autenticado
`POST /v1/billing/stripe/checkout`.

## Límites antes de producción

El blueprint usa `txcd_10103100`, que Stripe describe como SaaS descargable de
uso personal. E-NORA se presenta como software para comercios; confirma el código
fiscal adecuado antes de vender, probablemente dentro de SaaS para uso
empresarial o AIaaS empresarial, según lo que realmente reciba el comprador.
Managed Payments solo admite productos digitales automatizados; el servicio no
puede incluir consultoría humana. Stripe también debe aprobar la cuenta para
Managed Payments.

El handler omite la factura y rectificativa locales VERI*FACTU para los cobros
que identifica como Managed Payments, mientras mantiene las reglas actuales
para el resto de precios. Confirma con asesoría fiscal cómo encaja el modelo de
merchant of record con las obligaciones españolas VERI*FACTU antes de poner ese
precio en producción.

Fuentes oficiales: [elegibilidad de Managed Payments](https://docs.stripe.com/payments/managed-payments/eligibility), [configuración de Managed Payments](https://docs.stripe.com/payments/managed-payments/set-up).
