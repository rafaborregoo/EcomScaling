# DB-00 - Infraestructura Supabase

> **Integridad remota verificada 2026-08-24:** `supabase db lint --linked` no encuentra errores en
> `ai`, `extensions`, `private` ni `public`; `supabase db push --linked --dry-run` confirma que no
> hay migraciones pendientes. La comprobacion fue de lectura y no escribio en produccion.

## Estado

> Verificacion vigente 2026-08-24: las migraciones locales/remotas estan
> alineadas (64/64) y la prueba real de permisos de `private` permanece
> documentada. La fase conserva `verification_pending` porque aun no se ha
> repetido en esta ronda una ejecucion desde base vacia que pruebe todo el
> bootstrap, aunque no hay drift ni bloqueador de producto.

- **Estado real:** `verification_pending` (el gap de permisos de `private` ya tiene test real; el gap de
  documentacion de extensiones/`search_path` se cerro 2026-07-23, ver abajo)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** ninguna
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260715123324_db_00_infraestructura.sql`, aplicada en remoto el 2026-07-15 (`supabase db push --linked`).
  - `pgcrypto` ya existia en el proyecto remoto; la migracion lo omitio correctamente con `if not exists`.
  - **Test anadido 2026-07-21**: `apps/api/src/db-00-private-schema-permissions.test.ts` confirma contra el
    Supabase remoto real que un cliente anon y un usuario autenticado normal reciben error al intentar leer
    `private.webhook_events`, y que `service_role` si puede (confirma que el aislamiento es de rol, no una
    tabla rota o mal expuesta). Corre en CI (`ci.yml`, mismo paso que el resto de `apps/api`).
- **Resuelto 2026-07-22**: la decision de `vector` ("solo si se activa RAG") estaba desactualizada — ya se activo (ver DB-11); corregido en Entregables.
- **Resuelto 2026-07-23** (verificado contra las 5 migraciones reales que contienen `security definer`,
  no solo documentado de memoria):
  - **Extensiones**: ambas se instalan explicitamente en el schema `extensions`, nunca en `public`:
    `create extension if not exists pgcrypto with schema extensions` (`db_00_infraestructura.sql`) y
    `create extension if not exists vector with schema extensions` (`db_11_rag_conocimiento.sql`).
  - **`search_path` de funciones `SECURITY DEFINER`**: las 10 funciones reales con `security definer` en
    el repo (8 en `db_02_auth_multitenant_rls.sql`: `handle_new_auth_user`, `is_platform_admin`,
    `is_active_org_member`, `current_member_role`, `is_assigned_consultant`, `has_valid_subscription`,
    `can_access_org`, `can_manage_org`; 1 en `db_03_configuracion_financiera.sql`/su fix de
    `20260722105048`: `log_financial_change`; 1 en `db_07_alertas_tareas_plan.sql`:
    `record_task_status_change`) fijan **`set search_path = ''`** (vacio, no un valor fijo como `public`) —
    el patron mas seguro: fuerza a que toda referencia dentro del cuerpo de la funcion vaya calificada por
    schema, asi que un atacante que pudiera manipular el `search_path` de la sesion no logra que la funcion
    resuelva un nombre de tabla/funcion contra un objeto suyo. Confirmado que **no existe ninguna funcion
    `SECURITY DEFINER` sin `search_path` fijado** en el codebase (grep de las 5 migraciones que mencionan
    `security definer`, revisadas una por una).
  - Nota aparte (no es un gap de este documento, ya que `agent_sql_gateway` no usa `SECURITY DEFINER`):
    ese gateway usa un patron distinto y mas estricto — `language plpgsql` sin `security definer`, fija
    `search_path`/timeout/tenant via `set_config` en tiempo de ejecucion y baja privilegios con
    `set local role ai_gateway` antes de ejecutar el SQL del agente (`db_08c_gateway_role_hardening.sql`).
- **Siguiente accion:** ninguna pendiente en este documento.

## Objetivo

Preparar la base tecnica para migraciones futuras sin introducir tablas de negocio todavia.

## Entregables

- Schema `private`.
- Extension `pgcrypto`.
- Extension `vector`: activada (RAG ya en uso desde DB-11, ver `db_11_rag_conocimiento`).
- Funcion comun `set_updated_at`.
- Permisos base de schemas.
- Carpeta de tests SQL preparada.

## Dependencias

- Monorepo y Supabase local inicializados.
- Decision de convenciones SQL aprobada.

## Criterios de cierre

- Las migraciones corren desde una base vacia.
- `private` no es accesible por `anon` ni `authenticated`.
- Existe una prueba minima que valida permisos de schema.
