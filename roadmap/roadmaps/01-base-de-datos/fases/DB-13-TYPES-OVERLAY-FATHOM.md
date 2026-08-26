# DB-13 - Overlay de tipos para Fathom y cola de webhooks

## Estado

`implemented_partial`: el contrato local cubre la migracion INT-04 sin alterar
el archivo generado por Supabase.

## Contrato

- `packages/db/src/fathom-webhook.types.ts` modela los estados de la cola,
  payload/headers/resultados JSON y los campos de claim/retry.
- El overlay tambien incorpora `consulting_calls.external_recording_id` y
  mantiene la idempotencia por organizacion.
- El test es estatico y de runtime; no necesita credenciales ni datos reales.

## Gate remoto

Cuando el MCP de Supabase tenga permisos: aplicar
`20260824180000_int_04_fathom_webhook_queue.sql`, ejecutar advisors, regenerar
`database.types.ts` con el typegen oficial y retirar este overlay solo despues
de comprobar que el typegen contiene exactamente estos campos.
