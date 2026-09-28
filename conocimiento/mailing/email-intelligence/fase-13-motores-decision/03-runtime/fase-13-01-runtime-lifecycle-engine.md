# Fase 13.1 — Lifecycle Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Lifecycle Engine determina el estado de relación comercial de una persona con la tienda a partir de eventos y estados observables.

Debe consolidar, como mínimo, estados como:
`SUBSCRIBER`, `PROSPECT`, `FIRST_TIME_BUYER`, `REPEAT_BUYER`, `AT_RISK`, `LAPSED`, `REACTIVATED` y otros estados compatibles definidos por la arquitectura.

No debe inferir lifecycle desde copy ni desde una única señal aislada. La prioridad debe recaer en hechos transaccionales y reglas explícitas.

El motor debe permitir estados multidimensionales: una persona puede ser `REPEAT_BUYER` y además `AT_RISK`; lifecycle base y estados de riesgo no deben colapsarse en una sola etiqueta cuando eso destruye información.

---

## Entradas conceptuales

- `customer_id`
- `valid_order_history`
- `subscription_state`
- `last_order_at`
- `repurchase_cycle_context`
- `reactivation_events`

---

## Salidas conceptuales

- `lifecycle_state`
- `secondary_states`
- `state_since`
- `reason_codes`
- `confidence`
- `rules_version`

Estas salidas describen responsabilidades del motor. Los contratos formales de agentes y schemas de IA se definen en la Fase 14.

---

## Pipeline mínimo

```text
INPUTS
→ NORMALIZE
→ VALIDATE
→ APPLY RULES
→ RESOLVE CONFLICTS
→ COMPUTE
→ EXPLAIN
→ OUTPUT
```

---

## Invariantes

- determinismo: mismos inputs + misma versión de reglas = mismo resultado;
- idempotencia donde existan eventos o transiciones;
- source of truth explícito;
- estados `UNKNOWN` cuando falte evidencia;
- reason codes obligatorios en decisiones relevantes;
- versionado de reglas;
- auditoría de inputs esenciales y resultado;
- separación entre cálculo y generación de lenguaje.

---

## Observabilidad

El motor debe poder explicar:

```text
qué datos usó
qué reglas aplicó
qué reglas bloquearon
qué resultado produjo
qué versión estaba activa
cuándo se calculó
```

---

## Principio maestro

Este motor debe ser ejecutable sin necesidad de que un LLM improvise lógica de negocio.
