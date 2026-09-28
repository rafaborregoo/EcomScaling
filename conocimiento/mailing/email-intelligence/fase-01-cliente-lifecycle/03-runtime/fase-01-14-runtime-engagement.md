# Fase 1.14 — Engagement — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular un estado de engagement reproducible a partir de señales observables.

---

# 1. Señales candidatas

```text
email_click
email_reply
site_visit
product_view
cart
purchase
```

Las aperturas pueden tener peso limitado.

---

# 2. Dimensiones

Un modelo puede considerar:
```text
recency
frequency
signal_strength
```

---

# 3. Decay

Las señales deben perder peso con el tiempo.

---

# 4. Pesos configurables

No asumir que todos los eventos valen lo mismo.

Ejemplo:
```text
purchase > click > open
```
como principio general, pero la configuración exacta pertenece al sistema.

---

# 5. Estados derivados

Posibles:
```text
HIGH
MEDIUM
LOW
DISENGAGED
```

Los nombres son configurables.

---

# 6. No usar opens exclusivamente

El score debe ser robusto ante tracking imperfecto.

---

# 7. Score explicable

Debe poder mostrarse qué señales justifican el estado.

---

# 8. Refresh

Recalcular al recibir eventos relevantes o periódicamente.

---

# 9. Tenant calibration

Los umbrales pueden variar por negocio.

---

# 10. Auditoría

Conservar:
```text
score
band
inputs
calculated_at
model_version
```

---

# 11. Principio maestro

Engagement debe ser una función transparente de señales, recencia y frecuencia.
