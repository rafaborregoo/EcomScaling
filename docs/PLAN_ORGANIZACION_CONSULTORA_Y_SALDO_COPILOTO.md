# Plan: organización consultora, vinculación y saldo del copiloto

> **Qué es esto.** El plan de obra para llevar a código
> [MODELO_PLANES_Y_VINCULACION.md](MODELO_PLANES_Y_VINCULACION.md), más el saldo
> de tokens del copiloto y el cambio de modelo.
>
> **Estado (2026-09-16).** Hechas las fases 1, 2, 3, 4 y 5. Las migraciones estan
> aplicadas en test **y en produccion**; el codigo sigue en el working tree,
> sin desplegar.
>
> | Fase                      | Estado                                  |
> | ------------------------- | --------------------------------------- |
> | 1 Organizacion consultora | hecha                                   |
> | 2 Capacidad y codigos     | hecha, incluido §16                     |
> | 3 Descuento del 10%       | hecha (cupón de Stripe, no plan aparte) |
> | 4 Saldo de tokens         | hecha                                   |
> | 5 Cambio de modelo        | hecha                                   |
> | 6 Facturacion por tramos  | no empezar hasta 1 y 2 desplegadas      |
>
> **Pendiente de despliegue:** `INVITE_CODE_SECRET` (minimo 16 caracteres) en
> `.env.local` y en `/opt/ecomscaling/.env.production`. Sin ella no se emiten
> codigos de vinculacion: la API responde 503 en vez de guardarlos en claro.
>
> **Deuda a borrar tras el despliegue:** las filas de `consultant_legacy`
> (20261022090000) y la columna `client_invites.code`, los dos puentes de
> compatibilidad con el codigo viejo.
>
> **Relacionado:** [STRIPE.md](STRIPE.md),
> [ADR-0023](decisions/ADR-0023-el-rol-se-deriva-del-plan.md).

## Orden y dependencias

```text
Fase 1  Organización consultora          <- bloquea 2, 3 y 6
Fase 2  Capacidad y códigos              <- bloquea 3
Fase 3  Descuento del 10%
Fase 6  Facturación por tramos

Fase 4  Saldo de tokens del copiloto     independiente
Fase 5  Cambio de modelo                 depende de 4
```

Las fases 4 y 5 **no dependen de las otras**. Si un mes hay más ganas de producto
que de fontanería, se pueden hacer primero sin dejar nada a medias.

---

## Fase 0 — Decisiones que faltan

No son trabajo, son respuestas. Cada una bloquea una fase, y descubrirlas a
mitad de la implementación es lo que convierte un plan en un retraso.

| #   | Pregunta                                                                                                                 | Recomendación                                                                                                    | Bloquea |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Las 2 tiendas propias del consultor, ¿cuelgan de la organización consultora o siguen siendo una organización por tienda? | De la consultora. Hoy `createOwnStore` crea una organización por tienda; hay que migrar las existentes.          | Fase 1  |
| 2   | ¿Un consultor puede además ser cliente vinculado de otra consultora?                                                     | No, al menos de momento (§47 del modelo). Una regla explícita evita el descuento circular.                       | Fase 2  |
| 3   | ¿El 10% se implementa como plan aparte en Stripe o como promo code de un solo uso?                                       | Plan aparte ("Starter vinculado"). Los promo codes de Stripe son cupones reutilizables, justo lo que §9 prohíbe. | Fase 3  |
| 4   | ¿Quién paga el saldo cuando un consultor usa el copiloto dentro de la tienda de un cliente?                              | El consultor. Se distingue con `accessSource`, que ya existe.                                                    | Fase 4  |
| 5   | ¿Cuántos tokens trae cada plan?                                                                                          | Ver Fase 4; con los datos de hoy, 1M al mes cuesta ~12 $ sobre 216 $ de ingreso.                                 | Fase 4  |

---

## Fase 1 — La organización consultora ✅

**Por qué primero.** Hoy `private.is_consultant` dice "tiene una suscripción a su
nombre". El modelo dice que la suscripción es de la organización consultora y los
consultores son miembros suyos. Mientras eso no cambie, no hay a qué colgar la
capacidad de cartera, ni los códigos, ni la facturación por tramos.

**Por qué es barato.** `private.is_consultant` solo lo llaman las otras cuatro
funciones de `private`. Ninguna policy lo menciona, ningún endpoint lo consulta.
Cambiar quién es consultor es cambiar el cuerpo de una función.

Y una organización consultora no necesita tablas nuevas: una fila de
`organizations` ya tiene miembros con roles, suscripción, tiendas y auditoría.
Lo que falta es decir de qué tipo es.

### Qué se toca

```text
supabase/migrations/<fecha>_organizacion_consultora.sql
  organizations            + kind ('client' por defecto | 'consulting')
  consultant_assignments   + consulting_organization_id
  private.is_consultant    cuerpo nuevo
  backfill + assert

apps/api/src/auth-context.ts    derivePlatformRole, mismo criterio
apps/api/src/consultant.ts      provisionConsultantAccount crea la consultora
```

`is_consultant` pasa de:

```sql
-- hoy
exists (select 1 from service_subscriptions where user_id = target and status in ('trial','active'))
```

a:

```sql
-- después
exists (
  select 1
  from organization_members m
  join organizations o on o.id = m.organization_id and o.kind = 'consulting'
  join service_subscriptions s on s.organization_id = o.id
  where m.user_id = target and m.is_active
    and s.status in ('trial','active')
    and (s.starts_at is null or s.starts_at <= now())
    and (s.ends_at is null or s.ends_at > now())
)
```

### Backfill

Por cada perfil que hoy es consultor: crear su organización consultora, meterle
como `owner`, y mover su suscripción de `user_id` a `organization_id`.

En producción son **4 perfiles y 1 organización**. Es el momento de hacerlo.

### Cómo sabemos que salió bien

El mismo patrón que `20261006090000`: dentro de la migración, comparar el
conjunto de organizaciones accesibles **antes y después** por cada usuario y
`raise exception` si difieren. Si alguien gana o pierde un acceso, la migración
no se aplica.

### Riesgo

`service_subscriptions.user_id` deja de usarse para el rol. No se borra en esta
fase: el `check` de sujeto único y la policy de "ver mi propia suscripción"
(`20261011090000`) siguen teniendo sentido, y borrarlo a la vez sería cambiar dos
cosas y no saber cuál rompió.

---

## Fase 2 — Capacidad de cartera y códigos de vinculación ✅

**Lo que ya existe y no hay que escribir.** `client_invites` (migración
`20260831120000`) ya hace código único, estados, caducidad y asociación a
organización y consultor. Y `accept_client_invite` **ya es atómico**: un
`update ... where status = 'pending'` con `if not found` es exactamente el
compare-and-swap que pide §19 del modelo, sin necesidad de `FOR UPDATE`.

### Qué falta de verdad

| Del modelo                 | Qué hay que hacer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §21, §51 hash del código   | `code_hash` (HMAC-SHA256) en vez de `code` en claro. Migración con rotación: se acepta el claro mientras queden códigos vivos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| §11, §12, §15 capacidad    | `capacidad = contratados - activos - códigos pendientes`. La comprobación va en la misma transacción que crea el código, o dos consultores generan a la vez y hay sobreventa.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| §26 atribución             | `captured_by_consultant_id` y `assigned_consultant_id` separados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| §16 dirección del flujo ✅ | Hecho (20261026090000). El código ya no crea nada: es suelto, sin organización ni email obligatorios. El consultor lo genera con `generateClientInviteCode`, el cliente se registra por su cuenta en `/registro` con su propia contraseña, y es `ensureOwnOrganization` (`registro.ts`) quien vincula la organización nueva a la consultora en la MISMA llamada que la crea, vía `link_client_invite` (atómico: código + asignación juntos). La invitación a un SEGUNDO miembro de un cliente ya existente (`inviteClientMember`) sigue el camino viejo — ahí sí hace falta el usuario de Auth sin contraseña, porque la organización ya existe. |
| §22 rate limiting          | El endpoint de validación necesita su propio límite, más estricto que el global de 120/min.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| §23, §53 mensajes          | Una sola respuesta para todos los fallos: "El código no es válido o ya no está disponible".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Cómo sabemos que salió bien

Un test que lance dos canjes del mismo código en paralelo y compruebe que uno
falla. Sin eso, la atomicidad es una intención.

---

## Fase 3 — El descuento del 10% ✅

**El problema.** Stripe tiene promo codes, pero son cupones reutilizables — lo que
§9 del modelo prohíbe expresamente.

**La salida.** Un plan aparte en Stripe ("Starter vinculado", 180 €) con la misma
metadata (`ecomscaling_plan_code`, `ecomscaling_store_limit`) más una marca de
que exige vinculación. El checkout (`stripe-checkout.ts`) elige plan según haya
vinculación activa o no.

**Y el descuento se deriva, no se guarda** (§30): si la vinculación termina, el
cliente pasa al plan estándar en la siguiente renovación. Eso es un cambio de
plan en Stripe, no un `update` nuestro — hay que decidir si se hace automático o
se avisa primero.

---

## Fase 4 — Saldo de tokens del copiloto ✅

**Por qué solo el copiloto.** Es la única superficie sin tope por uso. El cron de
diagnósticos ya está limitado por `AI_ORG_DAILY_RUN_CAP` (12/día) y el botón
"Actualizar ahora" por `AI_MANUAL_REFRESH_DAILY_CAP`. Los dispara el sistema y
son predecibles. El chat lo dispara una persona.

**La instrumentación ya está.** Cada ejecución del copiloto se graba en
`agent_runs` con `trigger_type: "chat"`, `organization_id`, `actor_user_id`,
`input_tokens`, `output_tokens` y `cache_read_tokens`
([ai-runtime.ts:9715](../apps/api/src/ai-runtime.ts#L9715)). El saldo es una resta
sobre lo que ya se guarda.

### Qué cuenta y qué no

**Entrada + salida. Los tokens de caché NO.**

Con los datos de hoy la media de `cache_read` es 6.286 por mensaje, más que los
de entrada (3.358). Meterlos en el saldo **partiría la cuota por la mitad** por
algo que cuesta una décima parte. No es generosidad: es que el número reflejaría
mal el coste.

### Dimensionar

Datos reales de producción — **solo 3 mensajes de copiloto**, así que son
indicativos, no ley:

```text
media por mensaje:  3.358 entrada + 1.940 salida = 5.299 tokens facturables
máximo:                                            10.474
coste medio:                                       0,065 $
```

| Saldo | Mensajes aprox. | Coste tuyo | Sobre 200 € |
| ----- | --------------- | ---------- | ----------- |
| 333k  | ~63 (2/día)     | ~4 $       | 1,9 %       |
| 1M    | ~190 (6/día)    | ~12 $      | 5,7 %       |

333k para algo que se vende como "Copiloto 24/7" se queda corto. El saldo que no
se gasta no cuesta nada; el que se gasta vende el plan de arriba.

### Qué se toca

```text
supabase/migrations/<fecha>_saldo_copiloto.sql
  copilot_token_grants   sujeto (org o usuario), periodo, tokens_incluidos
  -- el consumo NO se duplica: se suma de agent_runs

apps/api/src/copilot-balance.ts   saldo, consumo y decisión al quedarse a cero
apps/api/src/ai-runtime.ts        comprobar saldo antes del turno de chat
apps/api/src/server.ts            GET  /v1/organizations/:id/copilot-balance
```

El consumo **no se guarda aparte**. Sumarlo de `agent_runs` es más lento y es
correcto siempre; un contador paralelo se desincroniza el día que un run falle a
medias. Si algún día pesa, se cachea — no al revés.

### De quién es el saldo

Del `accessSource` de quien pregunta, que `resolveAuthContext` ya calcula:

- `"consultant_assignment"` → entra como consultor → paga **su** saldo.
- `"membership"` → es gente del cliente → paga el **del cliente**.

Sin esto, un consultor trabajando sobre la tienda de un cliente le gasta al
cliente lo que el cliente pagó.

### Al llegar a cero

**No cortar: bajar a Haiku 4.5 hasta fin de mes.** Un copiloto que deja de
responder es un motivo de baja; uno que responde peor es un motivo para subir de
plan. El routing ya existe (`AI_MODEL_ROUTING_JSON`), así que es configuración.

### La UI

En `Drawer.Footer` de
[copilot-panel.tsx](../apps/web/src/components/copilot-panel.tsx), encima del
formulario:

**El número que se ve es lo que queda, y baja.** Arranca el mes en `1.000.000` y
después de cada respuesta muestra el nuevo saldo. Nada de porcentajes ni barras:
el usuario ve el contador bajar, que es justo lo que pidió.

```text
┌──────────────────────────────────────────────┐
│  [ ¿por qué han bajado los pedidos?  ] [Enviar] │
│  ● 1.000.000 tokens                           │   <- al empezar el mes
│  ● 742.310 tokens                             │   <- tras unas preguntas
└──────────────────────────────────────────────┘
```

Al pulsar, un mensaje corto (popover) que explique el número:

- qué es el saldo y que se renueva el día N;
- cuántos mensajes salen aproximadamente con lo que queda;
- qué pasa al llegar a cero (baja a Haiku, no se corta);
- enlace a subir de plan.

Cuatro frases, no un manual: el popover existe porque un número suelto en
pantalla da más preguntas de las que responde.

El saldo se devuelve **en la respuesta del chat**, no en una petición aparte: ya
hay un viaje al servidor por mensaje y el número cambia justo entonces. Una sola
lectura al abrir el panel para pintar el estado inicial.

---

## Fase 5 — Cambio de modelo ✅

**Dos modelos, no tres: Sonnet 5 por defecto y Opus 5 para pensar más.**

Haiku 4.5 no como opción del usuario — nadie elige a sabiendas el modelo peor —
sino como el modo degradado de la Fase 4. Así cada modelo tiene un papel que se
explica en una frase.

**Y el modelo disponible depende del plan, no del capricho.** Si los 1M de tokens
valen lo mismo en Opus que en Sonnet, un usuario en Opus te cuesta varias veces
más por el mismo número en pantalla. Con Opus atado al plan de arriba, el
contador sigue siendo honesto —un token es un token— y tu coste por plan es
predecible.

```text
apps/api/src/ai-runtime.ts    aceptar modelo por turno, validarlo contra el plan
apps/web/src/components/copilot-panel.tsx   selector junto al saldo
```

El selector va **al lado del saldo**, no en un menú de ajustes: son la misma
decisión.

---

## Fase 6 — Facturación por tramos y snapshots

Los tramos (§4: 100 → 80 → 50 €/cliente) y los extras de consultor y tienda
propia no son un plan fijo de Stripe: son una cantidad que cambia cada vez que
entra o sale un cliente.

Hace falta:

- `billing_snapshots` (§34): clientes activos, consultores, tiendas propias e
  importe calculado, con fecha. La factura no puede depender del estado mutable
  de hoy.
- Definir "cliente activo" (§33) en una sola función SQL, como
  `billable_store_count`, para que el límite, la factura y lo que ve el consultor
  salgan del mismo sitio.
- Prorrateo (§35).

Esta fase es la que más depende de cómo modele Stripe las cantidades variables. No
empezarla hasta tener las fases 1 y 2 en producción y un consultor real pagando.

---

## Anexo — Qué se puede configurar en Stripe desde la API

Todo el catálogo se crea por API, así que los planes de §6 del modelo pueden
vivir en un script del repo en vez de a mano en el dashboard:

| Qué                       | Cómo                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| Productos                 | `POST /v1/products`                                                 |
| Precios (con su metadata) | `POST /v1/prices`                                                   |
| Cupones y promociones     | `POST /v1/coupons` + `/v1/promotion_codes`                          |
| Webhooks                  | `POST /v1/webhook_endpoints` — devuelve el `secret` solo al crearlo |
| Checkout                  | `POST /v1/checkout/sessions` — ya implementado                      |

Un precio **no se edita**: en Stripe son inmutables salvo la metadata y el
nickname. Cambiar un importe es crear un precio nuevo y archivar el viejo, que
sigue cobrando a quien ya lo tiene. Eso es una función, no un bug: nadie ve su
cuota subir sin firmarlo.

**Hace falta Rafa (cuenta, no API):** alta y verificación de la cuenta, cuenta
bancaria de cobro, el alta fiscal de Stripe Tax si se va a repercutir IVA, y
pegar las claves en `.env.local` y en `/opt/ecomscaling/.env.production`.
