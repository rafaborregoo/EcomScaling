# ADR-0028 — Motor de notificaciones

Fecha: 2026-10-19 · Estado: aceptada · Origen: [docs/AUDITORIA_NOTIFICACIONES.md](../AUDITORIA_NOTIFICACIONES.md)

## Contexto

Cada módulo creaba sus avisos a mano con un `insert` en `notifications`: su propia lista de
destinatarios, su propio texto, su propio enlace. El resultado fue avisos que no decían qué había
pasado («ha cambiado lo que puedes hacer en su cuenta»), que no llevaban a ningún sitio donde
verlo, repetidos (cuatro seguidos por cuatro guardados), y tipos nuevos que caían en «Otros» sin
que nadie lo notara, así que no mandaban email.

## Decisión

Un motor por piezas. Todo aviso pasa por ellas; nada inserta en `notifications` directamente,
ni siquiera SQL.

| Pieza | Dónde | Qué decide |
|---|---|---|
| **Catálogo** | `packages/contracts/src/notification-catalog.ts` | Qué tipos existen; para cada uno: categoría de preferencias, etiqueta, explicación, a quién puede llegar. Lo leen la API, la campana y Configuración › Notificaciones. |
| **Plantillas** | `packages/contracts/src/notification-templates.ts` | Texto, destino, entidad y regla de agrupación de cada tipo, a partir de datos tipados (`NotificationData`). Funciones puras con test. |
| **Emisión** | `apps/api/src/notify.ts` → `notify({ type, data, recipients })` | A quién (helpers `consultantsOf`, `clientManagersOf`; nunca a quien actúa). El servicio solo aporta datos; tipo y datos están tipados contra el catálogo. |
| **Eventos de la base de datos** | `private.notification_outbox` → `notification-outbox.ts` (worker cada minuto) | Un trigger o función SQL no escribe avisos: deja un evento y la API lo emite con `notify()` (integraciones caídas y permisos de Meta por caducar). |
| **Agrupación** | `merge` de la plantilla | Si la persona ya tiene un aviso **sin leer** del mismo tipo y entidad, se reescribe ese y sube arriba en vez de crear otro (permisos, comentarios, mensajes). |
| **Entrega** | trigger `skip_muted_notification` (campana), `notification-email.ts` (email al momento o en el resumen), `mobile-push.ts` (push) | Respeta las preferencias por categoría y el horario de silencio. Las tres leen la misma fila. |
| **Destino** | `action_url` + `?focus=` + `components/focus-target.tsx` | La campana añade la tienda y `focus=<entity_id>`; la pantalla destino pone `data-focus-id` en la fila y el motor la desplaza a la vista y la ilumina. |

Avisos programados (no los dispara una acción): `notification-daily.ts`, a las 8:00 de Madrid
desde el worker (`notification-daily`): «Para hoy» y propuestas de la IA pendientes, uno al día por
tienda y persona, idempotente en el día.

### Reglas de copy

- Título = quién + qué, con nombres: la tienda para el consultor, el nombre de pila del consultor
  para el cliente. Nunca «Tu cliente» si se sabe cuál.
- Texto = el detalle (qué cambió, qué tareas, el motivo) o lo que hay que hacer. Nunca «revisa el
  resultado si quieres».
- Si no hay pantalla donde ver lo que pasó, se crea (ej. `/propuestas/<id>`, Configuración › Tus
  permisos) antes de mandar el aviso.

### Añadir un aviso nuevo

1. Tipo en el catálogo (categoría, etiqueta, explicación, audiencia).
2. El tipo en `private.notification_category` con una migración idempotente. El test del catálogo
   falla si falta.
3. La plantilla del tipo (texto, destino, entidad) y sus datos en `NotificationData`.
4. `notify({ type, data, ... })` desde el servicio que hace la acción. Si nace en SQL, un evento en `private.notification_outbox` y su rama en `notification-outbox.ts`.
5. `data-focus-id={id}` en la fila de la pantalla destino.

## Consecuencias

- Una sola forma de avisar; el copy y los destinos se revisan en pocos sitios.
- El consultor tiene dónde ver sus permisos (Configuración › Mi consultoría › Tus permisos, y por
  cliente en «Tus permisos aquí»), que es a lo que se refieren los avisos de permisos.

## Historial

`/notificaciones`: todos los avisos (no solo los 50 de la campana), por día, con filtros de estado,
tienda y clase, la explicación de cada tipo y archivar/recuperar. `GET /v1/notifications` acepta
`limit`, `before` (cursor), `organizationId` y `types`, y devuelve `next_before`.

## Permisos del consultor

El cliente (propietario) los decide en Configuración › «Tu consultor y sus permisos». El consultor
los ve, sin poder cambiarlos, en Mi consultoría › «Tus permisos» (toda la cartera) y en «Tus permisos
aquí» (el cliente abierto).
