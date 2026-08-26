# AI-24 — Runtime guard de capacidades preparadas

Estado: `done_local` · 2026-08-26

## Objetivo

Permitir que los agentes y sus versiones declaren desde ahora las capacidades
futuras de Meta e Instagram sin que una conexión incompleta produzca errores
opacos, llamadas sin autorización o datos inventados.

## Implementación

- `TOOL_REGISTRY` mantiene las capacidades futuras como `planned`.
- `TOOL_CONTRACTS` define entrada, paginación, salida y provenance antes de que
  exista el adapter externo.
- `authorizeTool` rechaza cualquier tool sin executor operativo con
  `tool_not_implemented`.
- `buildAgentTools` no expone las tools `planned` al proveedor de IA y añade al
  system prompt una declaración explícita de capacidad no disponible.
- `getUnavailableToolNames` permite evaluar esta frontera sin I/O.

## Criterio de activación posterior

Una capacidad solo puede pasar a `implemented_partial` y una versión solo puede
activarse cuando existan adapter, credenciales/scopes, conexión válida,
provenance real, tests de contrato y evals de grounding/abstención/seguridad.

## Verificación local

- `packages/ai/src/index.test.ts`: 54/54.
- `npx tsc -p packages/ai/tsconfig.json --noEmit`: pasa.
- `npx tsc -p apps/api/tsconfig.json --noEmit`: pasa.

No se afirma validación externa de Meta, Instagram ni Supabase.
