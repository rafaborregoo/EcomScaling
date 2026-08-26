# AI-31 — Persistencia de resultados shadow/live

Estado: `implemented_partial` · 2026-08-26

## Objetivo

Reutilizar el contrato AI-26 para que una evaluación provider-backed conserve
por agente el resultado, coste, latencia y trazabilidad sin crear otro sistema
de evidencias.

## Implementación

`buildLiveAgentEvalEvidencePayload` transforma resultados `shadow` o `live` en
el payload AI-26, calcula el score agregado y guarda los metadatos de cada caso
en `evidence`. El writer/RPC existente puede persistirlo de forma atómica e
idempotente.

`runAndPersistLiveAgentEvals` en `apps/api/src/agent-eval-runner.ts` conecta el
runner al writer AI-26 mediante un provider inyectado. Por defecto evalúa sólo
los casos del `agent_version` recibido, evitando mezclar versiones o agentes.
El provider real se añade cuando exista la credencial del conector; el flujo de
persistencia, timeout, retries, backoff y circuit breaker ya está preparado.

## Verificación

- Suite `live-eval-contract`: 8/8.
- Suite `agent-eval-runner`: 3/3.
- Typecheck de `packages/ai`: pasa.
- Typecheck de `apps/api`: pasa.

No ejecuta proveedores ni marca resultados live sin una invocación real del
provider inyectado.
