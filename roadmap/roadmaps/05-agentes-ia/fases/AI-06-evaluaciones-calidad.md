# AI-06 - Evaluaciones y calidad IA

## Estado

- **Estado real:** `foundational_work_in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** AI-00
- **Prioridad:** P0 — no se recomienda anadir agentes nuevos antes de tener una primera version seria de
  este archivo. `checkOutputSanity` es una guarda de sanidad estructural (texto vacio, repeticion
  corrupta, titulos vacios); no es groundedness (que cada afirmacion importante este respaldada por una
  metrica/consulta/cita/documento concreto) — son cosas distintas y este archivo cubre solo la primera.
- **Evidencia:** `checkOutputSanity` (`packages/ai/src/index.ts`), 15 tests en
  `packages/ai/src/index.test.ts` (`npm run test -w @ecomscaling/ai`, en CI).
- **Lo que ya funciona**: la guarda corre justo despues de la validacion de schema en `runAgentTurn` y
  rechaza (`AgentOutputValidationError` -> `rejected_output`, nunca `pending_approval`) salidas con
  answer/summary vacio, texto con fragmento repetido 5+ veces, o `proposed_writes`/`proposed_tasks` con
  titulo vacio o descripcion corrupta. Funciona por duck-typing sobre los contratos existentes (A02/A04/
  A06, A01, A09), asi que cubre agentes nuevos sin cambios. Detecto y previno en tests los dos glitches
  reales que motivaron su creacion (A02: answer vacio/texto corrupto; A06: answer/title vacios tras agotar
  tool calls). Rollback de prompt/version ya existe de facto via `agent_versions.is_active`.
- **Falta el entregable amplio, no solo pulido**:
  - Sin datasets de evaluacion por agente (A01: 30-50 transcripciones con resultado esperado; A02: casos
    de tienda sana/costes ausentes/stock roto/falsos positivos deliberados; A06: estacionalidad/ventas
    cero/producto nuevo).
  - Sin metricas automaticas mas alla de sanity (`citation_precision`, `unsupported_claim_rate`,
    `task_duplicate_rate`, `false_positive_rate`, `cross_tenant_violation_rate`, `p95_latency`,
    `average_cost`).
  - Sin quality gates con umbrales explicitos ni proceso de regresion obligatorio (dataset offline ->
    shadow -> canary -> activacion) antes de promover una version de prompt.
  - **Presupuesto de coste/latencia se registra pero no se aplica** — mismo gap ya senalado en AI-00.
  - Sin feedback estructurado del consultor (util/no util, prioridad correcta, edicion necesaria).
- **Siguiente accion:** construir el dataset de A02 primero (es el agente con mas impacto y el que menos
  control tiene hoy, ver AI-02) y definir 3-5 quality gates minimos antes de seguir anadiendo agentes.

## Objetivo

Medir seguridad, utilidad y regresiones antes de produccion.

## Entregables

- Datasets por agente.
- Tests de groundedness, permisos y falta de datos.
- Tests de prompt injection.
- Presupuesto maximo de coste y latencia.
- Feedback del consultor.

## Criterios de cierre

- Version nueva no degrada casos criticos.
- Errores de permiso objetivo cero.
- Existe rollback de prompt/version.

