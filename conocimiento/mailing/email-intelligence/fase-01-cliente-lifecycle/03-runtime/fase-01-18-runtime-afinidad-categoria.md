# Fase 1.18 — Afinidad de categoría — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular afinidad entre cliente y categoría a partir de eventos y compras.

---

# 1. Scope

```text
customer_id + category_id
```

---

# 2. Inputs

Agregar señales de productos pertenecientes a la categoría.

---

# 3. Pesos

Diferenciar:
- purchase;
- repeat purchase;
- view;
- click;
- wishlist.

---

# 4. Decay

Aplicar pérdida de peso temporal.

---

# 5. Taxonomía

El runtime debe utilizar la taxonomía real del catálogo.

---

# 6. Categorías jerárquicas

Si se propaga score a categorías padre, la regla debe ser explícita.

---

# 7. Explainability

Registrar productos y eventos que contribuyeron.

---

# 8. Principio maestro

La afinidad de categoría debe ser agregada, trazable y coherente con el catálogo real.
