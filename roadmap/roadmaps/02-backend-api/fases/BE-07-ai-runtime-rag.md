# BE-07 - Runtime IA, SQL Gateway y RAG

## Estado

- **Estado real:** `partial_security_and_quality_pending` (el gateway tiene controles reales serios, pero
  no hay evals adversariales — no se puede llamar "completo" a una superficie de ataque critica sin ellas).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-08, DB-11
- **Bloqueador:** ninguno
- **Evidencia verificada en codigo real** (`apps/api/src/sql-gateway.ts` + migracion `db_08b`):
  - Validacion AST en Node (`pgsql-ast-parser`) antes de tocar la DB: rechaza `insert/update/delete`,
    toda sentencia DDL, `grant/revoke/set/show/copy/do/begin/commit/rollback/prepare/deallocate`, y
    funciones peligrosas (`set_config`, `current_setting`, `dblink*`, `lo_import/export`, funciones XML).
  - Segunda capa en DB (defensa en profundidad real, no solo en Node): la consulta corre contra vistas
    del esquema `ai` con tenant fijado via GUC, `search_path = 'ai'`, **`statement_timeout = 8000ms`** y
    resultado envuelto en `LIMIT` — todo dentro de `agent_sql_gateway` (`security definer`, solo
    `service_role`).
  - Alcance de tablas: allowlist explicita de 18 vistas (`GATEWAY_ALLOWED_TABLES`), no acceso libre al
    esquema `public`.
- **Gaps identificados (reales, no genericos):**
  - `"with recursive"` esta **explicitamente permitido** en `TOP_LEVEL_ALLOWED_TYPES` — un CTE recursivo
    mal formado podria agotar el `statement_timeout` de 8s en vez de fallar rapido; revisar si debe
    seguir permitido.
  - Sin bloqueo explicito por nombre de `pg_sleep`/`generate_series` (mitigado parcialmente por el
    timeout de 8s y el `LIMIT`, pero no es lo mismo que rechazarlas).
  - Sin `lock_timeout` fijado (solo `statement_timeout`).
  - Sin evals adversariales: intento cross-tenant, acceso a `private`, prompt injection documental, cita
    inexistente, SQL invalido, consulta excesiva, contradiccion RAG vs DB, escritura disfrazada,
    respuesta sin evidencia, duplicacion de accion — ninguno de estos casos tiene un test hoy.
  - "Tools de negocio tipadas adicionales" del estado original sigue sin concretar cuales.
- **Siguiente accion:** decidir si `with recursive` debe seguir permitido, anadir `lock_timeout`, y
  construir el primer lote de evals adversariales (empezando por intento cross-tenant y prompt
  injection) antes de declarar el gateway completo.

## Objetivo

Operar agentes auditables con contexto adaptativo, SQL de solo lectura y herramientas controladas.

## Entregables

- Orquestador de runs.
- SQL Gateway: SELECT/WITH, AST validation, tablas permitidas, timeout, limit y auditoria.
- Tools de negocio tipadas.
- RAG con ingestion, chunks, embeddings y citations.
- Approval service.
- Evals y datasets.

## Criterios de cierre

- Cero acceso a `private` o credenciales.
- El backend fuerza organizaciones autorizadas.
- Escrituras IA pasan por tools/RPCs y aprobaciones.

