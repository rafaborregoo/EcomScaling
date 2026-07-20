# AI-03 - SQL Gateway

## Estado

- **Estado real:** `security_verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-08b, DB-08c
- **Bloqueador:** ninguno
- **Evidencia:** `apps/api/src/sql-gateway.ts`, `sql-gateway.test.ts` (28 tests reales, no 12),
  `supabase/migrations/20260718100000_db_08b_ai_sql_gateway.sql`,
  `20260718120000_db_08c_gateway_role_hardening.sql`. Detalle tecnico completo y el gap de `WITH
  RECURSIVE` ya estan documentados en
  `roadmap/roadmaps/02-backend-api/fases/BE-07-ai-runtime-rag.md` — no se duplica aqui.
- **Correccion a un supuesto de la auditoria**: el tenant no se fija con `SET LOCAL` sobre una conexion de
  pool reutilizada gestionada por Node — se fija con `set_config(..., is_local => true)` **dentro de la
  propia funcion `public.agent_sql_gateway`** (`security definer`), invocada como una unica llamada RPC.
  Cada invocacion es su propia transaccion en Postgres; no hay una conexion Node persistente donde el GUC
  de una organizacion pueda sobrevivir y filtrarse a la siguiente peticion de otra organizacion, que es el
  escenario de riesgo que la auditoria describe. Sigue sin existir un test automatizado que ejecute dos
  llamadas RPC consecutivas de organizaciones distintas y confirme el aislamiento extremo a extremo — vale
  la pena tenerlo igualmente, pero el riesgo estructural es menor de lo que sugiere la auditoria.
- **Gaps reales confirmados** (compartidos con BE-07, resumen): `WITH RECURSIVE` esta explicitamente
  permitido en el validador AST — un CTE recursivo mal formado agotaria el `statement_timeout` de 8s en
  vez de fallar rapido. `LIMIT 200` no impide un escaneo caro antes de aplicar el limite (sin `EXPLAIN` ni
  coste estimado). Solo A02 tiene la tool `sql_select` conectada (A06 ya se movio a evidence pack
  precalculado tras su incidente, ver AI-02/AI-05).
- **Siguiente accion**: prohibir o acotar `WITH RECURSIVE`, y priorizar migrar A02 a evidence packs
  deterministas (AI-02) para reducir la superficie real de `sql_select` en produccion antes de invertir en
  mas casos adversariales.

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

