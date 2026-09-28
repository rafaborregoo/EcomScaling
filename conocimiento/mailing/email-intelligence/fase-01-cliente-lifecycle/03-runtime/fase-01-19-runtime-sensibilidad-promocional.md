# Fase 1.19 — Sensibilidad promocional — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Derivar un estado o score de sensibilidad promocional.

---

# 1. Inputs

```text
orders_with_discount
orders_without_discount
discount_depth
promo_clicks
promo_conversions
full_price_conversions
```

---

# 2. Muestra mínima

No clasificar con demasiada confianza cuando existen pocas compras.

---

# 3. Score

Puede considerar:
- share de órdenes con descuento;
- lift observado;
- profundidad media.

---

# 4. Causalidad

Una mayor conversión durante promociones no demuestra por sí sola causalidad.

El runtime debe evitar claims causales sin experimentos.

---

# 5. Scope

Puede calcularse globalmente o por categoría.

---

# 6. Estados

Ejemplo:
```text
UNKNOWN
LOW
MEDIUM
HIGH
```

---

# 7. Explainability

Registrar:
```text
sample_size
discounted_orders
full_price_orders
score
confidence
```

---

# 8. Principio maestro

El software puede estimar sensibilidad; no debe convertirla automáticamente en una orden de aplicar descuento.
