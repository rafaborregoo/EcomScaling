# RB-004 - Webhook duplicado o backlog acumulado

## Sintoma

Dos casos distintos bajo el mismo runbook, porque comparten la misma tabla de diagnostico
(`private.webhook_events`):

- **Duplicado**: un efecto de negocio (ej. una alerta, un cambio de estado) se disparo dos veces para el
  mismo evento real de Shopify/Meta.
- **Backlog**: webhooks se acumulan en `status = 'received'` sin pasar a `processed`/`ignored_duplicate`/
  `failed` — el dato del cliente se queda desactualizado aunque el webhook si llego.

## Impacto

- Duplicado: efectos de negocio repetidos (tareas duplicadas, notificaciones repetidas al cliente) —
  molesto pero no destructivo, ya que la mayoria de escrituras de dominio son upsert (ver
  ADR-0006-integration-module-pattern.md).
- Backlog: mismo impacto que RB-001 (datos desactualizados) pero mas silencioso — la conexion puede seguir
  en `status = 'connected'` mientras los webhooks individuales se quedan atascados, asi que no salta la
  misma señal que un sync fallido.

## Severidad

- **SEV-3** si es un duplicado aislado sin efecto visible para el cliente.
- **SEV-2** si el backlog supera unas pocas horas para una tienda, o si el duplicado si genero un efecto
  visible (tarea repetida, notificacion repetida).
- **SEV-1** solo si el backlog es generalizado (varias tiendas/organizaciones a la vez) — señal de un fallo
  de plataforma, no de una tienda.

## Comprobaciones iniciales

1. Estado reciente de webhooks para la tienda/conexion afectada:
   ```sql
   select topic, status, external_event_id, fingerprint, signature_valid, received_at, processed_at, error_message
   from private.webhook_events
   where connection_id = '<connection_id>'
   order by received_at desc
   limit 30;
   ```

2. Para un duplicado sospechado: buscar filas con el mismo `fingerprint` (deberia haber una sola fila
   `processed` por fingerprint, el resto `ignored_duplicate` — el indice unico de `fingerprint` en
   `private.webhook_events` es la garantia real, no el codigo de aplicacion):
   ```sql
   select fingerprint, count(*), array_agg(status), array_agg(id)
   from private.webhook_events
   where connection_id = '<connection_id>'
   group by fingerprint
   having count(*) > 1
   order by count(*) desc;
   ```
   Si esta consulta devuelve mas de una fila **no** `ignored_duplicate` para el mismo `fingerprint`, es una
   fuga real del indice unico o un bug de como se calcula el fingerprint (ver Diagnostico) — no deberia
   pasar nunca, `db-04-webhook-idempotency.test.ts` prueba justo este invariante con dos peticiones
   concurrentes reales.

3. Para un backlog sospechado: contar cuantas filas llevan mucho tiempo en `received` sin avanzar:
   ```sql
   select connection_id, count(*), min(received_at) as oldest
   from private.webhook_events
   where status = 'received' and received_at < now() - interval '30 minutes'
   group by connection_id
   order by count(*) desc;
   ```
   **No existe todavia una alerta automatica para esto** (ver Prevencion) — hoy solo se detecta corriendo
   esta consulta a mano o porque el cliente reporta datos desactualizados.

## Diagnostico

- **Duplicado con `signature_valid = false` en alguna de las filas**: revisar si la tienda esta en app
  custom vs publica (dos secrets HMAC distintos, ver RB-001 punto de "webhook_events con signature_valid
  false") — un webhook que falla la verificacion de firma no debería generar efecto de negocio, pero si
  puede reintentarse por Shopify y crear ruido en la tabla si el fingerprint no es estable entre
  reintentos.
- **Duplicado real (mismo fingerprint, mas de una fila no-`ignored_duplicate`)**: revisar
  `handleShopifyWebhookRequest` (`apps/api/src/shopify-webhook-handler.ts`) — el fingerprint se calcula
  como hash del body crudo (`crypto.createHash("sha256").update(rawBody)...`); si Shopify reintenta con un
  payload con timestamps o campos variables incluidos en el hash, dos entregas del "mismo" evento logico
  podrian generar fingerprints distintos y no deduplicar. Confirmar comparando los `payload` de las filas
  con el mismo `external_event_id` pero distinto `fingerprint`.
- **Backlog con `error_message` poblado**: el handler fallo al procesar, no es que este esperando —
  tratar como un fallo puntual (ver Acciones), no como que "todavia no le toca".
- **Backlog sin `error_message`, atascado en `received`**: posible caida del proceso a mitad de la
  ejecucion sincrona del handler (los webhooks de Shopify se procesan en la misma request HTTP, no via
  cola, ver `shopify-webhook-handler.ts`) — no hay reintento automatico de un webhook que se quedo en
  `received` sin fallar explicitamente, distinto del caso de sync (que si tiene reconciliacion periodica,
  ver RB-001). La reconciliacion horaria (`shopify-reconcile.yml`, R-019) recupera el dato por otra via
  (comparando `updated_at` contra Shopify), pero no marca la fila de `webhook_events` como resuelta.

## Acciones

1. **Duplicado con efecto de negocio real**: identificar el efecto duplicado (tarea, notificacion, alerta)
   por `metadata`/timestamps cercanos y decidir si se elimina manualmente el duplicado o se deja (depende
   de si es visible para el cliente). Nunca borrar la fila de `webhook_events` en si — es la evidencia del
   incidente.
2. **Backlog puntual (pocas filas, una tienda)**: la reconciliacion horaria/diaria ya cubre el dato real
   (Shopify), asi que el impacto de negocio puede resolverse solo esperando al proximo ciclo; si es
   urgente, disparar `reconcileAllShopifyConnections(env)` manualmente (mismo camino que RB-001).
3. **Backlog generalizado**: revisar si el proceso de API esta caido o degradado (ver `/health/ready`,
   BE-00) antes de asumir que es un problema especifico de webhooks — un backlog masivo simultaneo suele
   ser sintoma de un problema de infraestructura, no de logica de webhooks.
4. Si el fingerprint resulta no ser estable entre reintentos de Shopify (bug real, no solo backlog), es un
   fix de codigo en `shopify-webhook-handler.ts`, no una accion operativa — anadir un test de regresion con
   el payload real que expuso el problema.

## Rollback

No aplica — igual que RB-001, el procesamiento de webhooks es idempotente por diseño (upsert por
`external_*_id`). Reprocesar manualmente un webhook (si hiciera falta) no duplica datos de dominio, aunque
si podria duplicar la fila de `webhook_events` en si si se reenvia con un payload identico bajo un
fingerprint distinto (ver Diagnostico).

## Validacion de recuperacion

- La consulta de backlog del paso 3 (Comprobaciones iniciales) vuelve vacia para la conexion afectada.
- La consulta de duplicados del paso 2 no devuelve mas de una fila no-`ignored_duplicate` por fingerprint.
- El dato de negocio afectado (pedido, producto, stock) coincide con el Admin de Shopify tras la
  reconciliacion.

## Comunicacion al cliente

Solo si el backlog/duplicado tuvo un efecto visible para el cliente (dato desactualizado mas de una hora
notable, tarea/notificacion duplicada) — mismo criterio que RB-001.

## Escalado

Igual que el resto de runbooks: sin guardia formal (R-018). Si el backlog es generalizado (varias
organizaciones a la vez) tratar como incidente de plataforma, no repetir el diagnostico tienda por tienda.

## Evidencias a conservar

Las filas de `webhook_events` involucradas (fingerprint, status, payload, error_message), el resultado de
la reconciliacion manual si se disparo, y si fue un bug de fingerprint, el payload exacto que lo expuso
para el test de regresion.

## Prevencion

**Resuelto 2026-07-29**: `runOpsHealthCheck` (`apps/api/src/ops-health-check.ts`) ahora incluye el chequeo
que faltaba aqui -- consulta `private.webhook_events` con `status = 'received'` y `received_at` con mas de
30 minutos (mismo umbral que la consulta manual del paso 3 de "Comprobaciones iniciales"), agrupa por
conexion en memoria (Supabase-js no soporta `group by` en la query) y emite un finding `webhook_backlog` por
conexion afectada con el conteo y el mas antiguo. Corre en el mismo cron que ya cubria tokens expirados y
purgas pendientes (`.github/workflows/ops-health-check.yml`, sin cambios necesarios ahi — el workflow ya
reporta genericamente cualquier finding que devuelva `runOpsHealthCheck`). Verificado contra Supabase remoto
real (sin backlog en los datos de prueba, 0 findings de este tipo, sin excepciones). La deduplicacion en si
(`db-04-webhook-idempotency.test.ts`, 2026-07-21) ya estaba probada con concurrencia real y seguia sin ser
el punto debil; el punto debil era la falta de visibilidad proactiva del backlog, que es lo que se cierra
aqui.
