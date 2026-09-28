# Fase 1.10 — VIP — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Evaluar de forma determinista si un cliente cumple la definición VIP configurada por la tienda.

---

# 1. No existe regla global

El runtime debe consumir criterios de tenant.

---

# 2. Criterios posibles

Ejemplos:
```text
loyalty_tier
lifetime_value
order_count
membership
manual_vip_flag
advocacy_status
```

---

# 3. VIP manual

Debe permitirse, si la arquitectura lo requiere, una clasificación manual explícita.

---

# 4. VIP automático

Puede derivarse de reglas configuradas.

---

# 5. Explicabilidad

Debe poder saberse:
```text
VIP = true
reason = loyalty_tier_gold
```

o equivalente.

---

# 6. Recalculo

Si depende de métricas dinámicas, el estado debe actualizarse.

---

# 7. Beneficios

El runtime de clasificación no debería inventar beneficios.

Debe consultar configuración de tenant.

---

# 8. Auditoría

Registrar:
```text
definition_version
reason
calculated_at
```

---

# 9. Principio maestro

VIP debe provenir de una definición explícita y trazable, nunca de una impresión del LLM.
