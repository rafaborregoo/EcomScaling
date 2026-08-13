# OPS-02 - Runbooks y soporte

## Estado

- **Estado real:** `in_progress` (9 runbooks reales + checklist semanal de salud por cliente; falta solo
  validar RB-007 con un drill de restauracion real, pospuesto a proposito al final del programa)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-03
- **Dependencias:** SQO-02 (observabilidad, para poder diagnosticar mas alla de consultas SQL directas)
- **9 runbooks reales** (formato Sintoma/Impacto/Severidad/Comprobaciones iniciales/Diagnostico/Acciones/
  Rollback/Validacion de recuperacion/Comunicacion al cliente/Escalado/Evidencias a conservar/Prevencion,
  con queries SQL y nombres de funcion reales, no genericos):
  [`RB-001-shopify-sync-failed.md`](../runbooks/RB-001-shopify-sync-failed.md) (2026-07-20),
  [`RB-002-oauth-token-expired.md`](../runbooks/RB-002-oauth-token-expired.md) (2026-07-20),
  [`RB-006-ai-cost-spike.md`](../runbooks/RB-006-ai-cost-spike.md) (2026-07-20, usa
  `budget_exceeded`/`DEFAULT_AGENT_BUDGET`, ver AI-00/R-011),
  [`RB-007-database-backup-restore.md`](../runbooks/RB-007-database-backup-restore.md) (2026-07-22, ver
  R-016 -- el drill de restauracion real sigue pendiente, pospuesto a proposito hasta que haya datos de
  produccion),
  [`RB-008-purge-failed.md`](../runbooks/RB-008-purge-failed.md) (2026-07-22, ver R-008),
  [`RB-003-cross-tenant-leak.md`](../runbooks/RB-003-cross-tenant-leak.md) (2026-07-23, R-004 -- referencia
  las dos capas reales de aislamiento, Node + RLS, y los tests existentes de BE-01/AI-03 como cobertura de
  regresion, dejando explicito que esa cobertura es parcial, no de los ~60+ endpoints con `:organizationId`),
  [`RB-004-webhook-duplicate-backlog.md`](../runbooks/RB-004-webhook-duplicate-backlog.md) (2026-07-23 --
  cubre dos sintomas distintos bajo la misma tabla de diagnostico, duplicado real y backlog silencioso;
  deja explicito que no existe alerta automatica de backlog todavia, a diferencia de tokens
  expirados/purga pendiente que si tiene `ops-health-check.yml`),
  [`RB-005-failed-migration.md`](../runbooks/RB-005-failed-migration.md) (2026-07-23 -- escrito comparando
  `list_migrations` del proyecto real contra los 46 archivos locales; encontro un hallazgo real, no
  hipotetico: 10 migraciones tienen drift de version -- el nombre coincide pero el timestamp del archivo
  local no coincide con la version registrada en remoto, probablemente por haberse renombrado tras aplicar
  para reordenar migraciones del mismo dia. El schema en si esta correcto (confirmado con la suite completa
  de tests), es solo el metadato de versionado el que diverge; queda como accion pendiente concreta
  corregirlo con `migration repair` antes de automatizar `supabase db push` en CI),
  [`RB-009-alta-cliente-conectores.md`](../runbooks/RB-009-alta-cliente-conectores.md) (2026-08-03 --
  unico runbook proactivo del conjunto: secuencia de alta de un cliente real con Shopify obligatorio y
  Meta/Klaviyo condicionados a App Review y scopes; deja explicito que el criterio de cierre de un alta
  es la comparacion contra el panel nativo del proveedor, no que el sync no falle).

## Entregables

- Runbook de sync fallido.
- Runbook de OAuth/token expirado.
- Runbook de migracion fallida -- cerrado 2026-07-23 (`RB-005-failed-migration.md`).
- Runbook de incidente de privacidad -- cubierto por `RB-003-cross-tenant-leak.md`.
- Procedimiento de rollback y replay.
- Checklist semanal de salud por cliente -- cerrado 2026-07-23 (`CHECKLIST-SALUD-CLIENTE.md`), construido
  sobre las señales ya existentes en `/consultor` (score de atencion de FE-07), sin metricas nuevas.

## Criterios de cierre

- Un fallo comun tiene pasos claros de diagnostico.
- Hay responsables y canales de escalado definidos.

