# RB-008 - Purga de organizacion/tienda fallida (soft-delete no se completa)

## Sintoma

`purge-expired-deletions.yml` (cron diario) reporta `failedOrganizationIds`/`failedConnectionIds` no
vacios, o el health check operativo (`ops-health-check.yml`) abre un issue `purge_overdue`: una
organizacion o conexion sigue en `status = 'pending_deletion'` mas de 2 dias despues de su
`scheduled_purge_at`.

## Impacto

El cliente cree que sus datos se borraron fisicamente tras el periodo de gracia de 30 dias (R-008), pero
siguen existiendo en la base. Riesgo de cumplimiento/privacidad si hay compromisos explicitos con el
cliente sobre borrado real.

## Severidad

**SEV-3** — no hay perdida de datos ni riesgo cross-tenant, pero es un incumplimiento silencioso de un
compromiso de producto (borrado real tras 30 dias).

## Contexto (bug real encontrado y corregido 2026-07-22)

`purgeExpiredDeletions` (`apps/api/src/consultant.ts`) tragaba el error de `DELETE` en silencio (`if
(deleteError) { continue; }`, sin loguear ni contar el fallo). La causa raiz: el trigger
`private.log_financial_change()` (DB-03, dispara en `organization_financial_settings`/`fixed_expenses`/
`shipping_cost_rules`/`organization_metric_targets`) intentaba insertar una fila en `audit_logs`
referenciando `organization_id` **despues** de que la organizacion ya hubiera sido borrada por la cascada
de la misma sentencia — la FK de `audit_logs` rechazaba el insert, y el `DELETE` completo de la
organizacion fallaba. Efecto real: **ninguna organizacion con configuracion financiera se purgaba nunca**,
sin alerta de ningun tipo, desde que existe R-008 (2026-07-21) hasta el fix (2026-07-22).

Corregido con la migracion `db_03_financial_audit_cascade_delete_fix`: el trigger ahora comprueba si la
organizacion ya no existe (borrado en cascada) antes de intentar el insert de auditoria, y en ese caso no
hace nada (el borrado de la organizacion en si ya queda auditado por separado en `deleteOrganization`/
`purgeExpiredDeletions`). Ademas, `purgeExpiredDeletions` ya no traga errores: los loguea y los devuelve en
`failedOrganizationIds`/`failedConnectionIds`, y el script del cron (`purge-expired-deletions-once.ts`)
marca el job como fallido (`process.exitCode = 1`) si hay alguno.

## Comprobaciones iniciales

1. Ver el log del ultimo run del workflow `Purge Expired Deletions` en GitHub Actions — si fallo, el
   mensaje de error real de Postgres esta ahi (`logger.error("Failed to purge organization", ...)`).
2. Confirmar cuales organizaciones/conexiones siguen atascadas:
   ```sql
   select id, display_name, scheduled_purge_at
   from organizations
   where status = 'pending_deletion' and scheduled_purge_at < now();

   select id, organization_id, provider, scheduled_purge_at
   from integration_connections
   where status = 'pending_deletion' and scheduled_purge_at < now();
   ```

## Diagnostico

- Si el error es una violacion de FK (`violates foreign key constraint`), es casi seguro el mismo patron
  que motivo este runbook: un trigger de auditoria en una tabla hija que se ejecuta despues de que el
  padre ya no existe en la misma cascada. Buscar el trigger por el nombre de la tabla en el mensaje de
  error y aplicar el mismo patron de fix (comprobar `not exists` del padre antes de insertar en
  `audit_logs`).
- Si el error es otro (constraint distinta, columna NOT NULL, etc.), es un caso nuevo — no asumir que es
  el mismo bug sin leer el mensaje completo.

## Acciones

1. Si es el patron de FK de auditoria: aplicar el fix al trigger correspondiente (ver migracion de
   referencia `db_03_financial_audit_cascade_delete_fix`).
2. Tras corregir la causa raiz, relanzar el workflow manualmente (`workflow_dispatch`) en vez de esperar
   al cron del dia siguiente.
3. Confirmar que las organizaciones/conexiones atascadas ya no aparecen en las consultas del paso 2.

## Rollback

No aplica — es un borrado que deberia haber ocurrido hace tiempo; completarlo no es destructivo respecto
al estado esperado.

## Validacion de recuperacion

- Las consultas SQL del paso 2 devuelven cero filas.
- El siguiente run del workflow reporta `failedOrganizationIds: []`, `failedConnectionIds: []`.

## Comunicacion al cliente

Solo si el cliente pregunto explicitamente por el borrado y penso que ya habia ocurrido — explicar que
hubo un fallo tecnico y ya esta corregido, con la fecha real de borrado.

## Evidencias a conservar

El mensaje de error completo de Postgres del run fallido, y la lista de IDs afectados.

## Prevencion

`ops-health-check.yml` ya detecta este caso (`purge_overdue`, cron cada 2h) y abre/actualiza un issue de
GitHub automaticamente — no depende de que alguien revise los logs del cron de purga a mano.
