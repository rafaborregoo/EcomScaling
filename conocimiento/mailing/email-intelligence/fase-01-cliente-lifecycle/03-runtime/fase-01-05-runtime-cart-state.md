# Fase 1.5 — Cart Prospect / Cart Abandoner — Runtime

## Tipo de artefacto

`03-runtime`

## Objetivo

Definir responsabilidades de software para determinar de forma consistente cuándo una oportunidad de carrito debe considerarse activa, abandonada, reactivada, convertida o inválida.

Este documento NO define copy ni estrategia creativa.

Define comportamiento esperado del sistema.

---

# 1. Principio de runtime

El software no debe utilizar:

```text
ADD_TO_CART
=
CART_ABANDONED
```

Debe modelar primero un carrito activo y evaluar su evolución.

---

# 2. Estados conceptuales mínimos

El runtime debería poder representar, como mínimo:

```text
NO_CART
CART_ACTIVE
CART_ABANDONED
CART_REACTIVATED
CART_CONVERTED
CART_INVALID
```

Los nombres concretos pueden adaptarse al modelo técnico del proyecto.

---

# 3. Entrada a CART_ACTIVE

Una oportunidad puede pasar a carrito activo cuando existe un evento fiable equivalente a:

```text
ADD_TO_CART
```

o cuando se recupera un carrito vigente con productos.

---

# 4. CART_ACTIVE no depende de email

El estado existe independientemente de que haya:

- consentimiento;
- suscripción;
- flow;
- campaña.

La elegibilidad de comunicación es otra capa.

---

# 5. Abandono requiere tiempo

`CART_ABANDONED` no debe calcularse en el mismo instante que `ADD_TO_CART`.

Debe existir una ventana configurable:

```text
cart_abandonment_window
```

Su valor debe pertenecer a configuración/runtime, no al RAG.

---

# 6. Última actividad relevante

La ventana debería evaluarse desde la última actividad relevante del carrito, no necesariamente desde el primer `ADD_TO_CART`.

Ejemplos de actividad:

```text
ADD_TO_CART
REMOVE_FROM_CART
UPDATE_CART
VIEW_CART
CHECKOUT_STARTED
```

según el modelo de datos disponible.

---

# 7. Condición base de abandono

Modelo conceptual:

```text
cart_has_items
AND
no_order_for_cart
AND
no_recent_cart_activity
AND
elapsed_time >= cart_abandonment_window
→ CART_ABANDONED
```

---

# 8. Checkout iniciado

Cuando existe:

```text
CHECKOUT_STARTED
```

el sistema debe evitar mantener simultáneamente una interpretación dominante de abandono de carrito si el negocio modela checkout como una etapa superior.

Puede producir una transición hacia contexto de checkout.

---

# 9. Compra completada

Cuando existe una compra vinculable:

```text
ORDER_PLACED
```

debe producirse:

```text
CART_ACTIVE / CART_ABANDONED
→ CART_CONVERTED
```

y deben dejar de ser elegibles las acciones de recuperación correspondientes a esa oportunidad.

---

# 10. Compra por otra sesión

El runtime debe intentar asociar la compra aunque se complete desde:

- otro dispositivo;
- otra sesión;
- otro checkout;

cuando la identidad y los datos permitan hacerlo con suficiente fiabilidad.

---

# 11. Carrito vacío

Si el usuario elimina todos los productos, el sistema puede marcar:

```text
CART_INVALID
```

o un estado equivalente.

No debería tratarse necesariamente como abandono recuperable.

---

# 12. Producto no disponible

Si todos los productos relevantes dejan de estar disponibles, la oportunidad de recuperación estándar debe invalidarse o cambiar de tipo.

---

# 13. Carrito actualizado

Cada actualización relevante debería refrescar:

```text
last_cart_activity_at
```

para evitar clasificar como abandonado un carrito todavía activo.

---

# 14. Reactivación

Si una persona marcada como `CART_ABANDONED` vuelve a interactuar de forma relevante:

```text
VIEW_CART
UPDATE_CART
ADD_TO_CART
```

puede transicionar a:

```text
CART_REACTIVATED
```

o nuevamente `CART_ACTIVE`.

---

# 15. Nueva oportunidad de carrito

Después de una conversión o expiración, un nuevo carrito debería poder generar una nueva oportunidad independiente.

El sistema debe evitar mezclar historiales antiguos.

---

# 16. Identificador de oportunidad

Conviene que cada oportunidad de carrito pueda distinguirse mediante un identificador estable o una relación equivalente.

Debe permitir responder:

```text
¿qué carrito produjo esta recuperación?
```

---

# 17. Identificador de cliente

El runtime debe intentar asociar la oportunidad a una identidad cuando exista.

Pero no debe fusionar usuarios sin suficiente certeza.

---

# 18. Datos mínimos de contexto

Conceptualmente, el runtime puede necesitar:

```text
cart_id
customer_id
created_at
last_activity_at
items
currency
cart_value
checkout_started_at
order_id
converted_at
state
```

La implementación exacta depende del esquema del proyecto.

---

# 19. Snapshot de productos

Debe existir suficiente información para reconstruir qué contenía el carrito en el momento relevante.

Pero el sistema también debe consultar datos actuales cuando importe:

- stock;
- precio;
- disponibilidad.

---

# 20. Precio histórico vs actual

El software debe diferenciar entre:

```text
price_when_added
```

y:

```text
current_price
```

cuando ambos sean relevantes.

No debe prometer un precio antiguo automáticamente.

---

# 21. Promoción histórica vs actual

Una promoción existente cuando se creó el carrito puede haber expirado.

La lógica de recuperación debe usar condiciones vigentes.

---

# 22. Deduplicación de eventos

El runtime debe impedir que duplicados técnicos de `ADD_TO_CART` creen múltiples oportunidades falsas.

---

# 23. Idempotencia

Procesar dos veces el mismo evento no debería producir:

- dos estados;
- dos flows;
- dos recuperaciones.

La lógica debe ser idempotente cuando sea posible.

---

# 24. Orden de eventos

Pueden llegar eventos fuera de orden.

El runtime debe utilizar timestamps y contexto para evitar regresiones incorrectas.

Ejemplo:

```text
ORDER_PLACED
```

no debería ser sobrescrito posteriormente por un `ADD_TO_CART` antiguo recibido tarde.

---

# 25. Freshness

Los datos utilizados para decidir recuperación deben tener una antigüedad conocida.

---

# 26. Source of truth

El estado final de compra debería provenir de la fuente operativa autoritativa del ecommerce.

No del LLM ni de un documento RAG.

---

# 27. Eligibility separada

El estado:

```text
CART_ABANDONED
```

no implica:

```text
EMAIL_ELIGIBLE
```

La elegibilidad se evaluará en la capa correspondiente.

---

# 28. Pressure separada

Tampoco implica:

```text
SEND_NOW
```

La presión comercial debe evaluarse aparte.

---

# 29. Oferta separada

El runtime de carrito no debe decidir automáticamente:

```text
discount = 10%
```

La oferta pertenece a otra capa.

---

# 30. Copy separado

El runtime no debe generar texto comercial.

Debe producir estado y contexto fiable.

---

# 31. Señal de conversión dominante

Cuando el sistema confirma compra:

```text
ORDER_PLACED
```

debe tener prioridad sobre inferencias anteriores de abandono.

---

# 32. Compra parcial

Si el pedido contiene solo parte de los productos, el runtime debe evitar tratar toda la oportunidad como si nada hubiera convertido.

Puede requerir una nueva evaluación del carrito restante.

---

# 33. Múltiples carritos

Si la plataforma permite varios carritos, deben tratarse como oportunidades diferentes cuando sea necesario.

---

# 34. Expiración

Puede existir una ventana máxima tras la cual un carrito deja de considerarse recuperable.

Ejemplo conceptual:

```text
cart_recovery_expiry
```

Debe ser configurable.

---

# 35. Re-entry

Una nueva oportunidad posterior puede volver a generar elegibilidad para recuperación.

No debe bloquearse para siempre por un abandono antiguo.

---

# 36. Flow cancellation signal

Cuando cambie el estado a:

```text
CART_CONVERTED
CART_INVALID
```

el sistema debería emitir o exponer suficiente información para cancelar recuperaciones pendientes.

---

# 37. Checkout promotion

Si el carrito avanza a checkout, el runtime debería permitir que la orquestación priorice el contexto más avanzado.

---

# 38. Auditoría

Debe poder reconstruirse:

```text
event
→ state_before
→ rule_applied
→ state_after
```

---

# 39. Reason codes

Las transiciones deberían poder explicar el motivo.

Ejemplos:

```text
ABANDONMENT_TIMEOUT
ORDER_COMPLETED
CART_EMPTIED
PRODUCTS_UNAVAILABLE
CUSTOMER_REACTIVATED
```

---

# 40. Unknown

Si faltan datos críticos, el runtime no debería inventar.

Puede mantener estado anterior o marcar una condición de incertidumbre según arquitectura.

---

# 41. Configuración por tenant

Variables como:

```text
cart_abandonment_window
cart_expiry_window
```

pueden variar por ecommerce.

No deben hardcodearse universalmente.

---

# 42. Configuración por categoría

En arquitecturas futuras podría incluso existir adaptación por:

- ticket;
- categoría;
- ciclo de decisión.

Pero no debe implementarse sin necesidad.

---

# 43. Invariantes recomendadas

El sistema debería garantizar que:

```text
CART_CONVERTED
```

no siga siendo tratado como recuperación activa de esa misma oportunidad.

También:

```text
CART_INVALID
```

no debe generar recuperación normal.

---

# 44. Invariante de no duplicidad

Una misma oportunidad no debería producir simultáneamente múltiples estados principales incompatibles.

---

# 45. Invariante de trazabilidad

Toda transición importante debe poder rastrearse a eventos o reglas verificables.

---

# 46. Lo que NO debe decidir este runtime

Este componente no debe decidir por sí solo:

- copy;
- diseño;
- descuento;
- frecuencia final;
- elegibilidad legal;
- prioridad global frente a campañas;
- envío definitivo.

Esas responsabilidades pertenecen a otras capas.

---

# 47. Resultado esperado del runtime

Debe poder responder de forma fiable:

```text
¿Existe carrito?
¿Sigue activo?
¿Está abandonado?
¿Se reactivó?
¿Se convirtió?
¿Quedó invalidado?
¿Cuándo fue la última actividad?
¿Qué productos siguen siendo relevantes?
```

---

# 48. Principio maestro

La responsabilidad del runtime es convertir eventos de carrito en un estado operativo fiable.

La cadena conceptual es:

```text
EVENTS
→ CART_STATE
→ OTHER_ENGINES
→ COMMUNICATION_DECISION
```

No debe saltarse directamente de:

```text
ADD_TO_CART
```

a:

```text
SEND_EMAIL
```
