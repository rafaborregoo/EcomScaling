# Fase 1.6 — Checkout Prospect / Checkout Abandoner

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA la diferencia entre `CHECKOUT_PROSPECT` y `CHECKOUT_ABANDONER`.

El inicio de checkout suele representar una señal de intención comercial superior al simple carrito, pero:

```text
CHECKOUT_STARTED
```

no significa automáticamente:

```text
CHECKOUT_ABANDONED
```

El agente debe distinguir entre:

- una persona que está activamente completando la compra;
- una persona que ha detenido el proceso;
- una persona que ya compró;
- una persona cuyo checkout dejó de ser válido.

---

# 1. Checkout Prospect

Un `CHECKOUT_PROSPECT` es una persona que ha iniciado un proceso de checkout y todavía puede estar activamente completándolo.

Puede encontrarse:

- introduciendo datos;
- revisando dirección;
- seleccionando envío;
- introduciendo pago;
- comparando alternativas;
- resolviendo una duda.

El inicio de checkout es una señal de intención fuerte.

No es todavía abandono.

---

# 2. Checkout Abandoner

Un `CHECKOUT_ABANDONER` es una persona que inició checkout pero no completó la compra dentro de una ventana razonable y dejó de mostrar progresión relevante.

Conceptualmente:

```text
CHECKOUT_STARTED
+
no_order
+
no_recent_progress
+
elapsed_time
→ possible_checkout_abandonment
```

La ventana exacta depende del negocio y pertenece al runtime/configuración.

---

# 3. Diferencia fundamental

```text
CHECKOUT_PROSPECT
=
checkout iniciado y todavía potencialmente activo
```

```text
CHECKOUT_ABANDONER
=
checkout detenido según tiempo y falta de progresión
```

---

# 4. Checkout representa intención fuerte

Normalmente, llegar a checkout implica que la persona ya ha superado varias etapas.

Puede haber:

```text
browse
→ product_view
→ cart
→ checkout
```

Por eso suele merecer un tratamiento más específico que browse o cart.

---

# 5. Intención fuerte no significa compra segura

El checkout puede fallar por:

- coste final;
- shipping;
- método de pago;
- confianza;
- error técnico;
- distracción;
- comparación;
- necesidad de aprobación;
- falta de tiempo.

No debe asumirse una única causa.

---

# 6. Checkout y fricción

El checkout es una de las etapas donde la fricción técnica y comercial puede hacerse más visible.

Posibles barreras:

```text
unexpected_shipping_cost
payment_failure
missing_payment_method
slow_checkout
forced_account_creation
trust_concern
delivery_time
```

---

# 7. Checkout y precio final

El usuario puede descubrir:

- impuestos;
- envío;
- recargos;
- cambio de moneda;
- descuentos no aplicados.

Por ello, el precio final puede modificar intención.

---

# 8. Checkout y métodos de pago

La falta de un método preferido puede provocar abandono.

Ejemplos:

```text
PayPal unavailable
BNPL unavailable
card_error
local_payment_missing
```

La IA no debe inventar cuál fue la causa sin datos.

---

# 9. Checkout y dirección

Errores en dirección o restricciones de envío pueden detener la compra.

---

# 10. Checkout y mercado

El usuario puede descubrir que:

- no se envía a su país;
- ciertos productos no pueden enviarse;
- existen restricciones.

Esto cambia completamente la estrategia posterior.

---

# 11. Checkout y shipping time

En dropshipping, los plazos pueden tener gran peso.

Una persona puede abandonar al descubrir una entrega más lenta de lo esperado.

La estrategia debe priorizar claridad y confianza, no ocultar información.

---

# 12. Checkout y coste de envío

Un coste inesperado puede ser una barrera.

Pero no debe asumirse que la solución siempre es:

```text
free_shipping
```

Debe evaluarse la viabilidad comercial.

---

# 13. Checkout y cupón

Algunas personas llegan al checkout para comprobar si existe un campo de cupón o buscar descuentos.

Esto puede crear interrupciones temporales.

No debe interpretarse inmediatamente como abandono definitivo.

---

# 14. Checkout y búsqueda de cupón

Una pausa después de ver el campo promocional puede indicar:

- búsqueda de código;
- comparación;
- fricción de precio.

Es una hipótesis, no una certeza.

---

# 15. Checkout y compra posterior

Cuando ocurre:

```text
ORDER_PLACED
```

la oportunidad de recuperación de checkout deja de ser válida para esa compra.

---

# 16. Checkout y pago pendiente

Debe distinguirse entre:

```text
checkout_started
payment_pending
payment_failed
order_placed
```

No todos representan la misma situación.

---

# 17. Pago fallido

Un payment failure puede requerir una estrategia distinta de abandono voluntario.

Puede ser más útil:

- explicar;
- ofrecer reintento;
- permitir otro método;
- resolver error.

---

# 18. Pago rechazado

La IA debe evitar lenguaje que pueda resultar acusatorio o invasivo.

La comunicación debería centrarse en facilitar la continuación.

---

# 19. Checkout y sesión expirada

Un checkout puede caducar técnicamente.

Esto no significa necesariamente pérdida de intención.

---

# 20. Checkout y carrito modificado

La persona puede volver atrás para:

- cambiar cantidades;
- eliminar productos;
- añadir otros.

Ese comportamiento indica que sigue activa.

---

# 21. Checkout y múltiples intentos

Varios intentos de checkout pueden indicar:

- fuerte intención;
- fricción técnica;
- comparación.

El agente debe valorar el patrón completo.

---

# 22. Checkout y múltiples dispositivos

Una persona puede iniciar en móvil y terminar en desktop.

El sistema debe interpretar la compra posterior como conversión si puede asociarse correctamente.

---

# 23. Checkout y primera compra

Para primera compra pueden existir más barreras de:

- confianza;
- legitimidad;
- returns;
- shipping;
- seguridad.

---

# 24. Checkout y repeat buyer

Un cliente recurrente puede necesitar menos reassurance de marca.

Si abandona, puede existir una fricción más operativa que de confianza.

---

# 25. Checkout y VIP

El tratamiento puede incorporar:

- servicio;
- prioridad;
- reconocimiento.

No significa automáticamente descuento.

---

# 26. Checkout y alto valor

Un checkout de alto valor puede requerir un ciclo de decisión más largo.

No debe presionarse excesivamente por asumir que la intención fuerte exige urgencia.

---

# 27. Checkout y productos complejos

Productos con:

- configuraciones;
- tallas;
- variantes;
- compatibilidad;

pueden generar pausas legítimas antes de pagar.

---

# 28. Checkout y suscripciones

Si el producto implica recurrencia, el usuario puede detenerse al evaluar:

- frecuencia;
- cancelación;
- términos;
- compromiso.

La comunicación debe ser clara.

---

# 29. Checkout y gift purchase

Una compra para regalo puede tener patrones distintos de una compra personal.

---

# 30. Checkout y fechas límite

Puede existir urgencia real por:

- entrega antes de una fecha;
- fin de promoción;
- reserva;
- stock.

Solo debe utilizarse si es cierta.

---

# 31. Checkout Abandonment y descuento

No debe aplicarse:

```text
checkout_abandoned
→ discount
```

como regla universal.

Un descuento puede:

- destruir margen;
- enseñar a abandonar;
- canibalizar compras a precio completo.

---

# 32. Recovery sin descuento

Puede centrarse en:

- continuidad;
- claridad;
- producto;
- prueba social;
- shipping;
- reassurance;
- soporte.

---

# 33. Primer mensaje de recuperación

Suele tener sentido que sea directo y facilite volver al checkout.

No necesita añadir complejidad innecesaria.

---

# 34. Mensajes posteriores

Pueden explorar:

- objeciones;
- confianza;
- proof;
- producto;
- oferta;

siempre con lógica y sin saturación.

---

# 35. Checkout y urgencia falsa

No debe utilizarse:

```text
FINAL CHANCE
```

si el checkout realmente sigue disponible sin límite.

---

# 36. Checkout y escasez falsa

No debe afirmarse stock crítico si no existe evidencia.

---

# 37. Checkout y cambios de precio

Si el precio cambió, la comunicación debe reflejar condiciones actuales.

---

# 38. Checkout y promoción caducada

No debe prometerse un incentivo expirado solo porque estaba disponible cuando se inició checkout.

---

# 39. Checkout y producto agotado

Si el producto deja de estar disponible, la recuperación estándar deja de tener sentido.

Puede ser más apropiado:

- back in stock;
- alternativa;
- soporte.

---

# 40. Checkout y variante agotada

La variante concreta puede ser el problema.

No basta con que el producto general siga disponible.

---

# 41. Checkout y compra parcial

Si el cliente termina comprando solo parte de los productos, no debe tratarse como si no hubiese convertido nada.

---

# 42. Checkout y recuperación parcial

Puede quedar una oportunidad residual, pero debe reinterpretarse.

---

# 43. Checkout y soporte abierto

Un problema activo puede tener prioridad sobre la recuperación comercial.

---

# 44. Checkout y incidencias técnicas

Si existe conocimiento de un error de checkout, la respuesta adecuada puede ser:

- información;
- disculpa;
- solución.

No presión comercial.

---

# 45. Checkout y devoluciones activas

Una devolución puede modificar la conveniencia de insistir en otra compra.

---

# 46. Checkout y presión comercial

Alta intención no elimina frequency caps ni conflictos.

El usuario puede estar recibiendo:

- campañas;
- flows;
- mensajes de soporte;
- comunicaciones transaccionales.

---

# 47. Checkout y campañas generales

Una campaña general puede interferir con recovery.

Especialmente si contiene una oferta más agresiva.

---

# 48. Checkout y atribución

La compra posterior puede producirse por múltiples causas.

No debe asumirse automáticamente que el último email fue causal.

---

# 49. Checkout y aprendizaje

Puede analizarse:

- abandono por paso;
- método de pago;
- país;
- dispositivo;
- producto;
- ticket;
- shipping.

Esto ayuda a detectar fricción sistémica.

---

# 50. Checkout y CRO

Una alta tasa de abandono puede ser un problema de experiencia de checkout, no de email.

El agente debe poder recomendar investigar el checkout en lugar de añadir más mensajes.

---

# 51. Checkout y personalización

Puede utilizar:

- contenido del checkout;
- producto;
- categoría;
- moneda;
- shipping relevante.

Debe evitarse exponer datos sensibles de pago.

---

# 52. Checkout y privacidad

Nunca debe mostrarse en copy información sensible innecesaria.

---

# 53. Checkout y seguridad

El usuario debe percibir claridad y confianza.

No deben utilizarse técnicas engañosas para forzar una compra.

---

# 54. Checkout y señales de progreso

Ejemplos:

```text
ADDRESS_COMPLETED
SHIPPING_SELECTED
PAYMENT_METHOD_SELECTED
```

pueden indicar que el checkout sigue activo o avanzando.

---

# 55. Señales de abandono

Ejemplos:

```text
elapsed_time
no_progress
no_order
```

La interpretación depende de la ventana configurada.

---

# 56. Señales que invalidan abandono

Ejemplos:

```text
ORDER_PLACED
checkout_resumed
payment_completed
```

---

# 57. Señales de fricción técnica

Ejemplos:

```text
PAYMENT_FAILED
CHECKOUT_ERROR
ADDRESS_ERROR
```

Estas señales deberían cambiar la estrategia.

---

# 58. Checkout Reactivated

Una persona previamente considerada abandoner puede volver.

Ejemplos:

```text
CHECKOUT_RESUMED
PAYMENT_RETRIED
```

La estrategia debe actualizarse.

---

# 59. Abandono repetido

Una persona puede abandonar checkout varias veces.

Esto puede indicar:

- indecisión;
- fricción recurrente;
- precio;
- error técnico.

No debe responderse con presión creciente sin entender el patrón.

---

# 60. Relevance Decay

La oportunidad de recuperación pierde valor con el tiempo.

La velocidad depende de:

- categoría;
- ticket;
- ciclo de decisión;
- naturaleza del producto.

---

# 61. Checkout de ciclo rápido

En compras impulsivas, el contexto puede caducar rápidamente.

---

# 62. Checkout de ciclo largo

En productos caros o complejos, una pausa mayor puede ser normal.

---

# 63. Antipatrón: checkout started = abandoned

Es incorrecto mientras la sesión puede seguir activa.

---

# 64. Antipatrón: descuento inmediato

No sabemos si la fricción es precio.

---

# 65. Antipatrón: recuperar cuando ya compró

Genera una experiencia claramente incorrecta.

---

# 66. Antipatrón: ignorar errores técnicos

Email no arregla un checkout roto.

---

# 67. Antipatrón: presionar tras varios fallos de pago

Puede empeorar confianza.

---

# 68. Antipatrón: ocultar costes

La recuperación no debe solucionar la fricción mediante falta de transparencia.

---

# 69. Antipatrón: urgencia inventada

Debe basarse en hechos.

---

# 70. Preguntas que debe hacerse el agente

```text
¿El checkout sigue activo?
¿Cuándo fue la última progresión?
¿Existe pedido?
¿Existe pago pendiente o fallido?
¿Qué productos contiene?
¿Cambió el precio?
¿Cambió la promoción?
¿Existe stock?
¿Existe shipping disponible?
¿Es primera compra o recompra?
¿Hay una incidencia técnica?
¿Existe otra comunicación más prioritaria?
```

---

# 71. Modelo mental recomendado

```text
CHECKOUT_STARTED
+
PROGRESSION
+
RECENCY
+
PAYMENT_STATE
+
ORDER_STATE
+
CUSTOMER_CONTEXT
+
OPERATIONAL_CONTEXT
→ interpret_checkout_state
```

---

# 72. Principio maestro

Checkout es una señal de intención muy fuerte, pero abandono sigue siendo una conclusión contextual.

La IA debe dejar de pensar:

```text
CHECKOUT_STARTED
→ CHECKOUT_ABANDONER
```

y pensar:

```text
CHECKOUT_STARTED
→ CHECKOUT_PROSPECT
→ evaluate_progress_and_time
→ possible_CHECKOUT_ABANDONER
```

La pregunta correcta es:

> ¿La persona realmente dejó de comprar o todavía está dentro de un checkout activo o recuperable?
