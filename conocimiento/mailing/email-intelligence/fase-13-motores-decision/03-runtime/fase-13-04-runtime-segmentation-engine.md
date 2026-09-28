# Fase 13.4 — Segmentation Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Segmentation Engine evalúa pertenencia a segmentos a partir de reglas estructuradas.

Debe soportar condiciones sobre:
- lifecycle;
- intent;
- engagement;
- purchase history;
- RFM;
- affinity;
- geography;
- value;
- promotional sensitivity;
- operational state.

Un segmento debe ser reproducible a partir de una definición versionada.

El motor no debe decidir por sí solo qué segmentos “son buenos”; solo evalúa pertenencia.

---

## Entradas conceptuales

- `segment_definition`
- `customer_snapshot`
- `derived_states`
- `catalog_context`
- `market_context`

---

## Salidas conceptuales

- `segment_memberships`
- `matched_rules`
- `excluded_rules`
- `definition_version`
- `evaluated_at`

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
