# Fase 1.15 — Intención de compra — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Derivar un `intent_state` o `intent_score` a partir de señales estructuradas.

---

# 1. Señales

Ejemplos:
```text
PRODUCT_VIEWED
SEARCH_PERFORMED
WISHLIST_ADDED
ADD_TO_CART
CHECKOUT_STARTED
```

---

# 2. Pesos

Las señales pueden tener pesos distintos.

No deben ser elegidos por el LLM en runtime.

---

# 3. Recency decay

Cada señal puede perder peso con el tiempo.

---

# 4. Repetition

La repetición puede aumentar score hasta límites razonables.

---

# 5. Progression bonus

La secuencia hacia checkout puede aportar mayor evidencia que eventos aislados.

---

# 6. Conversion reset

Tras una compra, la intención específica de esa oportunidad debe cerrarse o recalcularse.

---

# 7. Estados

Ejemplo:
```text
LOW
MEDIUM
HIGH
VERY_HIGH
```

Los thresholds deben configurarse.

---

# 8. Scope

Puede existir intención:
- global;
- por categoría;
- por producto.

No deben confundirse.

---

# 9. Explainability

Registrar:
```text
score
band
signals
decay
calculated_at
```

---

# 10. Data quality

Tracking incompleto debe reducir confianza.

---

# 11. Principio maestro

El intent engine transforma señales en una inferencia reproducible; no decide directamente el envío.
