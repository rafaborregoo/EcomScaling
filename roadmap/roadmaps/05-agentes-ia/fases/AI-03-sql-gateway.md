# AI-03 - SQL Gateway

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

