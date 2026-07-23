# AI-03 - SQL Gateway

## Estado

- **Estado real:** `verification_pending` (los 2 gaps de seguridad concretos -- `WITH RECURSIVE` y el
  test de aislamiento tenant extremo a extremo -- se cerraron el 2026-07-23; queda `pg_sleep`/`generate_series`
  como mitigacion parcial, no bloqueante)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** DB-08b, DB-08c
- **Bloqueador:** ninguno
- **Evidencia:** `apps/api/src/sql-gateway.ts`, `sql-gateway.test.ts` (30 tests reales),
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
- **Gap que sigue abierto (no bloqueante)**: `LIMIT 200` no impide un escaneo caro antes de aplicar el
  limite (sin `EXPLAIN` ni coste estimado); tampoco hay bloqueo explicito de `pg_sleep`/`generate_series`
  por nombre (mitigado parcialmente por `statement_timeout` de 8s).
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

