# Shopify: datos protegidos de cliente (Nivel 2)

Qué exige Shopify para aprobar el acceso, qué tenemos ya y qué falta. Lo que
bloquea hoy `ecomscaling-dev` (ShopifyQL / sesiones) sale de aquí.

Fuente: [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
(consultado 2026-09-10).

## Por qué nos afecta si casi no guardamos PII

`shopifyqlQuery` **exige Nivel 2 aunque la consulta no pida datos de cliente**:
el acceso a Analytics es único, sin scopes granulares por entidad, así que
Shopify lo trata entero como Nivel 2. Nuestro `FROM sessions SHOW sessions,
online_store_visitors` no toca nombres ni emails y aun así cae ahí.

Es decir: la aprobación no se pide por lo que almacenamos, sino por la puerta
que usamos. Y sin ella, sesiones y tasa de conversión no llegan (en tiendas de
desarrollo tampoco, si la app no tiene declarado el uso en el Partner Dashboard).

## Qué guardamos hoy

Ayuda a la solicitud, porque Shopify aprueba "el mínimo necesario":

- `shopify_customers` guarda `customer_reference_hash`, contadores y estados de
  marketing — **no** nombre, email ni teléfono
  ([migración](../supabase/migrations/20260715200000_db_06_shopify_customers.sql)).
- La ubicación aproximada del cliente (ciudad, provincia, país) **ya no se pide
  ni se guarda**: no la leía nadie y era el único campo de la zona gris de
  Nivel 2 que tocábamos
  ([migración](../supabase/migrations/20260910120000_shopify_customers_drop_location.sql)).
  Lo que no se pide no hay que justificarlo en la solicitud ni protegerlo después.
- Pedidos y checkouts no almacenan email ni dirección de envío.
- `customers/data_request` no genera export automático porque no hay PII directa
  que devolver; queda registrado en `webhook_events`
  ([handler](../apps/api/src/shopify-webhook-handler.ts)).

## Nivel 1 — obligatorio también para Nivel 2

| Requisito | Estado |
|---|---|
| Procesar el mínimo de datos personales | **Cumple** — hash en vez de identidad; sin email/teléfono/dirección postal |
| Informar al merchant de qué datos y para qué | **Cumple** — [política de privacidad](../apps/web/src/app/politica-privacidad/page.tsx) publicada en `/politica-privacidad`, con el detalle exacto de qué se guarda del cliente final y qué no |
| Limitar el uso a los fines declarados | **Cumple** — fines declarados en la política de privacidad y en el [DPA](politicas/DPA_MERCHANTS.md) |
| Respetar decisiones de consentimiento del cliente | Parcial — guardamos `email_marketing_state` / `sms_marketing_state`, pero nadie los usa como filtro todavía |
| Respetar opt-out de compartición de datos | **Revisar** — no hay flujo explícito |
| Opt-out de decisiones automatizadas | **Revisar** — los agentes IA proponen, no deciden sobre personas; conviene dejarlo escrito |
| Acuerdos de privacidad con los merchants | Parcial — [borrador de DPA](politicas/DPA_MERCHANTS.md) escrito y verificado contra el código; **falta la revisión legal** antes de poder firmarlo |
| Periodos de retención aplicados | Parcial — hay retención de webhooks, transcripciones ([ADR-0016](decisions/ADR-0016-retencion-transcripciones-llamadas.md)) y audit logs ([ADR-0018](decisions/ADR-0018-retencion-audit-logs.md)), y purga por baja de organización; la retención de los datos de Shopify ya está declarada en [ADR-0022](decisions/ADR-0022-retencion-datos-shopify.md) |
| Cifrado en tránsito y en reposo | **Cumple** — TLS en API/web/Supabase; credenciales de integración cifradas antes de guardarse |

## Nivel 2 — además de lo anterior

| Requisito | Estado |
|---|---|
| Cifrar las copias de seguridad | Cumple vía proveedor (Supabase) — **falta** dejarlo escrito con quién y con qué política |
| Separar datos de test y producción | **Riesgo real** — el desarrollo local apunta al mismo proyecto Supabase y a tiendas reales; es exactamente lo que este requisito prohíbe |
| Estrategia de prevención de pérdida de datos (DLP) | **Cumple** — [documento](politicas/PREVENCION_PERDIDA_DE_DATOS.md); su punto abierto es separar desarrollo de producción |
| Limitar el acceso del personal a datos protegidos | **Cumple** — RLS por organización, roles, separación platform_admin/consultor y [política escrita](politicas/ACCESO_DEL_PERSONAL.md) con revisión trimestral |
| Contraseñas fuertes para las cuentas del equipo | **Falta** — medido el 2026-09-10: longitud mínima y requisitos de caracteres siguen en el defecto de Supabase (se cambian en el panel, no en el repo), y la protección de contraseñas filtradas está desactivada **y no es activable en plan free** (la organización lo está). Ver [política de acceso del personal](politicas/ACCESO_DEL_PERSONAL.md) |
| Registro de accesos a datos protegidos | **Cumple** — toda lectura de datos de cliente deja fila en `audit_logs` con acción `protected_data.*` ([protected-data-access.ts](../apps/api/src/protected-data-access.ts)), consultable en Administración → Auditoría filtrando por "Accesos a datos de cliente" |
| Política de respuesta a incidentes de seguridad | **Cumple** — [procedimiento escrito](politicas/RESPUESTA_A_INCIDENTES.md) con fases, plazos de notificación y contacto |

## Cómo se solicita

Partner Dashboard → Apps → (la app) → **API access requests** → *Protected
customer data access*: se pide el acceso, se marcan los campos protegidos que se
usan, se explica el motivo de cada uno y se rellenan los detalles de protección
de datos (las casillas de arriba). Shopify aprueba si lo pedido es el mínimo
necesario.

Detalles que cambian el trabajo:

- **App pública**: Nivel 1 y Nivel 2 pasan por revisión.
- **App personalizada**: ambos niveles están disponibles sin revisión (nuestra
  app custom heredada, [ADR-0011](decisions/ADR-0011-shopify-custom-distribution-temporal.md)).
- **Tiendas de desarrollo**: no hay revisión, pero **sí hay que declarar** en el
  Partner Dashboard qué datos usa la app. Si `ecomscaling-dev` sigue devolviendo
  *access denied* en ShopifyQL, esa declaración es lo primero que hay que mirar.

## Documentos de soporte

Escritos el 2026-09-10 contra el codigo real, no como declaracion de intenciones:

- [Retencion de los datos de Shopify (ADR-0022)](decisions/ADR-0022-retencion-datos-shopify.md)
- [Acceso del personal a datos de cliente](politicas/ACCESO_DEL_PERSONAL.md)
- [Respuesta a incidentes de seguridad](politicas/RESPUESTA_A_INCIDENTES.md)
- [Prevencion de perdida de datos (DLP)](politicas/PREVENCION_PERDIDA_DE_DATOS.md)
- [Acuerdo de tratamiento con merchants (borrador)](politicas/DPA_MERCHANTS.md)

## Orden sugerido

1. Declarar el uso de datos protegidos en el Partner Dashboard (desbloquea la
   tienda de desarrollo sin esperar revisión).
2. Separar entorno de desarrollo del de producción — el único punto que ninguna
   redacción arregla.
3. Escribir lo que ya hacemos: retención de datos de Shopify, acceso del
   personal, respuesta a incidentes, DLP.
4. Publicar política de privacidad y DPA para merchants.
5. Endurecer la política de contraseñas en Supabase Auth y añadir registro de
   accesos de lectura a datos de cliente.
