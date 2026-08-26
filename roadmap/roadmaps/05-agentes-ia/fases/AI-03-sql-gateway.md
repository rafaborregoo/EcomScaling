# AI-03 - SQL Gateway

> **Correccion canonica 2026-08-24:** el validador actual bloquea `WITH RECURSIVE` en top-level y
> subqueries, `pg_sleep` y cualquier `pg_*`, `generate_series`, `regexp_split_to_table` y
> `jsonb_path_query`, ademas de DDL/DML, esquemas fuera de `ai` y tablas fuera de allowlist.
> `apps/api/src/sql-gateway.test.ts` cubre estos casos. El unico gap vigente es la estimacion
> de coste antes de ejecutar un SELECT grande; no debe describirse como si esas funciones siguieran
> abiertas.

> Correccion vigente 2026-08-02: el supuesto gap de `pg_sleep`/`generate_series` queda cerrado.
> `FORBIDDEN_FUNCTIONS` bloquea `generate_series`, `regexp_split_to_table` y `jsonb_path_query`,
> mientras que cualquier funcion `pg_*` (incluido `pg_sleep`) se rechaza por prefijo; los casos estan
> cubiertos por `sql-gateway.test.ts`.

## Estado

> Verificacion vigente 2026-08-24: la suite del contrato de integraciones y
> la suite IA actual pasan; `WITH RECURSIVE`, funciones peligrosas y el
> aislamiento tenant están cubiertos. Permanece como gap de endurecimiento el
> coste estimado antes de ejecutar consultas grandes, no una fuga de datos ni
> una vía DDL/DML.

- **Estado real:** `verification_pending` (los 2 gaps de seguridad concretos -- `WITH RECURSIVE` y el
  test de aislamiento tenant extremo a extremo -- se cerraron el 2026-07-23; el bloqueo de funciones
  de expansion se cerro y queda solamente el coste estimado antes de ejecutar SELECT grandes)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-08b, DB-08c
- **Bloqueador:** ninguno
- **Evidencia:** `apps/api/src/sql-gateway.ts`, `sql-gateway.test.ts` (31 tests reales),
  `be-07-sql-gateway-tenant-isolation.test.ts` (3 tests contra Supabase remoto real),
  `supabase/migrations/20260718100000_db_08b_ai_sql_gateway.sql`,
  `20260718120000_db_08c_gateway_role_hardening.sql`. Detalle tecnico completo ya esta documentado en
  `roadmap/roadmaps/02-backend-api/fases/BE-07-ai-runtime-rag.md` — no se duplica aqui.
- **Correccion a un supuesto de la auditoria**: el tenant no se fija con `SET LOCAL` sobre una conexion de
  pool reutilizada gestionada por Node — se fija con `set_config(..., is_local => true)` **dentro de la
  propia funcion `public.agent_sql_gateway`** (`security definer`), invocada como una unica llamada RPC.
  Cada invocacion es su propia transaccion en Postgres; no hay una conexion Node persistente donde el GUC
  de una organizacion pueda sobrevivir y filtrarse a la siguiente peticion de otra organizacion, que es el
  escenario de riesgo que la auditoria describe.
- **Cerrado 2026-07-23**: los 2 gaps concretos de seguridad de este documento ya no estan abiertos.
  `WITH RECURSIVE` ahora se rechaza explicitamente (top-level y anidado en subquery, `sql-gateway.ts`
  movio el tipo de `TOP_LEVEL_ALLOWED_TYPES` a `FORBIDDEN_NODE_TYPES`), con 2 tests nuevos. Y el test que
  faltaba de aislamiento tenant extremo a extremo ahora existe: `be-07-sql-gateway-tenant-isolation.test.ts`
  alterna 5 llamadas RPC A/B/A/B/A sobre el mismo cliente Supabase y confirma contra el Supabase remoto
  real que el GUC nunca se filtra de una llamada a la siguiente.
- **Endurecimiento preparado 2026-08-24**: la migración
  `20260824150000_ai_03_sql_gateway_cost_guard.sql` añade `EXPLAIN (FORMAT JSON, COSTS TRUE)` sin
  `ANALYZE` antes del SELECT y rechaza planes por encima de `100000` de coste estimado. Devuelve solo
  `estimated_cost`, no el plan completo. Queda pendiente aplicar/verificar esta migración en el
  Supabase remoto cuando la sesión de administración esté disponible; el intento del 2026-08-24 fue
  rechazado por permisos MCP (`-32600`). El comportamiento actual no se declara como cerrado hasta
  esa prueba.
- **Correccion 2026-07-20**: la superficie real de `sql_select` en produccion hoy es A04, A06 y A09 (los
  tres con `allowed_tools` incluyendo `sql_select` en su version activa) — **no A02**, que corre en
  evidence-pack puro sin tools desde `v2` (ver AI-02, correccion sobre una afirmacion previa de esta misma
  sesion). A06 mantiene `sql_select` disponible como complemento aunque el cruce critico ya llegue
  precalculado.
- **Siguiente accion**: evaluar si A04/A09 necesitan de verdad `sql_select` libre o si tambien pueden
  moverse a contexto precalculado como A02.

## Objetivo

Dar libertad analitica controlada a los agentes.

## Entregables

- Validacion AST.
- Solo `SELECT` y `WITH`.
- Allowlist de tablas/vistas.
- Bloqueo de `private`.
- Forzado de organization_id.
- Timeout, limit y auditoria.

## Criterios de cierre

- Intentos DDL/DML se rechazan.
- Consultas cross-tenant no devuelven datos.
- Cada query queda registrada con tablas, filas y duracion.
