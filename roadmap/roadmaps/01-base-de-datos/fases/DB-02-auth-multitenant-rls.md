# DB-02 - Auth, multi-tenant y RLS

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

## Implementacion actual

- Migracion creada: `supabase/migrations/20260715123333_db_02_auth_multitenant_rls.sql`.
- Incluye tablas core, helpers RLS, policies iniciales, trigger de profile y triggers `updated_at`.
- Aplicada en Supabase remoto el 2026-07-15 mediante `supabase db push --linked`.
- Verificado: tablas core existen, RLS esta activada y `supabase db advisors --linked --type security --level warn` no reporta issues.
- Pendiente: ejecutar tests RLS cliente A/B y consultor asignado/no asignado.
