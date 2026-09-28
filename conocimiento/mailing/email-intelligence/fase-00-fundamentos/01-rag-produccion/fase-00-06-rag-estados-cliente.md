# Fase 0.6 — Estados del cliente

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente los estados de un cliente dentro de un ecommerce.

Un estado representa una condición relevante del cliente durante un periodo determinado.

No debe confundirse con un evento puntual.

---

# 1. Estado vs evento

```text
EVENT = algo ocurrió
STATE = condición actual
```

Ejemplo:

```text
ORDER_PLACED
```

puede ayudar a determinar:

```text
FIRST_TIME_BUYER
```

---

# 2. Los estados son derivados

Muchos estados no son hechos directos.

Se construyen a partir de:

- eventos;
- historial;
- tiempo;
- compras;
- engagement;
- comportamiento.

Ejemplo:

```text
AT_RISK
```

es una interpretación.

---

# 3. Estados multidimensionales

Una persona puede tener simultáneamente:

```text
lifecycle_state = REPEAT_BUYER
intent_state = HIGH
engagement_state = MEDIUM
value_state = HIGH
```

No debe reducirse al cliente a una única etiqueta.

---

# 4. Estado de lifecycle

Ejemplos:

```text
PROSPECT
FIRST_TIME_BUYER
REPEAT_BUYER
HIGH_VALUE_CUSTOMER
VIP
AT_RISK
LAPSED
REACTIVATED
```

Describe relación global con la marca.

---

# 5. Estado de intención

Ejemplos:

```text
LOW
MEDIUM
HIGH
VERY_HIGH
```

Describe proximidad estimada a una acción comercial.

---

# 6. Estado de engagement

Ejemplos:

```text
ENGAGED
ACTIVE
COOLING
DISENGAGED
```

Describe nivel de interacción.

---

# 7. Estado de valor

Puede representar:

```text
LOW_VALUE
MEDIUM_VALUE
HIGH_VALUE
```

según el contexto económico de la tienda.

---

# 8. Estado de afinidad

Puede existir para:

- categoría;
- producto;
- colección.

Ejemplo:

```text
SKINCARE_AFFINITY_HIGH
```

Debe ser una inferencia basada en señales.

---

# 9. Estado de riesgo

Ejemplos:

```text
CHURN_RISK
DELIVERABILITY_RISK
RETURN_RISK
```

Debe existir evidencia suficiente.

---

# 10. Estado comercial

Puede describir situaciones como:

```text
CART_ACTIVE
CHECKOUT_ACTIVE
POST_PURCHASE
```

Son estados contextuales y temporales.

---

# 11. Estado operativo

Ejemplos:

```text
ORDER_IN_TRANSIT
RETURN_IN_PROGRESS
SUPPORT_ISSUE_OPEN
```

Pueden modificar qué comunicación resulta apropiada.

---

# 12. Estados temporales

Algunos estados cambian rápidamente.

Ejemplo:

```text
HIGH_INTENT
```

puede desaparecer tras compra o inactividad.

---

# 13. Estados relativamente estables

Otros pueden mantenerse durante más tiempo.

Ejemplo:

```text
REPEAT_BUYER
```

aunque no haya actividad esta semana.

---

# 14. Estados incompatibles

Algunos estados no deberían coexistir conceptualmente.

Ejemplo:

```text
PROSPECT
```

y:

```text
REPEAT_BUYER
```

para la misma definición de lifecycle.

La IA debe detectar incoherencias.

---

# 15. Estados complementarios

Otros sí pueden coexistir.

```text
VIP
+
HIGH_INTENT
+
LOW_EMAIL_ENGAGEMENT
```

---

# 16. Estados y recencia

Un estado puede perder validez si se basa en señales antiguas.

Ejemplo:

```text
HIGH_INTENT
```

no debería permanecer indefinidamente sin nueva evidencia.

---

# 17. Estados y comportamiento nuevo

Un evento nuevo puede cambiar la interpretación.

Ejemplo:

```text
AT_RISK
→ ORDER_PLACED
→ REACTIVATED
```

---

# 18. Estados y estrategia

Una clasificación solo tiene utilidad si cambia alguna decisión.

Puede afectar:

- objetivo;
- mensaje;
- oferta;
- producto;
- frecuencia;
- prioridad.

---

# 19. Estado desconocido

Cuando no existe información suficiente, la IA debe aceptar:

```text
UNKNOWN
```

en lugar de inventar.

---

# 20. No aplicable

`UNKNOWN` y `NOT_APPLICABLE` no significan lo mismo.

```text
UNKNOWN = no tenemos información suficiente
NOT_APPLICABLE = esa dimensión no corresponde
```

---

# 21. Estado observado vs inferido

Algunos estados pueden estar directamente documentados.

Otros son inferencias.

El agente debe distinguir su nivel de certeza.

---

# 22. Estado y confianza

Cuanto más inferido sea el estado, más importante es considerar:

- calidad de datos;
- cantidad de señales;
- recencia;
- consistencia.

---

# 23. Estado y lifecycle

El lifecycle no debería describir por sí solo:

- intención;
- engagement;
- valor;
- afinidad.

Estas dimensiones deben mantenerse separadas.

---

# 24. Estado y personalización

Una personalización útil puede surgir de la combinación:

```text
lifecycle
+
intent
+
affinity
+
engagement
```

---

# 25. Estado y conflicto

Una persona puede tener una oportunidad comercial y simultáneamente un estado operativo que la contradiga.

Ejemplo:

```text
HIGH_INTENT
+
SUPPORT_ISSUE_OPEN
```

La estrategia debe considerar ambos.

---

# 26. Estado y presión comercial

Un estado de alta intención no significa permiso para contacto ilimitado.

La presión es otra dimensión.

---

# 27. Estado y compra reciente

La compra puede invalidar estados previos como:

```text
CART_ABANDONER
```

El sistema conceptual debe priorizar información más actual.

---

# 28. Estado y devolución

Una devolución puede modificar:

- satisfacción;
- afinidad;
- recomendaciones;
- riesgo.

No debe ignorarse.

---

# 29. Estado y frecuencia esperada

Estados como `AT_RISK` o `LAPSED` deben interpretarse según el ciclo normal de compra de la categoría.

---

# 30. Antipatrón: una sola etiqueta

Ejemplo:

```text
customer_type = VIP
```

no explica intención, engagement ni contexto operativo.

---

# 31. Antipatrón: estados permanentes

Los estados deben poder evolucionar.

---

# 32. Antipatrón: demasiados estados

Crear categorías excesivamente específicas dificulta comprensión y mantenimiento.

---

# 33. Antipatrón: usar estados sin evidencia

La IA no debe clasificar:

```text
HIGH_INTENT
```

solo porque “parece probable”.

---

# 34. Preguntas que debe hacerse el agente

```text
¿Qué estado estamos describiendo?
¿Es lifecycle, intención, engagement, valor o riesgo?
¿Qué evidencia lo soporta?
¿Cuándo se calculó?
¿Sigue siendo válido?
¿Qué eventos recientes pueden modificarlo?
¿Qué otras dimensiones deben considerarse?
```

---

# 35. Principio maestro

El cliente no es una etiqueta.

Debe entenderse como una combinación dinámica de estados.

```text
CUSTOMER_CONTEXT
=
lifecycle
+
intent
+
engagement
+
value
+
affinity
+
operational_context
+
risk
```

El objetivo es utilizar los estados para mejorar decisiones, no para simplificar en exceso la realidad.
