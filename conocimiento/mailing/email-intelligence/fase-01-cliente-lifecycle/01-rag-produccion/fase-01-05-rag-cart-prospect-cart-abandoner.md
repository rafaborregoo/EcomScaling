# Fase 1.5 — Cart Prospect / Cart Abandoner

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA la diferencia entre `CART_PROSPECT` y `CART_ABANDONER` dentro de un ecommerce.

La distinción es crítica porque:

```text
ADD_TO_CART
```

no significa automáticamente:

```text
CART_ABANDONED
```

Un Cart Prospect mantiene intención comercial activa relacionada con uno o varios productos añadidos al carrito.

Un Cart Abandoner es una persona cuyo carrito ha dejado de progresar durante una ventana suficientemente significativa y que no ha completado la compra correspondiente.

El agente debe evitar tratar cualquier carrito como abandono inmediato.

---

# 1. Cart Prospect

Un `CART_PROSPECT` es una persona que ha añadido al menos un producto al carrito y todavía puede estar dentro de una sesión o proceso de compra activo.

Puede estar:

- comparando;
- añadiendo más productos;
- revisando shipping;
- buscando un cupón;
- consultando devoluciones;
- esperando;
- avanzando hacia checkout.

El carrito representa intención.

No representa abandono por sí solo.

---

# 2. Cart Abandoner

Un `CART_ABANDONER` es una persona que mostró una intención más avanzada mediante carrito, pero no completó la progresión esperada dentro de una ventana razonable.

Conceptualmente:

```text
ADD_TO_CART
+
no_purchase
+
no_meaningful_progression
+
elapsed_time
→ possible_cart_abandonment
```

La ventana exacta no pertenece al conocimiento conceptual universal.

Depende del ecommerce, producto, experiencia y datos.

---

# 3. Diferencia fundamental

```text
CART_PROSPECT
=
carrito activo o todavía potencialmente activo
```

```text
CART_ABANDONER
=
carrito que, según suficiente evidencia temporal y conductual, parece haberse detenido
```

---

# 4. Add to Cart es una señal fuerte

Frente a simple browsing o product view, añadir al carrito suele indicar mayor intención.

Pero sigue sin garantizar:

- compra;
- necesidad de descuento;
- abandono;
- disponibilidad económica;
- ausencia de objeciones.

---

# 5. El carrito puede ser una lista temporal

Algunas personas utilizan el carrito como:

- lista de deseos;
- comparador;
- recordatorio;
- espacio para guardar productos.

Por ello, el comportamiento histórico de la tienda importa.

---

# 6. Cart Prospect y lifecycle

Puede existir:

```text
PROSPECT + CART_PROSPECT
```

pero también:

```text
REPEAT_BUYER + CART_PROSPECT
```

El mismo carrito puede tener significado distinto según historial.

---

# 7. Cart Prospect y intención

La existencia de carrito suele elevar la evidencia de intención.

Sin embargo, la fuerza depende de:

- recencia;
- valor;
- número de productos;
- historial;
- progresión posterior;
- repetición.

---

# 8. Cart Prospect y checkout

Si ocurre:

```text
CHECKOUT_STARTED
```

el contexto pasa a ser más específico.

La estrategia de carrito puede perder prioridad frente a checkout.

---

# 9. Cart Prospect y compra

Si ocurre:

```text
ORDER_PLACED
```

la lógica de recuperación de carrito debe dejar de ser relevante para esa oportunidad.

---

# 10. Cart Abandonment no es instantáneo

No debe interpretarse:

```text
ADD_TO_CART
→ immediately abandoned
```

Debe existir tiempo suficiente para que la persona pueda seguir comprando.

---

# 11. Recencia

Un carrito creado hace minutos puede seguir completamente activo.

Uno sin actividad durante un periodo significativo puede empezar a considerarse abandonado.

---

# 12. Última actividad

No solo importa cuándo se añadió el producto.

También importa:

- último cambio de carrito;
- última visita;
- último evento de checkout;
- última actividad relevante.

---

# 13. Actualización del carrito

Eventos como:

```text
CART_UPDATED
QUANTITY_CHANGED
ITEM_ADDED
ITEM_REMOVED
```

pueden indicar que la intención sigue activa.

---

# 14. Eliminación de producto

Quitar un producto puede significar:

- cambio de decisión;
- comparación;
- ajuste de presupuesto;
- intención todavía activa.

No equivale automáticamente a abandono.

---

# 15. Carrito vacío

Si la persona vacía explícitamente el carrito, el significado puede ser distinto de dejarlo inactivo.

Puede representar una decisión consciente.

---

# 16. Carritos múltiples

Una persona puede crear varios carritos o sesiones.

El agente debe comprender que el estado debe corresponder a la oportunidad comercial vigente, no a cualquier carrito histórico.

---

# 17. Cart Abandoner y objeciones

Posibles motivos:

```text
price
shipping_cost
shipping_time
trust
payment
returns
comparison
distraction
technical_issue
```

No debe asumirse cuál existe sin evidencia.

---

# 18. No asumir que el precio es el problema

El descuento no debe ser la respuesta automática al abandono.

Puede ser más útil:

- reassurance;
- shipping clarity;
- reviews;
- product proof;
- FAQ;
- convenience.

---

# 19. Cart Abandoner y envío

El coste o plazo de envío puede ser una fricción importante.

Pero solo debe tratarse específicamente cuando exista contexto suficiente.

---

# 20. Cart Abandoner y confianza

En marcas nuevas o dropshipping, pueden aparecer dudas sobre:

- legitimidad;
- calidad;
- tiempos;
- devoluciones.

La recuperación puede necesitar prueba y reassurance.

---

# 21. Cart Abandoner y checkout técnico

Un abandono puede estar causado por errores:

- checkout roto;
- pasarela fallida;
- código incorrecto;
- incompatibilidad móvil.

En esos casos, insistir con copy comercial puede no resolver el problema.

---

# 22. Cart Abandoner y stock

El producto puede haberse agotado después de ser añadido.

La estrategia debe adaptarse.

---

# 23. Cart Abandoner y variante

Puede existir interés por una talla, color o variante que ya no está disponible.

---

# 24. Cart Abandoner y precio cambiado

Si el precio cambió después del carrito, el mensaje debe evitar incoherencias.

---

# 25. Cart Abandoner y promociones activas

Una persona puede haber añadido durante una promoción concreta.

Si esta ya no existe, la comunicación debe reflejar la realidad actual.

---

# 26. Cart Abandoner y presión comercial

El hecho de estar en carrito no elimina la necesidad de considerar frecuencia total.

Un cliente puede estar simultáneamente en:

- campañas;
- welcome;
- browse;
- cart.

La relevancia debe coordinarse.

---

# 27. Cart Abandoner y otras campañas

Una campaña general con descuento puede interferir con la recuperación de carrito.

Puede:

- regalar margen;
- crear incoherencia;
- canibalizar la lógica del flow.

---

# 28. Cart Abandoner y personalización

Puede tener sentido utilizar:

- productos del carrito;
- categoría;
- beneficios;
- prueba social;
- información relevante.

Debe evitarse exponer comportamiento de forma invasiva.

---

# 29. Primer mensaje de recuperación

Conceptualmente debería reducir fricción y facilitar continuidad.

No necesita necesariamente una promoción.

---

# 30. Mensajes posteriores

Si la intención no se recupera, la estrategia puede evolucionar hacia:

- prueba;
- educación;
- objeciones;
- incentivo;

siempre que tenga sentido económico y comercial.

---

# 31. Abandono y urgencia

No debe utilizarse urgencia falsa.

Si existe una razón real:

- stock;
- expiración;
- promoción;

puede comunicarse con claridad.

---

# 32. Abandono y escasez

La escasez debe ser real.

No debe inventarse para recuperar el carrito.

---

# 33. Cart Abandoner y primera compra

La recuperación de primera compra puede necesitar más confianza.

---

# 34. Cart Abandoner y repeat buyer

Un comprador recurrente ya conoce la marca.

Puede necesitar menos educación y más conveniencia.

---

# 35. Cart Abandoner y VIP

El tratamiento puede incorporar reconocimiento o servicio superior.

No implica automáticamente ofrecer mayor descuento.

---

# 36. Cart Abandoner y alto valor de carrito

Un carrito de alto valor puede requerir:

- más consideración;
- más confianza;
- ciclo más largo.

No siempre debe tratarse con mayor agresividad.

---

# 37. Cart Abandoner y carrito pequeño

Puede tener comportamiento más impulsivo y ventana distinta.

---

# 38. Cart Abandoner y productos consumibles

Puede existir intención de reposición.

El historial de compra puede ayudar a interpretar el carrito.

---

# 39. Cart Abandoner y productos complementarios

Un repeat buyer puede estar construyendo un carrito de cross-sell.

---

# 40. Cart Abandoner y producto ya comprado

Si el cliente termina comprando por otro dispositivo, canal o sesión, la recuperación debe dejar de considerarse necesaria.

---

# 41. Cart Abandoner y compra parcial

Si el cliente compra parte del carrito, la oportunidad restante debe reinterpretarse.

No debe enviarse un mensaje como si no hubiera comprado nada.

---

# 42. Cart Abandoner y modificación posterior

Si el carrito cambia después de una comunicación, el siguiente mensaje debe usar contexto actualizado.

---

# 43. Cart Abandoner y multi-device

Un cliente puede abandonar en móvil y comprar en desktop.

El historial unificado es importante para interpretar correctamente.

---

# 44. Cart Abandoner y identidad

Solo puede existir una estrategia individual fiable cuando el carrito puede asociarse suficientemente a una persona.

---

# 45. Cart Abandoner y relevancia temporal

La recuperación pierde valor con el tiempo.

La velocidad de decay depende de:

- categoría;
- ticket;
- comportamiento;
- ciclo de decisión.

---

# 46. Carritos de decisión rápida

Productos impulsivos pueden requerir ventanas más cortas.

---

# 47. Carritos de alta consideración

Productos caros o complejos pueden requerir más tiempo antes de interpretar abandono definitivo.

---

# 48. Cart Abandoner y señales de retorno

Si la persona vuelve al carrito después de una supuesta inactividad, puede significar que la oportunidad sigue viva.

---

# 49. Cart Abandoner reactivado

Puede pasar de:

```text
CART_ABANDONER
```

a:

```text
CART_PROSPECT
```

si vuelve a interactuar activamente.

---

# 50. Cart Abandoner y soporte

Si existe una incidencia abierta, puede ser incorrecto priorizar recuperación comercial.

---

# 51. Cart Abandoner y devoluciones

Una devolución activa puede cambiar completamente la conveniencia de una nueva compra.

---

# 52. Cart Abandoner y margen

La recuperación debe considerar que no toda conversión adicional es rentable si depende de incentivos excesivos.

---

# 53. Cart Abandoner y aprendizaje

Puede analizarse:

- qué productos se abandonan;
- en qué etapa;
- con qué valor;
- bajo qué condiciones;
- qué tipos de recuperación funcionan.

No debe asumirse causalidad por simples correlaciones.

---

# 54. Cart Abandoner y experimentación

Puede probarse:

- timing;
- contenido;
- prueba social;
- número de mensajes;
- oferta;
- creatividad.

El aprendizaje debe depender de hipótesis claras.

---

# 55. Señales que refuerzan abandono

Ejemplos:

```text
time_elapsed
no_site_activity
no_checkout
no_purchase
```

---

# 56. Señales que debilitan abandono

Ejemplos:

```text
recent_cart_update
recent_site_activity
checkout_started
order_placed
```

---

# 57. Señales que invalidan recuperación

Ejemplos:

```text
ORDER_PLACED
cart_empty_by_user
product_unavailable
```

dependiendo del contexto.

---

# 58. Antipatrón: add to cart = abandoned cart

Es uno de los errores conceptuales más importantes.

---

# 59. Antipatrón: descuento inmediato

No sabemos todavía que el precio sea la fricción.

---

# 60. Antipatrón: ignorar compra posterior

Puede generar mensajes absurdos después de convertir.

---

# 61. Antipatrón: ignorar cambios del carrito

El mensaje debe corresponder al carrito vigente.

---

# 62. Antipatrón: frecuencia agresiva

La alta intención no justifica una secuencia ilimitada.

---

# 63. Antipatrón: recuperar eternamente

La relevancia del carrito caduca.

---

# 64. Antipatrón: mismo tratamiento para todos

Primera compra, repeat buyer y VIP pueden necesitar enfoques distintos.

---

# 65. Preguntas que debe hacerse el agente

```text
¿El carrito sigue activo?
¿Cuándo fue la última actividad?
¿Qué productos contiene?
¿Cambió?
¿Existe checkout?
¿Existe compra posterior?
¿Es primera compra o recompra?
¿Qué valor tiene el carrito?
¿Qué fricciones conocemos realmente?
¿Existe otra comunicación activa?
¿La oportunidad sigue siendo relevante?
```

---

# 66. Modelo mental recomendado

```text
ADD_TO_CART
+
RECENCY
+
CART_ACTIVITY
+
PROGRESSION
+
PURCHASE_STATUS
+
CUSTOMER_CONTEXT
→ interpret_cart_state
```

---

# 67. Principio maestro

El carrito es una señal fuerte de intención, pero el abandono es una conclusión temporal y contextual.

La IA debe dejar de pensar:

```text
ADD_TO_CART
→ CART_ABANDONER
```

y pensar:

```text
ADD_TO_CART
→ CART_PROSPECT
→ evaluate_progression_and_time
→ possible_CART_ABANDONER
```

La pregunta correcta es:

> ¿Esta persona realmente abandonó el carrito o simplemente sigue dentro de su proceso de compra?
