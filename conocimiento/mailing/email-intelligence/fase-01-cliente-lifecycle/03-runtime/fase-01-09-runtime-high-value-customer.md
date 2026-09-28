# Fase 1.9 — High-Value Customer — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular de forma trazable si un cliente cumple los criterios configurados de alto valor.

---

# 1. Inputs posibles

```text
lifetime_revenue
lifetime_margin
order_count
average_order_value
return_cost
service_cost
```

No todos son obligatorios en todas las tiendas.

---

# 2. Evitar umbral universal

El runtime debe consumir configuración del tenant.

No hardcodear:

```text
HIGH_VALUE = revenue > X
```

globalmente.

---

# 3. Métodos posibles

La tienda puede definir:
- percentil;
- cuantía absoluta;
- combinación de métricas;
- score económico.

---

# 4. Transparencia

La clasificación debe poder explicar:

```text
metric
threshold
customer_value
result
```

---

# 5. Valor neto

Cuando existan datos fiables, puede ser preferible valorar contribución en lugar de revenue bruto.

---

# 6. Actualización

El estado debe recalcularse cuando cambian:
- pedidos;
- refunds;
- devoluciones;
- márgenes.

---

# 7. No mezclar intención

No incluir señales de checkout o browsing salvo que el tenant defina explícitamente un score distinto de “valor”.

---

# 8. No mezclar VIP

High-value y VIP deben poder coexistir de forma independiente.

---

# 9. Auditoría

Debe conservarse:
```text
calculated_at
definition_version
inputs
result
```

---

# 10. Principio maestro

El software calcula valor con datos y configuración.

El LLM interpreta después qué estrategia puede tener sentido.
