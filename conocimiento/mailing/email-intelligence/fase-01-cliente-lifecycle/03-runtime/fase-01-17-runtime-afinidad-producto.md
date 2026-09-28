# Fase 1.17 — Afinidad de producto — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Derivar afinidad por producto mediante señales estructuradas.

---

# 1. Señales candidatas

```text
PURCHASE
REPEAT_PURCHASE
PRODUCT_VIEW
WISHLIST
EMAIL_PRODUCT_CLICK
RETURN
```

---

# 2. Pesos

Compras y repeticiones pueden tener mayor peso que views.

La configuración debe ser explícita.

---

# 3. Decay

Señales antiguas deben perder peso.

---

# 4. Scope

La afinidad se calcula por:
```text
customer_id + product_id
```

---

# 5. Negative signals

El modelo puede reducir score ante:
- devolución;
- rechazo explícito;
- falta persistente de interacción.

---

# 6. Estados

Ejemplo:
```text
LOW
MEDIUM
HIGH
```

---

# 7. Explainability

Conservar señales que justifican el score.

---

# 8. Principio maestro

Afinidad debe surgir de evidencia acumulada, no del LLM.
