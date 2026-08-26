# SQO-06 - Runbooks operativos

> **Estado vigente 2026-08-20:** `implemented_partial`. Los incidentes
> principales tienen runbook accionable y el checklist de salud por cliente está
> documentado; el drill de backup/restore sigue siendo la única evidencia
> operativa externa pendiente.

## Catálogo vigente

| Runbook | Incidente cubierto            |
| ------- | ----------------------------- |
| RB-001  | Sync Shopify fallido          |
| RB-002  | Token OAuth expirado          |
| RB-003  | Posible fuga cross-tenant     |
| RB-004  | Webhook duplicado o backlog   |
| RB-005  | Migración fallida             |
| RB-006  | Pico de coste IA              |
| RB-007  | Backup y restauración         |
| RB-008  | Purga de organización fallida |
| RB-009  | Alta controlada de conectores |
| RB-010  | Evals IA fallidas o agente degradado |

Cada runbook debe mantener diagnóstico, acciones seguras, rollback y criterio
de escalado. Las operaciones destructivas apuntan a proyectos de drill o a las
rutas de soft-delete existentes; no se ejecutan SQL destructivos ad hoc en
producción.

## Salud preventiva

`CHECKLIST-SALUD-CLIENTE.md` consolida conexión, freshness, errores de sync,
webhooks, alertas y estado de agentes por organización. El workflow de salud
puede abrir/actualizar un issue operativo sin exponer secretos ni datos de
cliente.

La salida de `runOpsHealthCheck` aplica una segunda sanitizacion especifica antes
de persistirse: elimina claves sensibles y redacta tokens incluidos dentro de
mensajes de error. La prueba `apps/api/src/ops-health-check.test.ts` protege este
contrato.

Los workflows de salud, alertas y reconciliacion Shopify hacen preflight de los
secretos requeridos antes de compilar o tocar datos. El workflow de salud valida
ademas el schema del artifact antes de publicarlo en GitHub Issues. Los cron
siguen preparados pero comentados por decision operativa; se activaran cuando
exista autorizacion expresa y secretos de produccion verificados.

## Gaps honestos

- Medir el restore real de RB-007 en un proyecto temporal.
- Añadir una política de backup/restore de Storage si el producto empieza a
  depender de archivos críticos.
- Revisar agregación de observabilidad cuando haya varias instancias reales.
