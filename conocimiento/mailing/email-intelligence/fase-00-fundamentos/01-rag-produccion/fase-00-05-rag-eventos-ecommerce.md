# Fase 0.5 — Eventos del ecommerce

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA los eventos que ocurren dentro de un ecommerce y cómo deben utilizarse como evidencia para interpretar comportamiento, intención, progresión y contexto.

Un evento representa algo que ocurrió en un momento determinado.

Ejemplos:

```text
PRODUCT_VIEWED
ADD_TO_CART
CHECKOUT_STARTED
ORDER_PLACED
EMAIL_CLICKED
```

Un evento no describe por sí solo quién es el cliente ni qué hará después.

---

# 1. Evento vs estado

```text
EVENT = algo ocurrió
STATE = condición actual
```

Ejemplo:

```text
ORDER_PLACED
```

puede contribuir a:

```text
FIRST_TIME_BUYER
```

pero no son conceptos equivalentes.

---

# 2. Evento vs inferencia

```text
PRODUCT_VIEWED
```

es un hecho observable.

```text
HIGH_PRODUCT_INTEREST
```

es una interpretación.

La IA debe mantener separadas evidencia e inferencia.

---

# 3. El contexto determina el significado

Un mismo evento puede tener significados distintos según:

- recencia;
- frecuencia;
- secuencia;
- producto;
- lifecycle;
- historial;
- dispositivo;
- fuente.

Una única visualización de producto no equivale necesariamente a intención alta.

---

# 4. Recencia

Los eventos recientes suelen ser más relevantes para decisiones inmediatas.

```text
PRODUCT_VIEWED hace 10 minutos
```

no debe interpretarse igual que:

```text
PRODUCT_VIEWED hace 90 días
```

---

# 5. Frecuencia

La repetición puede aumentar la fuerza de una señal.

```text
PRODUCT_VIEWED x1
```

es diferente de:

```text
PRODUCT_VIEWED x7
```

en sesiones recientes.

---

# 6. Secuencia

El orden aporta información.

```text
CATEGORY_VIEWED
→ PRODUCT_VIEWED
→ ADD_TO_CART
→ CHECKOUT_STARTED
```

puede representar progresión.

---

# 7. Eventos de identidad

Ejemplos:

```text
EMAIL_SUBSCRIBED
EMAIL_UNSUBSCRIBED
ACCOUNT_CREATED
PROFILE_UPDATED
```

Describen cambios en la relación identificable con la marca.

---

# 8. Eventos de navegación

Ejemplos:

```text
SESSION_STARTED
PAGE_VIEWED
CATEGORY_VIEWED
COLLECTION_VIEWED
PRODUCT_VIEWED
SEARCH_PERFORMED
FILTER_APPLIED
```

Suelen representar exploración y consideración.

---

# 9. Eventos de intención

Ejemplos:

```text
WISHLIST_ADDED
ADD_TO_CART
CART_UPDATED
CHECKOUT_STARTED
```

Suelen tener mayor peso comercial que una visita general.

---

# 10. Eventos de conversión

Ejemplos:

```text
ORDER_PLACED
PAYMENT_COMPLETED
```

El agente debe reconocer cuál representa la conversión válida dentro del contexto de la tienda.

---

# 11. Eventos de pedido

Ejemplos:

```text
ORDER_CONFIRMED
ORDER_CANCELLED
ORDER_REFUNDED
ORDER_PARTIALLY_REFUNDED
```

Pueden cambiar por completo la estrategia posterior.

---

# 12. Eventos logísticos

Ejemplos:

```text
ORDER_FULFILLED
SHIPMENT_CREATED
SHIPMENT_IN_TRANSIT
SHIPMENT_DELIVERED
DELIVERY_DELAYED
```

Son esenciales para postcompra, reassurance y soporte preventivo.

---

# 13. Eventos de devolución

Ejemplos:

```text
RETURN_REQUESTED
RETURN_APPROVED
RETURN_COMPLETED
```

Pueden afectar recomendaciones, satisfacción y futuras comunicaciones.

---

# 14. Eventos de soporte

Ejemplos:

```text
SUPPORT_TICKET_OPENED
SUPPORT_TICKET_RESOLVED
COMPLAINT_CREATED
```

Un problema abierto puede tener prioridad estratégica sobre una oportunidad comercial.

---

# 15. Eventos de email

Ejemplos:

```text
EMAIL_SENT
EMAIL_DELIVERED
EMAIL_OPENED
EMAIL_CLICKED
EMAIL_BOUNCED
EMAIL_UNSUBSCRIBED
SPAM_COMPLAINT
```

No todos tienen el mismo valor.

---

# 16. Aperturas

Las aperturas pueden aportar contexto, pero no deben utilizarse como prueba única de:

- interés;
- intención;
- engagement.

---

# 17. Clicks

Un click gana valor cuando se conoce el objeto de la interacción.

```text
click_product
```

es diferente de:

```text
click_footer
```

---

# 18. Eventos de producto

Ejemplos:

```text
PRODUCT_VIEWED
PRODUCT_ADDED_TO_WISHLIST
ADD_TO_CART
PRODUCT_REMOVED_FROM_CART
```

Ayudan a interpretar interés específico.

---

# 19. Eventos de categoría

Ejemplos:

```text
CATEGORY_VIEWED
COLLECTION_VIEWED
SEARCH_PERFORMED
```

Pueden ayudar a inferir afinidad sin asumir un SKU concreto.

---

# 20. Eventos positivos y negativos

No todos los eventos indican oportunidad.

Ejemplos negativos:

```text
ORDER_CANCELLED
RETURN_REQUESTED
SPAM_COMPLAINT
UNSUBSCRIBE
```

La IA debe interpretar también señales de fricción y riesgo.

---

# 21. Eventos y lifecycle

Un evento puede provocar una transición conceptual.

```text
PROSPECT
→ ORDER_PLACED
→ FIRST_TIME_BUYER
```

Pero el lifecycle es una interpretación del historial, no el evento en sí.

---

# 22. Eventos y intención

La intención puede aumentar con una secuencia como:

```text
PRODUCT_VIEWED
→ ADD_TO_CART
→ CHECKOUT_STARTED
```

Debe tratarse como inferencia basada en evidencia.

---

# 23. Eventos y abandono

El abandono no es simplemente un evento aislado.

Normalmente implica:

```text
relevant_event
+
time_without_progression
+
no_conversion
```

Por ejemplo, `ADD_TO_CART` no significa automáticamente cart abandonment.

---

# 24. Eventos y compra posterior

Cuando ocurre:

```text
ORDER_PLACED
```

una estrategia de abandono anterior puede dejar de ser relevante.

La IA debe interpretar siempre la secuencia completa.

---

# 25. Eventos contradictorios

Puede existir información incompatible.

Ejemplo:

```text
ORDER_PLACED
```

seguido por datos que todavía muestran:

```text
checkout_abandoned
```

El agente debe reconocer la contradicción en lugar de asumir que ambas cosas son válidas simultáneamente.

---

# 26. Calidad del evento

El valor de un evento depende de:

- fuente;
- precisión;
- timestamp;
- identidad;
- duplicidad;
- consistencia.

Un evento defectuoso puede producir una mala decisión.

---

# 27. Eventos duplicados

Múltiples registros técnicos del mismo hecho no equivalen a múltiples acciones reales.

La IA debe comprender que la calidad de tracking condiciona la interpretación.

---

# 28. Eventos anónimos e identificados

Un evento puede pertenecer a:

```text
anonymous_user
```

o:

```text
known_customer
```

Para email marketing, la capacidad de actuar depende de que exista una identidad utilizable y elegible.

---

# 29. Eventos de alta señal

Ejemplos típicos:

```text
ADD_TO_CART
CHECKOUT_STARTED
ORDER_PLACED
```

Suelen tener mayor utilidad para decisiones comerciales inmediatas.

---

# 30. Eventos de señal media

Ejemplos:

```text
REPEATED_PRODUCT_VIEW
SEARCH_PERFORMED
WISHLIST_ADDED
```

Su valor depende del contexto.

---

# 31. Eventos de señal débil

Ejemplos:

```text
HOME_PAGE_VIEWED
SINGLE_PAGE_VIEW
GENERIC_SESSION
```

No deben desencadenar conclusiones fuertes por sí solos.

---

# 32. Eventos de postcompra

Ejemplos:

```text
ORDER_DELIVERED
PRODUCT_REVIEWED
RETURN_REQUESTED
SECOND_ORDER_PLACED
```

Ayudan a interpretar satisfacción, retención y evolución.

---

# 33. Eventos y aprendizaje

El análisis agregado de eventos puede revelar:

- patrones de compra;
- ciclos;
- puntos de fricción;
- comportamiento por categoría.

Pero correlación no implica causalidad.

---

# 34. Preguntas que debe hacerse el agente

```text
¿Qué ocurrió?
¿Cuándo?
¿Cuántas veces?
¿En qué orden?
¿A qué producto o categoría afecta?
¿Quién realizó la acción?
¿Existe compra posterior?
¿Existe un evento que invalide esta interpretación?
¿Es una señal fuerte o débil?
¿Qué podemos afirmar y qué solo podemos inferir?
```

---

# 35. Principio maestro

Los eventos son evidencia de comportamiento.

La interpretación correcta depende de:

```text
event
+
time
+
frequency
+
sequence
+
customer_history
+
context
```

El agente debe razonar a partir de eventos sin convertir automáticamente cada señal en una conclusión comercial.
