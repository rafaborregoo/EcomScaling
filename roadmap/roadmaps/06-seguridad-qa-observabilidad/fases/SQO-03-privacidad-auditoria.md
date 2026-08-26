# SQO-03 - Privacidad y auditoria

> Actualizacion 2026-08-26: se establece una retencion operativa de 30 dias para
> payloads de webhook en estado terminal (`processed`/`ignored_duplicate`). La
> migracion `20260826170000_ops_webhook_retention.sql` crea la purga batched
> `private.purge_processed_webhook_events`; nunca elimina eventos `received`,
> `queued` o `failed`, que deben seguir disponibles para procesamiento/replay.
> El worker la ejecuta diariamente a las 03:30 Europe/Madrid mediante el endpoint
> interno protegido. El resto de retenciones (transcripciones, agent runs y
> auditoria) continua pendiente de una politica de producto/legal especifica.

> Actualizacion 2026-08-26 (contexto IA): se fija una ventana tecnica de 180 dias
> para payloads de `agent_run_steps`, inputs/outputs de `agent_tool_calls`,
> snapshots de contexto y SQL de `agent_query_runs`. La migracion
> `20260826173000_ops_ai_context_retention.sql` los redacta por lotes solo en
> ejecuciones no activas y conserva metadatos, costes, estados, aprobaciones y
> outputs. Elimina unicamente versiones antiguas no actuales de
> `call_transcripts`. El worker lo ejecuta diariamente a las 03:45 Europe/Madrid.
> La cifra es una politica tecnica inicial y debe revisarse con legal antes del
> lanzamiento comercial.

> Exportacion tenant-scoped 2026-08-26: `private.export_organization_data` y
> `GET /v1/consultant/organizations/:organizationId/export` generan JSON v1 con
> lista blanca de tablas publicas filtradas por `organization_id`. Solo un
> `platform_admin` puede solicitarlo; las credenciales cifradas y secretos quedan
> fuera del export. La purga existente mantiene periodo de gracia y cascada FK.

## Estado

> Auditoria vigente 2026-08-24: `recordAuditLog` sigue siendo el punto comun
> de escritura y hay 47 invocaciones distribuidas en las operaciones sensibles
> de consultoria, llamadas, IA, finanzas, integraciones, conocimiento,
> operaciones, Meta y Shopify. La cobertura de cambios sensibles esta
> implementada; lo que bloquea el cierre no es la instrumentacion sino definir
> retenciones, exportacion/borrado por organizacion, inventario de subencargados
> y un restore drill real.

- **Estado real:** `in_progress` (corregido 2026-07-20, ver abajo)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-02
- **`audit_logs` conectado 2026-07-20 (R-013)**: nuevo helper `recordAuditLog` (`apps/api/src/audit-log.ts`)
  como unico punto de escritura, cableado en las escrituras sensibles ya existentes que antes no dejaban
  rastro: `updateOrganization`, `deleteOrganization`, `deleteOrganizationStore` (`consultant.ts`),
  `decideSummary` (`calls.ts`), `decideAgentOutput` (`ai-runtime.ts`). Cada entrada guarda actor,
  organizacion, accion, entidad, y `old_data`/`new_data` cuando aplica; un fallo al auditar se loguea pero
  nunca rompe la operacion auditada.
- **Configuracion financiera cubierta 2026-07-22**: `financial-config.ts` cableado a `recordAuditLog` en
  las 5 escrituras reales (`upsertFinancialSettings`, `createFixedExpense`, `deactivateFixedExpense`,
  `createShippingRule`, `deactivateShippingRule`).
- **Correccion de una correccion, mismo dia 2026-07-22**: la revision anterior de esta linea afirmaba "no
  existe ningun endpoint que gestione memberships/consultant_assignments" -- **esa afirmacion era falsa**,
  producto de buscar la tabla equivocada (`grep` por el literal `"memberships"` en vez del nombre real,
  `organization_members`). Verificado correctamente ahora: `consultant.ts` tiene `upsertOrganizationMember`
  y `upsertConsultantAssignment` (ambas exigen `platform_admin`, ambas montadas en `server.ts`), y **las
  dos ya llaman a `recordAuditLog`** desde antes de esta sesion -- este gap estaba cerrado y nunca hizo
  falta tocarlo. De paso se encontro y corrigio un bug real no relacionado en `upsertOrganizationMember`:
  el `select` de la fila previa no traia `invited_at`/`joined_at`, asi que el upsert los sobreescribia con
  la fecha actual en cada edicion de rol en vez de preservar los originales (error de tipos real de
  TypeScript, no solo un lint).
- **Sigue pendiente de verdad**: sin politica de retencion con cifras concretas para ningun dato (ni
  payloads de webhook, ni transcripciones, ni agent runs); sin proceso de exportacion/borrado por
  organizacion; sin prueba documentada de restauracion de backup (Supabase gestiona backups/PITR a nivel de
  infraestructura, pero no hay evidencia en este repo de que se haya ejecutado una restauracion real -- ver
  R-016/RB-007, drill pospuesto a proposito); sin inventario de subencargados (Anthropic, Voyage, Supabase,
  hosting) con dato enviado/retencion/region.

## Entregables

- Politica de minimizacion de PII.
- Retencion de payloads, logs, transcripciones y agent runs.
- Audit logs para cambios sensibles.
- Backups/PITR y prueba de restauracion.
- Procedimiento de incidente.

## Criterios de cierre

- No se almacenan emails, telefonos o direcciones de compradores sin aprobacion.
- Cambios financieros, tareas, planes y aprobaciones son trazables.
