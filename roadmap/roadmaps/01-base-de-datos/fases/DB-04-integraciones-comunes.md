# DB-04 - Integraciones comunes

## Estado

- **Estado real:** `blocked` (bloqueador propio del dominio, ver abajo — no de infraestructura: la migracion si esta aplicada).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** falta una maquina de estados de webhook explicita y una prueba real de idempotencia bajo concurrencia; sin eso no se puede demostrar el criterio de cierre "webhooks repetidos no ejecutan dos veces el mismo efecto".
- **Evidencia:**
  - Migracion `supabase/migrations/20260715151041_db_04_integraciones_comunes.sql` **si esta aplicada en remoto** (confirmado via `supabase migration list` el 2026-07-20) — la nota "push bloqueado por permisos" de la seccion "Avance 2026-07-15" de este documento esta obsoleta.
  - Bug real corregido 2026-07-20: `handleShopifyWebhookRequest` (`apps/api/src/shopify-webhook-handler.ts`) verificaba el HMAC solo contra el secret de la app publica, rechazando el 100% de los webhooks reales de una tienda instalada via app custom (dos secrets distintos). Ya prueba ambos.
  - `private.webhook_events` tiene indice unico por fingerprint (deduplicacion de la fila), y estados `received` -> `processed`/`failed`.
- **Gaps identificados:**
  - No hay una maquina de estados formal (`received -> verified -> processing -> processed -> retryable_failed -> dead_lettered -> ignored`), solo `received/processed/failed`.
  - Sin test que reciba dos webhooks identicos **concurrentes** y verifique que el efecto de negocio (no solo la fila) se aplica una sola vez.
  - Sin diseno de cifrado documentado para `private.integration_credentials` (algoritmo, envelope encryption, rotacion, `key_version`, comportamiento ante fallo de descifrado).
  - Sin locking documentado para refresh de tokens concurrente (dos workers refrescando el mismo token a la vez).
  - Sin politica de retencion/eliminacion de payloads crudos.
- **Siguiente accion:** disenar la maquina de estados de webhook y escribir el test de concurrencia antes de dar por cerrado el bloque.

## Objetivo

Crear el nucleo comun para OAuth, credenciales cifradas, sincronizaciones, webhooks e idempotencia.

## Tablas

- `integration_connections`
- `private.integration_credentials`
- `integration_sync_runs`
- `private.webhook_events`

## Entregables

- Estado de conexion por proveedor. Estado: migracion creada en `supabase/migrations/20260715151041_db_04_integraciones_comunes.sql`.
- Credenciales en schema privado. Estado: tabla `private.integration_credentials` definida, solo `service_role`.
- Registro de syncs con estado, fechas, errores y conteos. Estado: tabla `integration_sync_runs` definida.
- Deduplicacion de webhooks con ID externo o fingerprint. Estado: tabla `private.webhook_events` definida con indices unicos.

## Historial (obsoleto, conservado como registro)

- 2026-07-15: migracion creada localmente, push remoto bloqueado por permisos de Supabase Management API.
  **Resuelto** — la migracion esta aplicada en remoto desde entonces (ver seccion Estado).

## Criterios de cierre

- El frontend nunca puede leer credenciales. Estado: cubierto por schema privado y grants.
- Un sync puede reintentarse sin duplicar datos. Estado: cubierto por `idempotency_key`; falta probar.
- Webhooks repetidos quedan registrados sin ejecutar dos veces el mismo efecto. Estado: cubierto por indices unicos; falta probar.
