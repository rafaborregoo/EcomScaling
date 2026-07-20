# DB-02 - Auth, multi-tenant y RLS

## Estado

- **Estado real:** `verification_pending` (NO `done` — falta la mitad de la matriz de aislamiento).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-01
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260715123333_db_02_auth_multitenant_rls.sql`, aplicada en remoto el 2026-07-15.
  - Tests: `node --test apps/api/src/rls-tenant-isolation.test.ts` — **11/11 pass** (ejecutado 2026-07-20, ~6.9s). Cubre: cliente A no ve organizacion/tareas/alertas de B, cliente A ve la suya, consultor solo ve sus asignaciones, platform_admin ve ambas, cliente no ve salida IA `pending_approval` de su propia organizacion, consultor asignado si la ve, conversaciones del copiloto privadas por usuario, miembro ve/no ve asignaciones de consultor segun organizacion.
  - `supabase db advisors --linked --type security --level warn`: sin warnings (no es evidencia de aislamiento funcional por si sola, solo de ausencia de patrones detectables estaticamente).
- **Gaps identificados** (lo que falta para poder llamarlo `done`):
  - Sin tests de **escritura** cross-tenant: insertar/actualizar una fila de la organizacion B desde una sesion de A.
  - Sin tests de acceso **directo via REST/RPC** de Supabase (solo se prueba a traves de la API Node con `createUserScopedClient`).
  - Sin tests de RPC, vistas y Storage — solo tablas.
  - Sin constraint que impida un enlace cross-tenant aunque el atacante conozca ambos UUID (p. ej. una tarea de A enlazada a una alerta de B).
  - Sin test de membresia suspendida ni de organizacion suspendida perdiendo acceso en caliente.
  - Sin documentacion de que funciones usan `SECURITY DEFINER` y su `search_path`.
- **Siguiente accion:** ampliar `rls-tenant-isolation.test.ts` con insert/update cross-tenant, acceso REST directo, y suspension en caliente, antes de reclasificar a `done`.

## Objetivo

Construir la frontera de seguridad de EcomScaling IA.

## Tablas

- `profiles`
- `organizations`
- `organization_members`
- `consultant_assignments`
- `service_subscriptions`
- `notifications`
- `audit_logs`

## Entregables

- Trigger de creacion de profile desde Supabase Auth.
- Helpers RLS en `private`.
- Policies por cliente, consultor asignado y platform admin.
- Seed de platform admin, consultor y dos organizaciones.
- Tests de aislamiento entre organizaciones.

## Riesgos

- Cualquier policy permisiva en esta fase compromete todo el producto.
- RLS no sustituye constraints contra enlaces cross-tenant.

## Criterios de cierre

- Usuario de organizacion A no lee ni escribe datos de B.
- Consultor no asignado no ve la organizacion.
- Suspension de organizacion o membresia corta acceso.
