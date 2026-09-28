# Fase 13.9 — Offer Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Offer Engine selecciona o valida una oferta comercial compatible con objetivo, cliente y economía.

Debe poder evaluar:
- percentage discount;
- fixed discount;
- free shipping;
- bundle;
- BOGO;
- gift;
- tiered discounts;
- quantity breaks;
- early access;
- no-discount benefits.

La oferta debe superar filtros de:
- elegibilidad;
- margen;
- stacking;
- producto;
- vigencia;
- mercado;
- historial promocional.

El motor puede devolver `NO_OFFER` cuando ninguna oferta mejora la decisión.

---

## Entradas conceptuales

- `customer_context`
- `product_context`
- `available_offers`
- `margin_context`
- `promotion_history`
- `market_context`

---

## Salidas conceptuales

- `selected_offer`
- `alternative_offers`
- `economic_impact`
- `reason_codes`
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
