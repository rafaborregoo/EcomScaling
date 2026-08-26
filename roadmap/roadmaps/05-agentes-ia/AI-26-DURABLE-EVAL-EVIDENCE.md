# AI-26 — Evidencia durable de evaluaciones

Estado: `implemented_partial` · 2026-08-26

## Objetivo

Persistir la evidencia del release gate por versión de agente y dataset para
que la activación futura sea auditable y reproducible, sin crear una empresa
ficticia ni mezclar resultados con datos de clientes.

## Contrato local

La migración `20260826140000_ai_26_agent_eval_evidence.sql` añade:

- `agent_version_evaluations`: dataset, modo (`offline`, `shadow`, `live`),
  estado, métricas agregadas, cobertura y evidencia.
- `agent_version_eval_results`: resultado individual por agente, número de
  checks, fallos y métricas.
- unicidad por versión/dataset/modo y por agente dentro de una evaluación.
- RLS de lectura solo para plataforma; escritura prevista para service role.

`packages/db/src/agent-evaluation.types.ts` mantiene el overlay local hasta que
se pueda regenerar el typegen oficial de Supabase.

`packages/ai/src/agent-eval-evidence.ts` transforma los resultados deterministas
en el payload de ambas tablas, rechaza evaluaciones vacías o agentes duplicados
y conserva los fallos con el código del agente. La persistencia sigue separada
del runner para que solo un worker con service role pueda escribirla.

La función privada `record_agent_version_evaluation(jsonb)` y
`apps/api/src/agent-eval-evidence-store.ts` guardan el resumen y todas las filas
por agente de forma atómica e idempotente. Si falla la RPC, el wrapper devuelve
un error explícito y no simula que la evidencia se guardó.

## Verificación

- Typecheck de `packages/db`: pasa.
- Suite del serializador y dataset: 8/8.
- Typecheck de `packages/ai`: pasa.
- Wrapper API de persistencia: 2/2.
- Typecheck de `apps/api`: pasa.
- La aplicación remota, advisors y typegen oficial siguen pendientes del gate
  externo de permisos Supabase.
