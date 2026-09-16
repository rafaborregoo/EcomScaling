# Stripe, la pasarela de cobro

> **Qué es esto.** Cómo se cobra en EcomScaling y qué hay que dejar
> configurado en Stripe para que funcione. Sustituye a `WHOP.md`, retirado el
> 2026-09-16 (ver [el porqué](#por-qué-no-whop)).
>
> **Relacionado:** [MODELO_PLANES_Y_VINCULACION.md](MODELO_PLANES_Y_VINCULACION.md),
> [ADR-0023](decisions/ADR-0023-el-rol-se-deriva-del-plan.md).

## La idea en una frase

Stripe cobra, manda un webhook, y el webhook escribe una fila en
`service_subscriptions`. **Todo lo demás de la plataforma lee esa fila y no
sabe quién cobra**: el rol (consultor o cliente), el límite de tiendas, la
capacidad de cartera y el saldo de tokens del copiloto salen de ahí.

Eso es lo que hizo barato cambiar de Whop a Stripe: nueve ficheros leen
`service_subscriptions` y ninguno tuvo que tocarse.

## Qué hay que dejar configurado en el dashboard

### 1. Un producto por plan, no un producto con muchos precios

Starter, Consultor y demás son **productos distintos**. El nombre del producto
es lo que sale en cada línea del checkout y de la factura: si todos los planes
cuelgan de un producto, el cliente ve el mismo nombre en todos y no distingue
qué ha comprado.

Varios precios en el mismo producto solo para variantes del MISMO plan
(mensual frente a anual, o distinta moneda).

### 2. La metadata va en el PRECIO

| Clave                     | Para qué                                | Ejemplo   |
| ------------------------- | --------------------------------------- | --------- |
| `ecomscaling_plan_code`   | El `plan_code` que se guarda en la fila | `starter` |
| `ecomscaling_store_limit` | Cuántas tiendas Shopify incluye         | `1`       |

**En el precio y no en el producto.** El webhook de suscripción trae el precio
entero dentro de cada item, pero del producto solo el id: con la metadata en el
producto habría que pedirlo por API en cada evento para saber cuántas tiendas
incluye.

Un precio sin `ecomscaling_store_limit` entra con **1 tienda**, no sin tope: en
`service_subscriptions` un `store_limit` nulo significa "sin límite", y un error
de dedo en el dashboard regalaría tiendas ilimitadas.

### 3. El webhook

- **URL:** `https://api.tudominio.com/v1/stripe/webhooks`
- **Eventos:**
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid` (emite la factura VERI\*FACTU)
  - `invoice.payment_failed` (registra el intento fallido; no corta el acceso durante los reintentos)
  - `charge.refunded` (emite la rectificativa)

Cualquier otro evento que se active de más recibe un `200 ignored`: un 4xx haría
que Stripe reintentara tres días algo que nunca vamos a procesar, y acabaría
desactivando el endpoint por fallos acumulados.

### 4. Las claves

```bash
STRIPE_SECRET_KEY=rk_live_...        # restringida, no la secreta
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2026-08-26.dahlia
```

**Usa una clave restringida (`rk_`)**, no la secreta (`sk_`). Debe poder leer
precios, facturas, pagos de factura, Payment Intents, cargos y transacciones de
saldo; crear sesiones de Checkout; y actualizar suscripciones para retirar el
descuento de vinculacion.

> **Trampa.** El `whsec_` de Stripe **no** es el `whsec_` de Standard Webhooks
> (Fathom). Stripe usa el secreto como texto plano con su prefijo incluido y
> firma en hex sobre `t.body`; Standard Webhooks decodifica base64 y firma en
> base64 sobre `id.timestamp.body`. Se llaman igual y no lo son: por eso viven
> en ficheros separados, `stripe-webhook.ts` y `standard-webhook.ts`.

## Cómo se atribuye una compra

Por orden de fiabilidad:

1. **La metadata de la suscripción.** La pone `stripe-checkout.ts` al abrir la
   sesión: `ecomscaling_user_id` o `ecomscaling_organization_id`. Es exacta
   porque la escribimos nosotros.
2. **El correo del comprador**, si la compra empezó en un Payment Link suelto
   sin pasar por la app.

Si no se resuelve, **no se inventa nada**: una suscripción colgada de la cuenta
equivocada da acceso a la cartera de otro. El evento queda como `failed` en
`private.webhook_events` con su payload, y se arregla a mano.

> La metadata va en `subscription_data[metadata]`, **no** en la de la sesión. La
> de la sesión solo viaja en `checkout.session.completed`; la de la suscripción
> viene en todos los `customer.subscription.*`. Ponerla solo en la sesión
> significa que la primera compra se atribuye y la primera renovación ya no.

## Estados

| Stripe               | Nosotros    | Por qué                                                                                                                |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `trialing`           | `trial`     |                                                                                                                        |
| `active`             | `active`    |                                                                                                                        |
| `past_due`           | `active`    | Stripe sigue reintentando el cobro. Cortar el acceso por una tarjeta caducada castiga un problema que se arregla solo. |
| `unpaid`, `paused`   | `paused`    | Stripe se rindió con el cobro pero la suscripción sigue existiendo.                                                    |
| `canceled`           | `cancelled` |                                                                                                                        |
| `incomplete_expired` | `expired`   | El primer pago nunca cuajó.                                                                                            |
| `incomplete`         | `pending`   | Primer pago en curso (3D Secure). Todavía no da acceso.                                                                |

**`ends_at` se queda nulo mientras la suscripción está viva.** Poner el fin del
periodo de facturación caducaría el acceso de quien paga si el webhook de la
renovación tardase o se perdiera. Solo se rellena cuando Stripe dice que eso se
acaba: al cancelar a fin de periodo, o al desactivar.

## Conceder un plan sin cobrar

`/admin/facturacion` concede planes a mano (un consultor de la casa, una
cortesía). Dos guardas:

- **No se puede conceder encima de un plan de pago de Stripe.** Stripe le
  seguiría cobrando y chocaría con el índice de "un plan vigente por sujeto".
  Se cancela en Stripe primero.
- **El límite de tiendas es obligatorio.** Omitirlo significaría "sin límite",
  que no puede ser un descuido.

## Desarrollo

Usa un **sandbox** de Stripe, no el modo de prueba compartido:

```bash
npm i -g @stripe/cli
stripe sandbox create
stripe listen --forward-to localhost:3000/v1/stripe/webhooks
```

`stripe listen` imprime un `whsec_` propio para el reenvío local: ese es el que
va en `.env.local`, no el del dashboard.

## Lo que no está hecho

- **Stripe Tax.** Hoy solo se recoge el NIF en el checkout
  (`tax_id_collection`). Para repercutir IVA europeo hace falta activar Stripe
  Tax **y tener un alta fiscal activa**: sin el alta, Stripe calcula 0 y no da
  ningún error, que es la forma más silenciosa de equivocarse con esto.
- **Customer Portal**, para que el cliente cambie de plan o cancele solo.
- **Reconciliación periódica.** Hoy el estado se mueve solo por webhook. Si uno
  se pierde durante una caída, la fila se queda vieja hasta el siguiente evento.

## Por qué no Whop

Whop era _merchant of record_: vendía él y el IVA europeo era suyo. Con
VERI\*FACTU emitiendo facturas propias, ser nosotros el vendedor pasó de carga a
requisito — Whop en medio estorbaba para eso.

Al cambiar no había nada que migrar: cero suscripciones, cero facturas y cero
eventos de Whop en producción.
