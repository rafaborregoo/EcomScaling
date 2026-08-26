# AI-30 — Contrato de evaluaciones shadow/live

Estado: `implemented_partial` · 2026-08-26

## Objetivo

Dejar listo el paso desde evals offline deterministas a evaluaciones con
proveedor, sin llamar a modelos cuando faltan claves y sin perder coste,
latencia, trazabilidad o criterios de abstención.

## Implementación

`packages/ai/src/live-eval-contract.ts` define:

- casos por agente y contexto de evidencia esperado;
- modos `shadow` y `live`;
- provider inyectable, sin acoplar el runner a Anthropic/OpenAI;
- validación de evidencia, abstención, coste, latencia y `traceId`;
- error explícito `live_eval_provider_required` cuando no hay proveedor.
- caso base automático de abstención para los diez agentes del catálogo.
- suite por lotes con concurrencia I/O configurable y fallo aislado por caso.
- timeout, retries y backoff exponencial mediante la política común de IA.
- circuit breaker local configurable que marca `circuit_open` sin seguir
  golpeando un proveedor caído.

## Verificación

- Suite del contrato y matriz: 8/8.
- Typecheck de `packages/ai`: pasa.

La evaluación semántica completa sigue requiriendo dataset real versionado,
claves y trazas LangSmith; este contrato no simula esos resultados.
