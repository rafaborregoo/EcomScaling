# ADR-0018: Retención de `audit_logs` en el pre-piloto

- **Fecha:** 2026-08-24
- **Estado:** Aprobada para el estado actual del proyecto (pre-piloto, sin usuarios reales).
- **Relacionada:** [`ADR-0016-retencion-transcripciones-llamadas.md`](ADR-0016-retencion-transcripciones-llamadas.md),
  [`SQO-03-privacidad-auditoria.md`](../../roadmap/roadmaps/06-seguridad-qa-observabilidad/fases/SQO-03-privacidad-auditoria.md).

## Contexto

`public.audit_logs` registra cambios sensibles del tenant, actor, entidad, request y snapshots JSON.
La escritura y el acceso están protegidos, pero no existía una política explícita de conservación ni
un job de purga específico. Crear una ventana arbitraria antes de tener clientes reales podría eliminar
la evidencia necesaria para depurar seguridad, migraciones y sincronizaciones.

## Decisión

1. Durante el pre-piloto, conservar `audit_logs` sin purga temporal automática.
2. No introducir datos sintéticos ni una migración destructiva para simular la retención.
3. Mantener el acceso limitado por RLS y no guardar secretos en `old_data`/`new_data`; la redacción de
   logs de aplicación no sustituye el control del contenido persistido.
4. Reabrir esta ADR antes de activar el primer cliente real, o antes si aparece un requisito legal o
   contractual. La revisión debe fijar finalidad, ventana por tipo de evento, excepciones legales,
   purga por lotes, auditoría de la propia purga y una prueba de restauración.

## Consecuencias

- El estado actual es explícito y reversible: no se confunde “sin purga todavía” con un olvido.
- La retención indefinida no se considera válida para producción con clientes reales sin una revisión
  de privacidad y contrato.
- El siguiente incremento de SQO-03 será implementar la política elegida y su job verificable cuando
  exista ese contexto real.
