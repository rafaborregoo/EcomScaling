# DB-02 - Auth, multi-tenant y RLS

## Estado

> Verificacion vigente 2026-08-24: las 64 migraciones locales/remotas estan
> alineadas y los gates de esquema pasan. La evidencia funcional vigente sigue
> siendo 17/17 tests de aislamiento general y 8/8 pruebas de RPC metricas en
> proyecto aislado (validacion documentada); falta repetir esa suite aislada
> de forma reproducible para poder reclasificar la fase como `done`.

- **Estado real:** `verification_pending` (mucho mas cerca de `done`, ver correcciones abajo).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** DB-00, DB-01
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260715123333_db_02_auth_multitenant_rls.sql`, aplicada en remoto el 2026-07-15.
  - Tests remotos: `test:remote` en un proyecto aislado — **17/17 pass** (ampliado 2026-07-21, antes 11/11). Cubre lo de siempre (aislamiento de lectura) mas 6 tests nuevos: escritura cross-tenant rechazada en `integration_connections` (insert), `organizations` (update), `organization_members` (insert); el trigger `enforce_task_alert_same_org` rechaza enlazar una tarea de A con una alerta de B; una organizacion suspendida corta el acceso de su propio owner en caliente (sin re-login); desactivar la membresia de un usuario corta su acceso sin afectar a otros miembros de la misma organizacion. La suite requiere el guard de proyecto aislado y no se ejecuta contra producción.
  - `supabase db advisors --linked --type security --level warn`: sin warnings nuevos tras esta ronda.
  - **Funciones `SECURITY DEFINER` de `private`** (todas con `set search_path = ''` explicito, confirmado en el codigo fuente de la migracion -- no vulnerables a search_path hijacking): `is_platform_admin()`, `is_active_org_member(org_id)`, `current_member_role(org_id)`, `is_assigned_consultant(org_id)`, `has_valid_subscription(org_id)`, `can_access_org(org_id)` (compone las 3 anteriores), `can_manage_org(org_id)` (platform_admin o rol owner/manager). Todas `grant execute ... to authenticated`, ninguna a `anon`.
- **Correcciones a la auditoria anterior (2026-07-20), que subestimaba lo ya construido:**
  - **"Sin tests de acceso directo via REST/RPC"** era incorrecto: `rls-tenant-isolation.test.ts` ya crea los clientes con `createClient(url, publishableKey)` + `signInWithPassword` (identico patron a `createUserScopedClient` del backend real) -- es acceso PostgREST directo, RLS puro, no pasa por la API Node en ningun momento.
  - **"Sin constraint que impida un enlace cross-tenant"** era incorrecto: el trigger `enforce_task_alert_same_org` (y su equivalente `enforce_milestone_task_link_same_org`) ya existian desde DB-07 (`db_07_alertas_tareas_plan.sql`). Lo que faltaba de verdad era el test que lo confirmara, ya anadido.
- **Resuelto 2026-07-23 (tests de RPC)**: confirmado que Storage no se usa en ningun sitio del codigo
  (cero referencias a `.storage.` en `apps/api`/`apps/web`) -- esa parte del gap no aplica, no hay nada que
  probar. RPC si esta en uso real: 7 funciones SQL de metricas (`shopify_sales_summary`,
  `shopify_financial_summary`, `shopify_margin_summary`, `shopify_top_products`, `shopify_stock_summary`,
  `shopify_stock_risk_products`, `meta_spend_summary`) mas `agent_sql_gateway`/`knowledge_search`, estas dos
  ultimas ya cubiertas por AI-03/DB-11. Las funciones de metricas nunca tenian test de aislamiento propio.
  `db-02-metrics-rpc-tenant-isolation.test.ts` (nuevo) llama `shopify_sales_summary` y
  `shopify_financial_summary` **directamente por RPC con el cliente del usuario** (no service_role, mismo
  cliente que usa `shopify-metrics.ts` en produccion) pidiendo explicitamente `target_organization_id` de
  una organizacion ajena con datos reales sembrados (5 pedidos, 200 EUR cada uno) -- confirma contra
  Supabase remoto real que ambas funciones (`language sql stable`, sin `security definer`, RLS hereda la
  identidad del llamador) devuelven agregaciones en cero, no los datos reales de la otra organizacion.
  3/3 tests pasan. Las otras 5 funciones de metricas comparten el mismo patron (`security invoker`,
  mismo tipo de filtro `where organization_id = target_organization_id` sobre una tabla con RLS) pero no se
  probaron una por una en esta ronda.
- **Resuelto 2026-07-23 (ampliacion, las 5 funciones restantes)**: `db-02-metrics-rpc-tenant-isolation.test.ts`
  ampliado con datos reales de B (producto, variante, inventory item + coste, ubicacion + stock 42
  unidades, 5 lineas de pedido a 200 EUR, cuenta de Meta con 1 insight diario de 100 EUR de gasto y 5
  compras) para poder ejercitar de verdad las 5 funciones que faltaban: `shopify_top_products` (0 filas, no
  el producto real), `shopify_stock_summary` (0 items, no las 42 unidades reales), `shopify_margin_summary`
  (revenue/cogs en 0, no los 1000 EUR reales), `shopify_stock_risk_products` (0 filas) y
  `meta_spend_summary` (spend/purchases en 0, no los 100 EUR/5 compras reales). Las 7 funciones de metricas
  de produccion tienen ahora test de aislamiento cross-tenant real. 8/8 tests del archivo pasan, 105/105
  tests de `apps/api` pasan, typecheck limpio en los 10 workspaces.
- **Gaps identificados que siguen abiertos:**
  - Solo se probo escritura cross-tenant en las 3 tablas donde `authenticated` tiene grant de escritura directa (`integration_connections`, `organizations`, `organization_members`) -- el resto de escrituras del producto pasan siempre por el backend con `service_role`, que valida `organization_id` en Node antes de escribir (defensa en profundidad, no una laguna de RLS sin probar).
- **Siguiente accion:** ninguna pendiente en RPC/Storage. Este documento ya cubre el gap original al 100%.

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
