# Fase 1.6 — Checkout Prospect / Checkout Abandoner — Runtime

## Tipo de artefacto

`03-runtime`

## Objetivo

Definir cómo debe interpretar el software los eventos de checkout para mantener un estado operativo consistente y evitar activar recuperaciones incorrectas.

Este documento no define copy, diseño ni oferta.

---

# 1. Principio

El runtime no debe asumir:

```text
CHECKOUT_STARTED
=
CHECKOUT_ABANDONED
```

Debe modelar primero un checkout activo.

---

# 2. Estados conceptuales mínimos

El sistema debería poder representar:

```text
NO_CHECKOUT
CHECKOUT_ACTIVE
CHECKOUT_ABANDONED
CHECKOUT_REACTIVATED
CHECKOUT_CONVERTED
CHECKOUT_FAILED
CHECKOUT_INVALID
```

La implementación concreta puede adaptar nombres.

---

# 3. Entrada a CHECKOUT_ACTIVE

Puede ocurrir cuando existe un evento fiable equivalente a:

```text
CHECKOUT_STARTED
```

o cuando se recupera un checkout todavía vigente.

---

# 4. Checkout activo no significa elegible

El estado operativo debe existir independientemente de:

- consentimiento;
- suscripción;
- frecuencia;
- campañas;
- flows.

---

# 5. Abandono requiere tiempo

Debe existir una ventana configurable:

```text
checkout_abandonment_window
```

No debe hardcodearse en conocimiento universal.

---

# 6. Última progresión

El cálculo debería considerar la última actividad significativa.

Ejemplos:

```text
CHECKOUT_STARTED
ADDRESS_UPDATED
SHIPPING_SELECTED
PAYMENT_METHOD_SELECTED
PAYMENT_ATTEMPTED
```

---

# 7. Condición conceptual de abandono

```text
checkout_exists
AND
no_order
AND
no_recent_progress
AND
elapsed_time >= checkout_abandonment_window
→ CHECKOUT_ABANDONED
```

---

# 8. Conversión

Cuando existe una compra válida:

```text
ORDER_PLACED
```

debe producirse:

```text
CHECKOUT_ACTIVE / CHECKOUT_ABANDONED
→ CHECKOUT_CONVERTED
```

---

# 9. Payment completed

Si el negocio considera:

```text
PAYMENT_COMPLETED
```

la prueba autoritativa de conversión, debe reflejarse en configuración.

No debe decidirlo el LLM.

---

# 10. Pago pendiente

Un estado:

```text
PAYMENT_PENDING
```

no debería tratarse automáticamente como abandono.

Puede requerir una ventana o lógica distinta.

---

# 11. Pago fallido

Cuando existe:

```text
PAYMENT_FAILED
```

el runtime puede marcar:

```text
CHECKOUT_FAILED
```

o mantener checkout activo con contexto de fallo.

Debe distinguirse de abandono silencioso.

---

# 12. Retry

Un nuevo intento de pago puede producir:

```text
CHECKOUT_FAILED
→ CHECKOUT_REACTIVATED
```

o volver a `CHECKOUT_ACTIVE`.

---

# 13. Checkout expirado

Si la plataforma invalida el checkout:

```text
CHECKOUT_INVALID
```

debe impedir una recuperación estándar basada en un enlace inválido.

---

# 14. Carrito asociado

Cuando sea posible debe conservarse relación:

```text
cart_id
↔
checkout_id
```

para evitar conflictos de estado.

---

# 15. Checkout supera a carrito

Cuando existe un checkout activo, el runtime debería permitir que la capa de orquestación trate esta oportunidad como más avanzada que el carrito previo.

---

# 16. Compra posterior por otra sesión

Debe asociarse cuando exista suficiente certeza de identidad.

La conversión debe cancelar recuperación de la misma oportunidad.

---

# 17. Multi-device

La lógica no debe depender exclusivamente de una sesión local si existe identidad consolidada.

---

# 18. Datos mínimos conceptuales

Puede requerirse:

```text
checkout_id
customer_id
cart_id
created_at
last_progress_at
currency
items
checkout_value
payment_state
shipping_state
order_id
state
```

La implementación exacta depende del proyecto.

---

# 19. Snapshot vs actualidad

Conviene distinguir:

```text
checkout_snapshot
```

de:

```text
current_product_and_offer_state
```

para saber qué ocurrió y qué sigue siendo válido ahora.

---

# 20. Stock actual

Antes de una recuperación debe poder saberse si los productos siguen comprables.

---

# 21. Variante actual

La disponibilidad debe evaluarse a nivel de variante cuando sea relevante.

---

# 22. Precio actual

El sistema debe evitar prometer automáticamente el precio histórico si ya cambió.

---

# 23. Promoción actual

Debe comprobarse si el incentivo original sigue vigente.

---

# 24. Shipping actual

El checkout puede volverse inválido o diferente si cambia:

- país;
- zona;
- método;
- coste.

---

# 25. Deduplicación

Eventos repetidos de `CHECKOUT_STARTED` no deberían crear múltiples oportunidades falsas para el mismo checkout.

---

# 26. Idempotencia

Procesar el mismo evento dos veces no debería generar dos estados ni dos activaciones.

---

# 27. Eventos fuera de orden

El sistema debe utilizar timestamps y fuente autoritativa.

Ejemplo:

Un `CHECKOUT_STARTED` retrasado no debe sobrescribir:

```text
CHECKOUT_CONVERTED
```

---

# 28. Source of truth

La conversión debe depender del sistema operativo autoritativo del ecommerce.

Nunca del RAG.

---

# 29. Freshness

El runtime debe conocer la antigüedad de la información usada.

---

# 30. Reactivación

Un checkout abandonado puede reactivarse mediante:

```text
CHECKOUT_RESUMED
PAYMENT_RETRIED
CHECKOUT_UPDATED
```

---

# 31. Nuevo checkout

Una nueva oportunidad posterior debe diferenciarse de un checkout antiguo.

---

# 32. Opportunity identity

Debe poder responderse:

```text
¿qué checkout generó esta decisión?
```

Esto requiere un identificador o relación estable.

---

# 33. Compra parcial

Si la plataforma permite pedidos parciales respecto a la intención original, debe reevaluarse qué queda pendiente.

---

# 34. Checkout empty/invalid

Si ya no contiene productos comprables, no debe mantenerse como recuperación normal.

---

# 35. Eligibility separada

```text
CHECKOUT_ABANDONED
```

no implica:

```text
EMAIL_ELIGIBLE
```

---

# 36. Pressure separada

Tampoco implica:

```text
SEND_NOW
```

---

# 37. Offer separada

El runtime no debe decidir automáticamente:

```text
discount
```

---

# 38. Copy separado

El runtime no debe generar el mensaje.

---

# 39. Payment failure reason

Cuando esté disponible, el sistema puede conservar la razón técnica.

No debe mostrarla necesariamente al usuario tal cual.

---

# 40. Technical issue signal

Errores de checkout pueden necesitar una ruta distinta de recuperación.

Ejemplos:

```text
CHECKOUT_ERROR
PAYMENT_GATEWAY_ERROR
ADDRESS_VALIDATION_ERROR
```

---

# 41. Cancellation signal

Cuando el checkout se convierte o invalida, deben poder cancelarse:

- mensajes pendientes;
- delays;
- recuperaciones futuras.

---

# 42. Expiración de oportunidad

Puede existir:

```text
checkout_recovery_expiry
```

tras la cual deja de tener sentido una recuperación estándar.

Debe ser configurable.

---

# 43. Re-entry

Una persona puede generar una nueva oportunidad de checkout más adelante.

Un abandono antiguo no debe bloquear nuevas secuencias para siempre.

---

# 44. Auditoría

Debe poder reconstruirse:

```text
event
→ previous_state
→ rule
→ new_state
```

---

# 45. Reason codes

Ejemplos:

```text
ABANDONMENT_TIMEOUT
ORDER_COMPLETED
PAYMENT_FAILED
CHECKOUT_EXPIRED
CHECKOUT_REACTIVATED
PRODUCT_UNAVAILABLE
```

---

# 46. Incertidumbre

Si faltan datos críticos, el sistema no debe inventar un abandono definitivo.

Puede mantener un estado intermedio o marcar incertidumbre según arquitectura.

---

# 47. Configuración por tenant

Pueden variar:

```text
checkout_abandonment_window
checkout_recovery_expiry
```

según la tienda.

---

# 48. Configuración por contexto

En una arquitectura avanzada, el timing podría variar según:

- ticket;
- categoría;
- ciclo de decisión.

No debe implementarse complejidad innecesaria sin evidencia.

---

# 49. Invariantes recomendadas

Una misma oportunidad no debería estar simultáneamente en:

```text
CHECKOUT_CONVERTED
```

y:

```text
CHECKOUT_ABANDONED
```

como estados principales vigentes.

---

# 50. Invariante de conversión

Una conversión válida debe dominar sobre inferencias anteriores de abandono.

---

# 51. Invariante de no duplicidad

Un mismo checkout no debería activar varias recuperaciones idénticas por duplicados de eventos.

---

# 52. Invariante de trazabilidad

Toda transición importante debe tener una causa verificable.

---

# 53. Lo que este runtime NO decide

No debe resolver por sí solo:

- elegibilidad legal;
- frecuencia global;
- prioridad frente a campañas;
- descuento;
- contenido;
- diseño;
- autonomía de envío.

---

# 54. Resultado esperado

El runtime debe poder responder:

```text
¿Existe checkout?
¿Sigue activo?
¿Está abandonado?
¿Hay fallo de pago?
¿Se reactivó?
¿Se convirtió?
¿Caducó?
¿Cuál fue la última progresión?
¿Los productos siguen siendo válidos?
```

---

# 55. Principio maestro

La responsabilidad del runtime es convertir eventos de checkout en un estado operativo fiable.

```text
CHECKOUT_EVENTS
→ CHECKOUT_STATE
→ OTHER_ENGINES
→ COMMUNICATION_DECISION
```

Nunca:

```text
CHECKOUT_STARTED
→ SEND_EMAIL
```

sin evaluación intermedia.
