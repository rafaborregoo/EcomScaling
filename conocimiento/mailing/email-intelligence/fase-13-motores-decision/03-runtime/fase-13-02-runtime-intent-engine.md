# Fase 13.2 — Intent Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Intent Engine estima la proximidad de una persona a una acción comercial utilizando señales estructuradas.

Debe consumir eventos como product views, search, wishlist, cart, checkout, repetición, secuencia y recencia.

La intención debe poder calcularse en distintos scopes:
- global;
- categoría;
- producto.

Debe aplicar decay temporal y distinguir intención actual de afinidad persistente.

No debe convertir un score en una decisión de envío. El output alimenta otros motores.

---

## Entradas conceptuales

- `behavior_events`
- `product_events`
- `cart_state`
- `checkout_state`
- `recency`
- `sequence`
- `frequency`

---

## Salidas conceptuales

- `intent_score`
- `intent_band`
- `scope`
- `top_signals`
- `confidence`
- `calculated_at`
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
