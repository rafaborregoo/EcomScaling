# Fase 1.2 — Prospect

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA el concepto de `PROSPECT` dentro de un ecommerce.

Un prospect es una persona identificada que todavía no ha completado la compra relevante y que presenta potencial comercial.

Ser prospect no implica automáticamente:

- intención alta;
- interés por un producto concreto;
- engagement elevado;
- necesidad de descuento;
- proximidad inmediata a compra;
- elegibilidad para cualquier comunicación.

El agente debe interpretar `PROSPECT` como una etapa comercial amplia que necesita contexto adicional.

---

# 1. Qué es un prospect

Un prospect es una persona conocida por el sistema que todavía no ha convertido en comprador dentro del contexto analizado, pero que mantiene una relación o comportamiento que permite considerarla potencial cliente.

Puede haber llegado mediante:

- suscripción;
- registro;
- formulario;
- lead magnet;
- campaña;
- navegación;
- interacción con producto;
- carrito;
- checkout no completado;
- referral.

---

# 2. Prospect no es subscriber

Puede existir:

```text
subscriber = true
prospect = true
```

pero ambos conceptos describen dimensiones distintas.

`subscriber` describe relación con el canal.

`prospect` describe situación comercial.

---

# 3. Prospect no es lead

Un lead suele representar una persona identificada mediante una acción inicial.

Prospect implica que existe suficiente contexto para considerarla potencial cliente.

Conceptualmente:

```text
lead
→ qualification / context
→ prospect
```

En ecommerce ambos términos pueden solaparse, pero no deberían utilizarse siempre como sinónimos.

---

# 4. Prospect no es intención alta

Un prospect puede tener:

```text
LOW_INTENT
MEDIUM_INTENT
HIGH_INTENT
VERY_HIGH_INTENT
```

Ejemplo:

```text
prospect_A:
  subscribed
  no_product_activity
```

frente a:

```text
prospect_B:
  checkout_started
  no_purchase
```

Ambos siguen siendo prospects.

---

# 5. Prospect y funnel

Un prospect puede estar en:

```text
awareness
interest
consideration
intent
```

Por tanto, la estrategia no debe ser uniforme.

---

# 6. Prospect y lifecycle

Dentro del lifecycle, prospect representa una etapa anterior a la primera compra.

Transición conceptual:

```text
PROSPECT
→ ORDER_PLACED
→ FIRST_TIME_BUYER
```

---

# 7. New Prospect

Persona recientemente identificada con poco historial.

El agente debe evitar sobreinterpretar:

- afinidad;
- intención;
- valor;
- sensibilidad promocional.

---

# 8. Engaged Prospect

Prospect que interactúa activamente con:

- emails;
- contenidos;
- web;
- productos.

Engagement no implica necesariamente intención de compra inmediata.

---

# 9. Product-Interest Prospect

Prospect que muestra señales de interés por:

```text
product
category
collection
```

Puede derivarse de:

- product views;
- búsquedas;
- wishlist;
- clicks.

---

# 10. High-Intent Prospect

Prospect con señales fuertes de proximidad a compra.

Ejemplos:

```text
repeated_product_views
ADD_TO_CART
CHECKOUT_STARTED
```

Debe seguir tratándose como estado inferido.

---

# 11. Cart Prospect

Prospect con productos añadidos al carrito y sin compra completada.

No debe confundirse inmediatamente con cart abandoner.

El carrito puede seguir activo.

---

# 12. Checkout Prospect

Prospect que ha iniciado checkout y todavía no ha comprado.

Suele representar una señal más fuerte que simple navegación.

---

# 13. Cooling Prospect

Prospect cuya actividad reciente está disminuyendo.

Puede mostrar:

- menos clicks;
- menos visitas;
- menos interacción;
- pérdida de recencia.

---

# 14. Disengaged Prospect

Prospect que lleva un periodo significativo sin señales útiles.

La ventana debe depender del ecommerce.

---

# 15. Reactivated Prospect

Prospect previamente inactivo que vuelve a generar una señal relevante.

Ejemplos:

```text
EMAIL_CLICKED
SITE_VISITED
PRODUCT_VIEWED
ADD_TO_CART
CHECKOUT_STARTED
```

---

# 16. Fuente de adquisición

La fuente aporta contexto.

Ejemplos:

```text
paid_social
organic_search
influencer
referral
popup
lead_magnet
giveaway
```

Pero la fuente no debe dominar sobre comportamiento posterior.

---

# 17. Prospect y comportamiento

Las señales de comportamiento ayudan a interpretar:

- intención;
- afinidad;
- engagement.

Ejemplos:

```text
CATEGORY_VIEWED
PRODUCT_VIEWED
SEARCH_PERFORMED
ADD_TO_CART
CHECKOUT_STARTED
```

---

# 18. Prospect y recencia

Una señal reciente suele tener más valor que una antigua.

Ejemplo:

```text
checkout_started_30_minutes_ago
```

no debe interpretarse igual que:

```text
checkout_started_30_days_ago
```

---

# 19. Prospect y afinidad

La afinidad puede derivarse de:

- categorías vistas;
- productos vistos;
- búsquedas;
- clicks;
- wishlist.

Si no existe suficiente evidencia:

```text
affinity = UNKNOWN
```

---

# 20. Prospect y educación

Muchos prospects necesitan comprender mejor antes de comprar.

Especialmente cuando existe:

- ticket alto;
- producto complejo;
- baja confianza;
- categoría desconocida.

La estrategia puede priorizar educación frente a promoción.

---

# 21. Prospect y prueba social

Puede ser útil para reducir incertidumbre mediante:

- reviews;
- testimonios;
- UGC;
- casos de uso.

Debe ser pertinente.

---

# 22. Prospect y objeciones

Las objeciones pueden incluir:

```text
price
trust
shipping
quality
fit
returns
compatibility
```

El agente no debe asumir cuál existe sin suficiente contexto.

---

# 23. Prospect y descuento

Debe evitarse:

```text
prospect
=
discount_required
```

El descuento es una táctica.

Puede ser innecesario o perjudicial.

---

# 24. Prospect y presión comercial

Un prospect de alta intención puede justificar una respuesta más cercana.

Un prospect frío puede requerir menor presión.

No existe una frecuencia universal.

---

# 25. Prospect y campañas

No todos los prospects deberían recibir las mismas campañas.

Debe considerarse:

- objetivo;
- afinidad;
- intención;
- engagement;
- recencia;
- relevancia.

---

# 26. Prospect y flows

Puede estar relacionado con:

- welcome;
- browse abandonment;
- product abandonment;
- cart abandonment;
- checkout abandonment;
- re-engagement.

La entrada depende de señales específicas.

---

# 27. Browse Prospect

Un prospect que navega no es automáticamente un abandoner.

Puede estar todavía explorando.

---

# 28. Product Prospect

Un producto visto repetidamente puede indicar consideración.

Una única vista no debería generar conclusiones fuertes.

---

# 29. Cart Prospect vs Cart Abandoner

```text
CART_PROSPECT
```

describe existencia de intención en carrito.

```text
CART_ABANDONER
```

implica además que ha transcurrido suficiente tiempo sin progresión o compra.

---

# 30. Checkout Prospect vs Checkout Abandoner

La misma lógica aplica.

El checkout puede seguir activo.

El abandono requiere contexto temporal.

---

# 31. Prospect y primera compra

Cuando ocurre una compra válida:

```text
PROSPECT
→ FIRST_TIME_BUYER
```

La estrategia debe cambiar inmediatamente.

---

# 32. Prospect y personalización

Puede adaptarse según:

- producto;
- categoría;
- comportamiento;
- fuente;
- intención;
- idioma.

La personalización debe ser proporcional a la evidencia disponible.

---

# 33. Prospect y producto visto

Debe distinguirse:

```text
single_view
repeat_view
same_category
multiple_categories
```

No todos los patrones significan lo mismo.

---

# 34. Prospect y búsqueda

Una búsqueda interna puede ser una señal fuerte de intención específica.

Ejemplo:

```text
SEARCH_PERFORMED = "waterproof hiking boots"
```

---

# 35. Prospect y wishlist

Añadir a wishlist puede indicar interés más persistente que una visita aislada.

No equivale necesariamente a intención inmediata.

---

# 36. Prospect y clicks de email

El valor del click depende de qué se haya pulsado.

```text
product_click
```

es diferente de:

```text
footer_click
```

---

# 37. Prospect y respuestas

Una respuesta directa puede ser una señal fuerte de engagement.

Puede requerir soporte o intervención humana.

---

# 38. Prospect y preferencias declaradas

Datos declarados como:

- categoría favorita;
- talla;
- presupuesto;
- interés;

pueden ser especialmente útiles.

Deben distinguirse de inferencias.

---

# 39. Prospect y promociones recibidas

Conviene considerar historial de:

- ofertas vistas;
- descuentos recibidos;
- promociones utilizadas.

Esto ayuda a evitar sobreincentivación.

---

# 40. Prospect y sensibilidad promocional

La sensibilidad a promociones debe inferirse de comportamiento repetido.

No de una única compra o signup.

---

# 41. Prospect y adquisición pagada

El origen pagado puede aportar contexto sobre:

- promesa del anuncio;
- producto;
- intención.

Pero la estrategia posterior debe usar comportamiento real.

---

# 42. Prospect y calidad

La calidad comercial no debería resumirse únicamente en origen.

Debe observarse evolución posterior.

Ejemplo:

```text
giveaway
+
zero_activity
```

frente a:

```text
organic_search
+
checkout_started
```

---

# 43. Prospect y scoring

Un sistema avanzado puede calcular una puntuación.

Pero el agente debe comprender que una puntuación es una síntesis, no una verdad absoluta.

Debe poder explicarse mediante señales.

---

# 44. Prospect y valor esperado

Puede existir una estimación de valor.

Debe tratarse como predicción.

No como hecho.

---

# 45. Prospect y tiempo de decisión

El ciclo depende del producto.

Ejemplo:

```text
impulse_product
```

puede tener decisión rápida.

```text
high_ticket_product
```

puede requerir más consideración.

---

# 46. Prospect y contenido según intención

Ejemplo conceptual:

```text
LOW_INTENT
→ education

MEDIUM_INTENT
→ product understanding + proof

HIGH_INTENT
→ objection handling

VERY_HIGH_INTENT
→ purchase facilitation
```

Es un marco, no una regla rígida.

---

# 47. Prospect y fricción

Un prospect puede estar interesado y no comprar por:

- envío;
- precio;
- confianza;
- pago;
- usabilidad;
- dudas de producto.

La estrategia debe intentar entender la barrera antes de aplicar una solución.

---

# 48. Prospect y confianza

En marcas desconocidas puede ser necesario trabajar:

- legitimidad;
- reviews;
- políticas;
- claridad;
- servicio.

---

# 49. Prospect y comparación

Visitar varios productos similares puede indicar evaluación activa.

Puede justificar contenido comparativo.

---

# 50. Prospect y no compra

No comprar no significa automáticamente falta de interés.

Puede deberse a:

- momento;
- presupuesto;
- investigación;
- fricción;
- indecisión.

---

# 51. Prospect y inactividad

La falta de actividad prolongada puede reducir prioridad.

No debe responderse automáticamente con más presión.

---

# 52. Prospect y re-engagement

Puede ser útil cuando existe historial suficiente para pensar que la relación merece recuperarse.

---

# 53. Prospect y sunset

Un prospect persistentemente desengaged puede dejar de justificar comunicación frecuente.

---

# 54. Segmentación útil

Ejemplos:

```text
high_intent_prospects
product_X_prospects
engaged_non_buyers
cart_prospects
checkout_prospects
cold_prospects
```

---

# 55. Prospect y exclusiones

Puede ser necesario excluir si:

- ya compró;
- existe alta presión;
- hay una incidencia;
- la oferta no aplica;
- existe conflicto con otra comunicación.

---

# 56. Prospect y transición

El agente debe pensar no solo en el estado, sino en el movimiento.

```text
browser
→ product_viewer
→ cart
→ checkout
→ buyer
```

---

# 57. Prospect y progresión

Más progreso puede justificar un mensaje más específico.

---

# 58. Prospect y regresión

La falta de avance puede sugerir:

- fricción;
- pérdida de interés;
- ciclo de decisión largo.

No debe interpretarse automáticamente como rechazo.

---

# 59. Antipatrón: todos los prospects iguales

Un prospect que acaba de suscribirse no es igual que uno en checkout.

---

# 60. Antipatrón: prospect = descuento

El incentivo no es la respuesta universal.

---

# 61. Antipatrón: perseguir indefinidamente

Más emails no garantizan recuperar una oportunidad.

---

# 62. Antipatrón: sobreinterpretar una señal

```text
1 product_view
→ HIGH_INTENT
```

es una inferencia débil.

---

# 63. Antipatrón: ignorar recencia

Una señal antigua puede haber perdido sentido.

---

# 64. Antipatrón: confundir engagement con intención

Un prospect puede interactuar mucho con contenido sin intención inmediata de compra.

---

# 65. Antipatrón: confundir intención con valor

Una persona muy cerca de comprar puede realizar una compra pequeña.

Valor e intención son dimensiones distintas.

---

# 66. Preguntas que debe hacerse el agente

```text
¿Cómo conocemos a esta persona?
¿Ha comprado antes?
¿Qué señales recientes existen?
¿Qué intención muestra?
¿Qué productos o categorías le interesan?
¿Qué engagement tiene?
¿Está navegando, en carrito o en checkout?
¿Cuánto tiempo ha pasado?
¿Qué objeciones pueden existir?
¿Qué presión ha recibido?
¿Qué objetivo tiene sentido ahora?
```

---

# 67. Modelo mental recomendado

```text
PROSPECT
+
INTENT
+
ENGAGEMENT
+
BEHAVIOR
+
RECENCY
+
AFFINITY
+
FRICTION
+
CONTEXT
```

La etiqueta `PROSPECT` por sí sola no basta.

---

# 68. Principio maestro

Un prospect es una oportunidad potencial, no una compra asegurada.

La IA debe dejar de pensar:

```text
prospect
→ sell
```

y pensar:

```text
prospect
+
evidence
+
context
→ determine_next_best_action
```

La pregunta correcta es:

> ¿Qué evidencia tenemos sobre esta persona y qué siguiente acción tiene realmente sentido?
