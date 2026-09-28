# Fase 1.11 — At-Risk — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular de forma reproducible cuándo un cliente entra o sale de estado de riesgo.

---

# 1. Inputs posibles

```text
time_since_last_order
expected_repurchase_interval
purchase_frequency
engagement_trend
support_events
return_events
```

---

# 2. Baseline

Siempre que sea posible, comparar contra:
- patrón individual;
- categoría;
- cohorte;
- tenant.

---

# 3. Regla configurable

El estado no debe depender de una cifra universal.

---

# 4. Histeresis

Conviene evitar cambios constantes de:
```text
AT_RISK ↔ ACTIVE
```
por pequeñas variaciones.

---

# 5. Reactivación

Una nueva compra o señal fuerte puede sacar al cliente de riesgo.

---

# 6. Explicabilidad

Guardar reason codes:
```text
REBUY_DELAY
FREQUENCY_DROP
ENGAGEMENT_DROP
SERVICE_ISSUE
```

---

# 7. Confidence

Si el riesgo depende de inferencias estadísticas, debe conservarse nivel de confianza o calidad de datos.

---

# 8. Auditoría

Registrar inputs y versión de reglas.

---

# 9. Lo que no decide

No decide automáticamente:
- descuento;
- win-back;
- frecuencia;
- canal.

---

# 10. Principio maestro

El runtime detecta desviación.

La capa estratégica decide qué hacer con ella.
