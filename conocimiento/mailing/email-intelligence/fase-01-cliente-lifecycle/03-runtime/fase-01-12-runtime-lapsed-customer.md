# Fase 1.12 — Lapsed Customer — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Determinar cuándo la inactividad de un comprador supera la ventana esperada.

---

# 1. Inputs

```text
last_order_at
expected_repurchase_interval
historical_purchase_frequency
category_cycle
```

---

# 2. Umbral configurable

Debe existir una política de lapse por tenant o categoría.

---

# 3. Condición conceptual

```text
time_since_last_order
>
expected_cycle * lapse_factor
→ LAPSED
```

La fórmula concreta no es universal.

---

# 4. Sin ciclo conocido

Cuando no exista suficiente historial, puede utilizarse un baseline de categoría o tenant.

Debe marcarse la menor confianza.

---

# 5. Reactivación

Una nueva compra debe sacar al cliente de lapsed.

---

# 6. Engagement separado

No utilizar clicks para falsificar actividad comercial si el estado mide compra.

Puede conservarse un estado de engagement independiente.

---

# 7. Auditoría

Registrar:
```text
expected_cycle
lapse_threshold
last_order_at
calculated_at
```

---

# 8. Principio maestro

El lapse se calcula contra una expectativa contextual, no contra una constante global.
