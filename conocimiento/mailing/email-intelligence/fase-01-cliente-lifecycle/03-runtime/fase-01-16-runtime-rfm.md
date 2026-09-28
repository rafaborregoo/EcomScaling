# Fase 1.16 — RFM — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular RFM de forma determinista y versionada.

---

# 1. Recency

```text
analysis_date - last_valid_order_at
```

---

# 2. Frequency

Número de pedidos válidos dentro de la ventana configurada.

---

# 3. Monetary

Suma de la métrica económica definida:
```text
revenue
or
margin
```

---

# 4. Ventana

Debe ser configurable por tenant.

---

# 5. Scoring

Puede usar:
- quintiles;
- percentiles;
- thresholds absolutos.

---

# 6. Empates y distribuciones pequeñas

El algoritmo debe manejar muestras pequeñas sin producir bandas engañosas.

---

# 7. Refunds

Debe existir política explícita sobre cómo afectan monetary.

---

# 8. Recalculo

RFM puede recalcularse periódicamente.

---

# 9. Auditoría

Guardar:
```text
R
F
M
score
window
definition_version
calculated_at
```

---

# 10. Principio maestro

RFM debe ser reproducible con los mismos datos y configuración.
