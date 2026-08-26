# AI-29 — Readiness de evaluaciones conectado a UI

Estado: `implemented_partial` · 2026-08-26

## Objetivo

Conectar la UI de agentes con la evidencia AI-26 sin convertir la ausencia de
la migración remota en un error ni presentar validación live inventada.

## Implementación

- `GET /v1/agents/eval-readiness` restringido a consultor/platform admin.
- Lee evaluaciones pasadas del dataset versionado cuando AI-26 existe.
- Filtra códigos contra el catálogo real de diez agentes.
- Devuelve `local_prepared` si Supabase aún no conoce la tabla.
- Solo degrada ante la ausencia esperada de la tabla; permisos, red u otros
  errores se propagan como fallo operativo.
- Solo cuenta evidencia vinculada a versiones de agente activas.
- `AgentEvalReadinessPanel` consume el endpoint y conserva fallback local.

## Verificación

- Tests API/UI: 6/6.
- Typecheck API y web: pasan.
- No se exponen resultados a clientes ni se afirma validación live sin evidencia.
