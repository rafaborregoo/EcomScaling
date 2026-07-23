# DB-04 - Integraciones comunes

## Estado

- **Estado real:** `verification_pending` (idempotencia de webhooks probada 2026-07-21; cifrado y locking
  de refresh documentados y el locking probado con test real 2026-07-23 — quedan gaps menores no
  bloqueantes).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion `supabase/migrations/20260715151041_db_04_integraciones_comunes.sql` **si esta aplicada en remoto** (confirmado via `supabase migration list` el 2026-07-20) — la nota "push bloqueado por permisos" de la seccion "Avance 2026-07-15" de este documento esta obsoleta.
  - Bug real corregido 2026-07-20: `handleShopifyWebhookRequest` (`apps/api/src/shopify-webhook-handler.ts`) verificaba el HMAC solo contra el secret de la app publica, rechazando el 100% de los webhooks reales de una tienda instalada via app custom (dos secrets distintos). Ya prueba ambos.
  - `private.webhook_events` tiene indice unico por fingerprint (deduplicacion de la fila), y estados `received` -> `processed`/`failed`.
  - **Test de concurrencia anadido y confirmado 2026-07-21**: `apps/api/src/db-04-webhook-idempotency.test.ts` dispara dos peticiones `handleShopifyWebhookRequest` identicas en paralelo (`Promise.all`, no secuencial) contra el Supabase remoto real y confirma exactamente un `processed` y un `duplicate`, con una sola fila en `webhook_events` para el fingerprint -- la garantia real es la constraint unica de Postgres serializando las dos inserciones, no un lock de aplicacion.
- **Resuelto 2026-07-23 (cifrado de credenciales)**: verificado contra `apps/api/src/shopify-oauth.ts`
  (`encryptShopifyCredential`/`decryptShopifyCredential`, reutilizadas tambien para credenciales de Meta
  pese al nombre). Diseno real: AES-256-GCM, clave = SHA-256 del secreto maestro (cadena de fallback
  `SUPABASE_JWT_SECRET ?? SUPABASE_SERVICE_ROLE_KEY ?? SHOPIFY_API_SECRET`, no una clave dedicada de KMS),
  IV aleatorio de 12 bytes por cada cifrado (nunca reutilizado), auth tag de GCM para integridad, payload
  final `iv || authTag || ciphertext` en base64. **No es envelope encryption real** (no hay DEK por fila
  cifrada con una KEK separada rotable) — `encryption_key_version` existe en el schema pero hoy solo toma
  el valor `'v1'`, no hay ningun codigo que lea ese campo para elegir entre claves distintas: es un campo
  preparado para rotacion futura, no una rotacion implementada. Fallo de descifrado (`decryptPayload`)
  se captura y devuelve `null`, no lanza — el llamador lo trata como `shopify_access_token_unavailable`,
  no como un crash.
- **Resuelto 2026-07-23 (locking de refresh concurrente)**: ya estaba implementado en
  `getValidShopifyAccessToken` (`shopify-token-store.ts`) — claim optimista con un `UPDATE` condicionado a
  `expires_at = <valor leido>` y (`refresh_locked_at` nulo o mas viejo que `CLAIM_STALE_MS` = 20s); si no
  se gana el claim, se espera `CLAIM_POLL_MS` (1.5s) y se reintenta hasta `CLAIM_POLL_ATTEMPTS` (4) veces
  antes de fallar con `shopify_token_refresh_contended`. La garantia real es que Postgres serializa dos
  `UPDATE` concurrentes sobre la misma fila, igual que en la idempotencia de webhooks. **Test nuevo**:
  `apps/api/src/db-04-token-refresh-claim.test.ts` dispara dos claims concurrentes reales contra Supabase
  remoto sobre la misma fila y confirma que exactamente uno gana (no se prueba `getValidShopifyAccessToken`
  completo porque el paso posterior llama a la API real de Shopify y no hay libreria de mocking HTTP en
  este paquete ni credenciales de sandbox en este entorno — se prueba la primitiva de claim en si, mismo
  patron de query).
- **Gaps identificados que siguen abiertos (de diseno, no de verificacion):**
  - No hay una maquina de estados formal (`received -> verified -> processing -> processed -> retryable_failed -> dead_lettered -> ignored`), solo `received/processed/failed`.
  - Sin politica de retencion/eliminacion de payloads crudos.
  - `encryption_key_version` esta preparado en el schema pero sin implementar: si algun dia se rota la
    clave maestra, hoy no hay forma de descifrar filas viejas cifradas con la clave anterior.
- **Siguiente accion:** decidir si vale la pena implementar rotacion real de `encryption_key_version` antes
  de piloto, o diferirlo (hoy no hay ningun incidente que lo exija).

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
- Un sync puede reintentarse sin duplicar datos. Estado: cubierto por `idempotency_key`; sin test de concurrencia propio (distinto del caso de webhooks, ya probado abajo).
- Webhooks repetidos quedan registrados sin ejecutar dos veces el mismo efecto. Estado: probado — `apps/api/src/db-04-webhook-idempotency.test.ts` (2026-07-21), ver seccion Estado.
