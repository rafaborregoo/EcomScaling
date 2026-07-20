# SQO-03 - Privacidad y auditoria

## Estado

- **Estado real:** `planned_critical`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-02
- **Hallazgo real, no solo un vacio de documentacion**: la tabla `public.audit_logs` **ya existe en el
  esquema** (`supabase/migrations/20260715123333_db_02_auth_multitenant_rls.sql`, con `actor_user_id`,
  `organization_id`, `action`, `entity_type/id`, `old_data`/`new_data`, `request_id`, `ip_address`,
  `user_agent`) pero **`grep -rln "audit_logs" apps/api/src apps/worker/src` no devuelve ningun resultado**
  — ningun endpoint escribe en ella. Es una tabla de auditoria completamente vacia: el esqueleto correcto
  fue diseñado en DB-02 y nunca se conecto a codigo. Cambios financieros, membresias, tokens, borrados de
  organizacion/tienda (ver riesgo en `RIESGOS.md`) y aprobaciones IA no dejan ningun rastro auditable hoy.
- **Otros vacios reales confirmados**: sin politica de retencion con cifras concretas para ningun dato (ni
  payloads de webhook, ni transcripciones, ni agent runs); sin proceso de exportacion/borrado por
  organizacion; sin prueba documentada de restauracion de backup (Supabase gestiona backups/PITR a nivel
  de infraestructura, pero no hay evidencia en este repo de que se haya ejecutado una restauracion real);
  sin inventario de subencargados (Anthropic, Voyage, Supabase, hosting) con dato enviado/retencion/region.

- **Siguiente accion, la de mayor relacion esfuerzo/impacto de todo este bloque**: conectar `audit_logs` a
  las escrituras sensibles que ya existen (`updateOrganization` en `consultant.ts`, cambios de
  configuracion financiera, `decideSummary`/`decideAgentOutput`, borrado de tienda/organizacion) — la
  tabla y sus indices ya estan listos, es codigo de escritura, no diseño de esquema nuevo.

## Entregables

- Politica de minimizacion de PII.
- Retencion de payloads, logs, transcripciones y agent runs.
- Audit logs para cambios sensibles.
- Backups/PITR y prueba de restauracion.
- Procedimiento de incidente.

## Criterios de cierre

- No se almacenan emails, telefonos o direcciones de compradores sin aprobacion.
- Cambios financieros, tareas, planes y aprobaciones son trazables.

