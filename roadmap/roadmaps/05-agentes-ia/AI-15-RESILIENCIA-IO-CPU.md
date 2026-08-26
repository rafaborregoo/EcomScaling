# AI-15 — Resiliencia y rendimiento del runtime IA

## Objetivo

Evitar que una caída o lentitud de Anthropic, OpenAI o cualquier futuro
conector bloquee indefinidamente los agentes, sature el event loop o repita
efectos secundarios.

## Contrato implementado

- Timeout abortable por petición: 45 segundos por defecto.
- Hasta 2 retries, únicamente para timeouts, red, 408/409/425/429 y 5xx.
- Backoff exponencial con jitter, acotado entre 500 ms y 8 segundos.
- Circuit breaker durable por organización: 3 fallos recientes en 5 minutos;
  fail-closed si no se puede consultar su estado.
- Las llamadas de modelo sí pueden reintentarse; las tools no, porque pueden
  producir auditorías o escrituras duplicadas.

## I/O-bound y CPU-bound

Las esperas de red son asíncronas, cancelables y con límites. Las consultas
independientes se ejecutan en paralelo con límites explícitos. Parseo,
validación y serialización están acotados por presupuesto, tamaño y número de
iteraciones; ingestión y sincronización permanecen en workers para no bloquear
la API. Ningún retry es infinito.

## Evidencia

- Implementación: `packages/ai/src/resilience.ts`.
- Integración: `runAgentTurn` y `runAgentTurnOpenAI`.
- Tests: `packages/ai/src/resilience.test.ts`.
- Decisión: `docs/decisions/ADR-0019-resiliencia-runtime-ia.md`.

## Regla para nuevos agentes

Todo nuevo proveedor o worker debe reutilizar este contrato antes de entrar
en producción. El prompt nunca puede aumentar timeout, retries, concurrencia
o coste; esos límites pertenecen al backend.
