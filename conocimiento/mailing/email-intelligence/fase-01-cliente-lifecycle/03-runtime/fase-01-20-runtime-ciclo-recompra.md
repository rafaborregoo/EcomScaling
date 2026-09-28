# Fase 1.20 — Ciclo esperado de recompra — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Estimar el intervalo esperado de recompra utilizando una jerarquía de evidencia.

---

# 1. Prioridad de evidencia

Ejemplo conceptual:

```text
customer_product_history
>
customer_category_history
>
product_population
>
category_population
>
tenant_default
```

---

# 2. Intervalos

Calcular diferencias entre compras válidas relacionadas.

---

# 3. Estadística robusta

La mediana puede ser más robusta que la media cuando existen outliers.

---

# 4. Muestra mínima

Con poco historial individual, utilizar fallback.

---

# 5. Cantidad

Si existe relación entre cantidad y duración, puede ajustarse.

---

# 6. Estacionalidad

Puede incorporarse cuando existe suficiente evidencia.

---

# 7. Resultado

Puede producir:
```text
expected_interval_days
confidence
source_level
range
```

---

# 8. Recalculo

Actualizar con nuevas compras.

---

# 9. Uso

Este valor puede alimentar:
- replenishment;
- at-risk;
- lapsed.

No debe disparar por sí solo un email.

---

# 10. Auditoría

Conservar:
```text
samples
method
source_level
calculated_at
version
```

---

# 11. Principio maestro

El ciclo de recompra debe estimarse desde la evidencia más específica disponible y degradar con claridad hacia fallbacks.
