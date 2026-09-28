# Fase 13.10 — Product Recommendation Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Product Recommendation Engine genera y rankea productos relevantes para una persona y contexto.

Debe separar:
1. candidate generation;
2. hard filters;
3. ranking;
4. explanation.

Puede utilizar:
- affinity;
- intent;
- purchase history;
- complementarity;
- stock;
- margin;
- merchandising priority;
- lifecycle.

Debe excluir productos no disponibles, incompatibles o irrelevantes por ownership cuando proceda.

No debe utilizar popularidad como sustituto universal de personalización.

---

## Entradas conceptuales

- `customer_context`
- `catalog`
- `affinity_scores`
- `intent_scores`
- `purchase_history`
- `product_relationships`
- `inventory`
- `margin_context`

---

## Salidas conceptuales

- `ranked_products`
- `recommendation_reasons`
- `excluded_candidates`
- `confidence`
- `model_version`

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
