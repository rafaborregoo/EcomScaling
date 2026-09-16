# Whop: cobros y planes

Whop cobra; la plataforma no guarda un catalogo de planes. Una compra en Whop se
convierte en una fila de `service_subscriptions`, y de esa fila salen dos cosas
que ya existian antes (ADR-0023): **el rol** (consultor si tiene plan a su
nombre) y **el limite de tiendas**.

Codigo: `apps/api/src/whop.ts` (mapeo puro, con tests en `whop.test.ts`),
`whop-webhook-handler.ts` (recepcion) y `whop-checkout.ts` (abrir un checkout).

## Lo que hay que configurar en el dashboard de Whop

### 1. Metadata en cada plan

Sin esto un plan no dice nada sobre lo que da. En el plan, apartado de metadata:

| clave                     | valor                                                    | si falta                         |
| ------------------------- | -------------------------------------------------------- | -------------------------------- |
| `ecomscaling_plan_code`   | el codigo que se guarda en `plan_code` (ej. `consultor`) | se guarda el id del plan de Whop |
| `ecomscaling_store_limit` | maximo de conexiones Shopify activas (ej. `2`)           | **1**, el tramo mas pequeno      |

El limite cae a 1 a proposito: `NULL` en `store_limit` significa "sin limite"
para `assertStoreLimit`, y un plan mal rellenado regalaria tiendas ilimitadas.
Quien ha pagado entra igual; corregirlo es editar la metadata del plan.

### 2. Webhook

- URL: `https://api.ecomscaling.es/v1/whop/webhooks`
- Version de API: `v1`
- Eventos: `membership.activated`, `membership.deactivated`,
  `membership.cancel_at_period_end_changed`

Se pueden marcar mas eventos sin romper nada: los que no se procesan responden
200 con `ignored` (un 4xx haria que Whop reintentase para siempre).

El secreto (`whsec_...`) va en `WHOP_WEBHOOK_SECRET`.

### 3. Variables de entorno

```
WHOP_WEBHOOK_SECRET=whsec_...   # recibir altas y bajas de plan
WHOP_API_KEY=whop_...           # ademas, abrir checkouts desde la app
WHOP_API_VERSION_DATE=          # opcional, fija la version de la API por fecha
```

Solo con el secreto ya funciona el lazo entero. La API key hace falta para
`POST /v1/billing/whop/checkout`.

## Como se atribuye una compra

Por orden:

1. **Metadata del comprador**, que pone la plataforma al abrir el checkout
   (`ecomscaling_user_id` o `ecomscaling_organization_id`). Exacta.
2. **Correo del comprador**, si la compra empezo en un enlace de Whop suelto sin
   pasar por la app. Depende de que el correo de Whop sea el de la cuenta.

Si no se resuelve, el evento queda en `private.webhook_events` con estado
`failed`, su payload y el motivo. No se inventa a quien apuntarselo: una
suscripcion en la cuenta equivocada da acceso a la cartera de otro.

## Estados

| Whop                    | aqui                                   | por que                                                                                                      |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `trialing`              | `trial`                                |                                                                                                              |
| `active`                | `active`                               |                                                                                                              |
| `past_due`              | `active`                               | Whop sigue reintentando el cobro; cortar el acceso por una tarjeta caducada castiga algo que se arregla solo |
| `canceling`             | `active` + `ends_at` = fin del periodo | ha cancelado pero ha pagado hasta ahi; caduca sola                                                           |
| `canceled`              | `cancelled`                            |                                                                                                              |
| `expired` / `completed` | `expired`                              |                                                                                                              |
| `unresolved`            | `paused`                               |                                                                                                              |

Mientras la suscripcion esta viva **`ends_at` se queda nulo**. Poner el fin del
periodo de facturacion haria caducar el acceso de quien paga en cuanto pasara la
renovacion, si el webhook de renovacion se retrasara o se perdiera.

## Lo que esto cierra

ADR-0023 dejo escrito que "hoy nada mueve una suscripcion a `expired`". Esto es
lo que lo mueve: un plan que se cancela baja el rol solo, sin que nadie tenga
que acordarse.

Falta el aviso: hoy quien deja de pagar se queda sin cartera sin mas explicacion
que la que le demos. Va junto a la UI de planes.

## Lo que no esta hecho

- No hay UI de planes. `POST /v1/billing/whop/checkout` existe y devuelve
  `purchase_url`, pero no hay boton que lo llame.
- No se procesan eventos de pago (`payment.succeeded`, `payment.failed`): la
  membresia ya dice si el acceso sigue vivo. Cuando haga falta el historial de
  facturas, entran por ahi.
- El sandbox de Whop es otro entorno con sus propias claves. Sin usar todavia.
