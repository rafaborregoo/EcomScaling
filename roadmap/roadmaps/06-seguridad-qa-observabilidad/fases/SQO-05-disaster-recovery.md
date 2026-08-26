# SQO-05 - Disaster recovery

> **Estado vigente 2026-08-24:** `verification_pending`. El procedimiento y
> los objetivos están definidos; falta ejecutar un restore completo contra un
> proyecto desechable. Nunca se debe probar la restauración sobre producción.

## Objetivo

Mantener una ruta reproducible para recuperar el esquema y los datos de
EcomScaling ante pérdida de base de datos, migración fallida o rollback de una
versión desplegada.

## Criterios operativos

- RPO objetivo: 24 horas, sujeto a que el workflow de backup se lance al menos
  una vez al día cuando se active su `schedule`.
- RTO objetivo: 4 horas, medido desde la disponibilidad del dump hasta la
  comprobación del proyecto restaurado.
- El plan gratuito de Supabase no aporta PITR; el backup propio es un artifact
  de GitHub Actions con retención de 30 días.
- El dump usa `pg_dump --format=custom --no-owner --no-privileges` y se valida
  con `pg_restore --list` antes de subirlo.
- El backup no cubre Storage de Supabase; los objetos y sus políticas requieren
  un procedimiento separado antes de prometer recuperación completa.

## Procedimiento canónico

1. Ejecutar manualmente `.github/workflows/backup-database.yml` y conservar el
   artifact y su checksum.
2. Crear un proyecto Supabase temporal, nunca reutilizar producción.
3. Seguir [`RB-007-database-backup-restore.md`](../../07-operacion-despliegue/runbooks/RB-007-database-backup-restore.md)
   para restaurar el dump y comprobar extensiones, funciones, tablas, RLS y
   conteos de negocio.
4. Ejecutar `supabase migration list --linked` y `supabase db lint` contra el
   proyecto de drill.
5. Registrar duración, resultado, diferencias y cualquier gap en el historial
   del runbook; destruir el proyecto temporal tras conservar la evidencia.

## Evidencia actual

- Workflow y validación estructural de dumps: `.github/workflows/backup-database.yml`.
- Runbook detallado: `RB-007-database-backup-restore.md`.
- Objetivos RPO/RTO: Q-015 y `OPS-01-piloto-mvp.md`.
- Restore real: pendiente; no se declara como ejecutado.
