# DB-04 - Integraciones comunes

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

## Avance 2026-07-15

- Migracion DB-04 creada localmente.
- Push remoto bloqueado por permisos de Supabase Management API; la CLI pide `SUPABASE_DB_PASSWORD`.
- RLS definido en tablas publicas; credenciales y payloads crudos permanecen en schema `private`.
- Seed preparado para crear conexion Shopify demo cuando la migracion exista.

## Criterios de cierre

- El frontend nunca puede leer credenciales. Estado: cubierto por schema privado y grants.
- Un sync puede reintentarse sin duplicar datos. Estado: cubierto por `idempotency_key`; falta probar.
- Webhooks repetidos quedan registrados sin ejecutar dos veces el mismo efecto. Estado: cubierto por indices unicos; falta probar.
