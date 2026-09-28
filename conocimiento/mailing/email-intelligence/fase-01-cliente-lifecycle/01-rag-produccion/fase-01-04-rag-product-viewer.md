# Fase 1.4 — Product Viewer

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA el concepto de `PRODUCT_VIEWER` dentro de un ecommerce.

Un Product Viewer es una persona que ha mostrado interés observable por uno o varios productos concretos mediante navegación.

Esta condición aporta más especificidad que un comportamiento general de browsing, pero no implica automáticamente:

- intención alta;
- voluntad inmediata de compra;
- necesidad de descuento;
- abandono;
- afinidad permanente;
- elegibilidad para recibir una comunicación;
- necesidad de activar un flow.

El agente debe interpretar las visualizaciones de producto dentro de un contexto más amplio de recencia, frecuencia, secuencia, lifecycle y comportamiento posterior.

---

# 1. Qué es un Product Viewer

Un Product Viewer es una persona que ha visitado una página de producto o ha interactuado con información asociada a un producto concreto.

Ejemplo:

```text
PRODUCT_VIEWED
```

La visualización identifica un foco de atención.

No demuestra por sí sola intención de compra.

---

# 2. Product Viewer vs Browser

`BROWSER` describe navegación general.

`PRODUCT_VIEWER` describe interés más específico.

Ejemplo:

```text
CATEGORY_VIEWED
```

aporta menos precisión que:

```text
PRODUCT_VIEWED = product_X
```

---

# 3. Product Viewer no es Cart Prospect

Ver un producto no equivale a añadirlo al carrito.

Conceptualmente:

```text
PRODUCT_VIEW
<
ADD_TO_CART
```

en fuerza de señal comercial, aunque el contexto puede modificar la interpretación.

---

# 4. Product Viewer no es Product Abandoner

Una visualización no implica abandono inmediato.

Para interpretar product abandonment suelen ser necesarias condiciones adicionales como:

```text
meaningful_product_interest
+
time_without_progression
+
no_cart
+
no_purchase
```

---

# 5. Una visualización aislada

Ejemplo:

```text
product_X viewed once
```

puede representar:

- curiosidad;
- comparación;
- navegación casual;
- interés temprano.

No debería generar automáticamente:

```text
HIGH_INTENT
```

---

# 6. Visualizaciones repetidas

Ejemplo:

```text
product_X viewed repeatedly
```

puede aumentar la probabilidad de:

- consideración;
- comparación;
- interés persistente.

La repetición gana valor cuando ocurre en varias sesiones.

---

# 7. Recencia

Una visualización reciente suele tener más utilidad para decisiones inmediatas.

```text
viewed_20_minutes_ago
```

es diferente de:

```text
viewed_45_days_ago
```

---

# 8. Frecuencia

La frecuencia de visualización puede aumentar la fuerza de la señal.

Pero debe comprobarse que no se trate de:

- eventos duplicados;
- recargas;
- tracking incorrecto.

---

# 9. Cross-session Product Viewing

Visualizar el mismo producto en varias sesiones puede indicar consideración persistente.

Ejemplo:

```text
Monday → product_X
Wednesday → product_X
Friday → product_X
```

Esta secuencia suele ser más informativa que tres vistas dentro de la misma sesión.

---

# 10. Product Viewer y intención

El interés por producto puede contribuir a una inferencia de intención.

Pero debe combinarse con:

- recencia;
- frecuencia;
- interacción;
- carrito;
- checkout;
- lifecycle.

---

# 11. Product Viewer y consideración

En muchos casos, la visualización de producto representa una etapa de consideración.

La persona puede estar evaluando:

- precio;
- características;
- reviews;
- variantes;
- disponibilidad;
- envío;
- alternativas.

---

# 12. Product Viewer y afinidad

Las visualizaciones pueden ayudar a inferir afinidad.

Ejemplo:

```text
multiple_views_of_skincare_products
```

puede sugerir:

```text
skincare_affinity
```

Pero una única vista no debería fijar una preferencia permanente.

---

# 13. Producto único vs múltiples productos

Debe distinguirse:

```text
same_product_repeatedly
```

de:

```text
many_products_same_category
```

y de:

```text
many_unrelated_products
```

Cada patrón puede representar una fase distinta.

---

# 14. Mismo producto repetido

Puede sugerir:

- comparación;
- indecisión;
- alto interés;
- espera.

Puede ser útil para una estrategia más específica.

---

# 15. Varios productos de la misma categoría

Puede indicar:

```text
category_consideration
```

más que afinidad por un SKU concreto.

---

# 16. Productos de categorías diferentes

Puede indicar:

- exploración;
- descubrimiento;
- compra múltiple;
- baja focalización.

No debe forzarse una afinidad concreta.

---

# 17. Product Viewer y búsquedas

Una secuencia como:

```text
SEARCH_PERFORMED
→ PRODUCT_VIEWED
```

puede ser una señal más fuerte que una vista procedente de navegación casual.

---

# 18. Product Viewer y filtros

Ejemplo:

```text
FILTER_SIZE
→ FILTER_COLOR
→ PRODUCT_VIEWED
```

puede revelar una consideración más específica.

---

# 19. Product Viewer y reviews

Una persona que revisa:

```text
PRODUCT_VIEWED
→ REVIEWS_VIEWED
```

puede estar intentando reducir incertidumbre.

Esto puede indicar una etapa de consideración más profunda.

---

# 20. Product Viewer y FAQ

Consultar:

- shipping;
- returns;
- sizing;
- compatibility;

puede sugerir posibles fricciones.

Debe tratarse como indicio, no como certeza.

---

# 21. Product Viewer y variantes

Interacción con:

- talla;
- color;
- capacidad;
- versión;

puede aportar información sobre preferencias concretas.

---

# 22. Product Viewer y stock

El interés comercial depende de disponibilidad.

Un producto agotado puede requerir:

- back in stock;
- alternativa;
- waitlist.

No una recuperación estándar.

---

# 23. Product Viewer y precio

El comportamiento puede variar según:

- precio actual;
- descuento;
- historial promocional;
- ticket.

Un producto de alto ticket puede requerir más visitas antes de comprar.

---

# 24. Ticket bajo

En productos impulsivos, una visualización repetida puede adquirir significado rápidamente.

---

# 25. Ticket alto

En productos de mayor consideración, varias visualizaciones pueden ser normales antes de la compra.

No debe interpretarse como fricción automáticamente.

---

# 26. Product Viewer y lifecycle

El mismo evento cambia según quién lo realiza.

Ejemplo:

```text
PROSPECT + PRODUCT_VIEW
```

puede representar primera consideración.

```text
REPEAT_BUYER + PRODUCT_VIEW
```

puede representar recompra o expansión.

---

# 27. Product Viewer después de comprar

Un cliente reciente puede visitar el mismo producto para:

- consultar instrucciones;
- revisar características;
- comprobar información.

No debe asumirse una nueva intención de compra.

---

# 28. Product Viewer y producto complementario

Un comprador que visita productos complementarios puede estar entrando en una oportunidad de cross-sell.

---

# 29. Product Viewer y reposición

Si un cliente vuelve a visualizar un consumible previamente comprado, puede aparecer una oportunidad de replenishment.

Debe tenerse en cuenta el ciclo esperado.

---

# 30. Product Viewer y upgrade

Un cliente que visita una versión superior puede mostrar interés potencial de upsell.

No debe asumirse que está insatisfecho con su compra anterior.

---

# 31. Product Viewer y devolución previa

Si la persona devolvió el mismo producto, una nueva visita requiere contexto adicional.

Puede representar:

- reconsideración;
- búsqueda de variante;
- error previo;
- interés renovado.

---

# 32. Product Viewer y producto similar devuelto

También puede influir en recomendaciones futuras.

La devolución es una señal relevante, pero no necesariamente rechazo completo de la categoría.

---

# 33. Product Viewer y campañas

Las visualizaciones pueden ayudar a construir audiencias como:

```text
viewed_product_X_recently
```

Pero debe existir además una razón válida para la campaña.

---

# 34. Product Viewer y product abandonment

Puede ser útil cuando existe:

```text
meaningful_product_view
+
no_cart
+
no_purchase
+
time_elapsed
```

No toda vista merece automatización.

---

# 35. Product Viewer y browse abandonment

Product abandonment es más específico que browse abandonment.

La estrategia puede utilizar el producto concreto como contexto.

---

# 36. Product Viewer y cart progression

Cuando ocurre:

```text
PRODUCT_VIEWED
→ ADD_TO_CART
```

la estrategia basada únicamente en product view puede quedar obsoleta.

---

# 37. Product Viewer y checkout progression

Si después aparece:

```text
CHECKOUT_STARTED
```

la señal de intención es todavía más específica.

---

# 38. Product Viewer y compra

Cuando ocurre:

```text
ORDER_PLACED
```

debe revisarse cualquier comunicación pendiente basada en la visualización previa.

---

# 39. Product Viewer y email click

Ejemplo:

```text
EMAIL_CLICKED_PRODUCT_X
→ PRODUCT_VIEWED_X
```

permite conectar el interés con una comunicación previa.

---

# 40. Product Viewer y paid media

La vista puede proceder de un anuncio específico.

La promesa original del anuncio puede ayudar a interpretar contexto.

---

# 41. Product Viewer y organic search

Una llegada orgánica a un producto específico puede reflejar una necesidad concreta.

Pero la intención debe seguir evaluándose mediante comportamiento posterior.

---

# 42. Product Viewer y direct traffic

Una visita directa repetida puede sugerir recuerdo o consideración.

Debe interpretarse con cautela.

---

# 43. Product Viewer y sensibilidad a precio

Patrones como:

```text
view_product
→ leave
→ return_when_discounted
```

pueden aportar evidencia de sensibilidad promocional.

Una sola observación no basta para concluirlo.

---

# 44. Product Viewer y price drop

Cuando una persona ha mostrado interés real y posteriormente baja el precio, puede existir una oportunidad relevante.

Pero la antigüedad de la señal importa.

---

# 45. Product Viewer y back in stock

Un producto previamente visto que vuelve a estar disponible puede crear una oportunidad de comunicación.

La relevancia depende de:

- recencia;
- frecuencia;
- ausencia de compra posterior.

---

# 46. Product Viewer y waitlist

La entrada voluntaria en waitlist es una señal más fuerte que la simple visualización.

---

# 47. Product Viewer y comparación

La visualización de varios productos sustitutos puede indicar que el usuario necesita ayuda para elegir.

Una estrategia útil puede ser:

- comparación;
- diferencias;
- caso de uso;
- guía.

No siempre descuento.

---

# 48. Product Viewer y social proof

Cuando la persona está considerando un producto, la prueba social puede ayudar a reducir incertidumbre.

Debe ser específica cuando sea posible.

---

# 49. Product Viewer y educación

Algunos productos necesitan explicar:

- cómo funcionan;
- cómo usarlos;
- para quién son;
- qué problema resuelven.

La educación puede ser más útil que una promoción.

---

# 50. Product Viewer y objeciones

Posibles barreras:

```text
price
fit
quality
shipping
returns
compatibility
trust
```

No deben atribuirse sin evidencia.

---

# 51. Product Viewer y margen

Un producto con bajo margen puede requerir una estrategia distinta de uno con alta contribución.

Pero la economía concreta pertenece al contexto de la tienda.

---

# 52. Product Viewer y disponibilidad regional

No debe promocionarse un producto que no puede venderse al usuario en su mercado.

---

# 53. Product Viewer y idioma

El idioma del contenido debe respetar la información disponible sobre mercado y preferencias.

---

# 54. Product Viewer y personalización

Puede personalizarse mediante:

- producto;
- variante;
- categoría;
- beneficio;
- prueba social.

Debe evitarse una personalización demasiado explícita o invasiva.

---

# 55. Personalización invasiva

Ejemplo:

> Has visto este producto nueve veces esta semana.

Aunque técnicamente sea cierto, puede generar incomodidad.

La personalización puede funcionar mejor de forma implícita.

---

# 56. Product Viewer y presión comercial

Una señal de producto puede ser relevante y aun así no justificar un nuevo email si:

- existe alta frecuencia reciente;
- hay otro flow activo;
- existe una comunicación más prioritaria.

---

# 57. Product Viewer y NO_SEND

Puede ser correcto no enviar cuando:

- solo hubo una vista débil;
- la vista es antigua;
- ya compró;
- el producto está agotado;
- existe una incidencia;
- la presión es alta;
- la persona avanzó a otro estado.

---

# 58. Product Viewer y engagement

La visualización del producto representa engagement con la tienda.

No necesariamente engagement con email.

Ambas dimensiones deben mantenerse separadas.

---

# 59. Product Viewer y valor del cliente

Un cliente de alto valor merece buen tratamiento, pero eso no convierte cualquier product view en oportunidad urgente.

---

# 60. Product Viewer y VIP

Puede ser apropiado adaptar:

- acceso;
- disponibilidad;
- novedades;
- servicio.

Pero la estrategia debe seguir basándose en relevancia.

---

# 61. Product Viewer y comportamiento histórico

El historial ayuda a interpretar la señal.

Ejemplo:

```text
viewed_product_from_previous_purchase_category
```

puede tener más significado que una categoría completamente nueva.

---

# 62. Product Viewer y afinidad histórica

Una vista coherente con afinidad conocida refuerza confianza.

Una vista aislada en una categoría nueva puede representar exploración.

---

# 63. Product Viewer y cambio de interés

Las personas pueden cambiar de preferencias.

El sistema no debe conservar eternamente una afinidad antigua si aparece nuevo comportamiento.

---

# 64. Product Viewer y temporalidad

Productos estacionales pueden tener ventanas de intención específicas.

---

# 65. Product Viewer y gifting

Una visita puede corresponder a compra para otra persona.

No toda visualización representa preferencia personal.

---

# 66. Product Viewer y household behavior

En dispositivos compartidos, el comportamiento puede pertenecer a otra persona.

La certeza de identidad importa.

---

# 67. Product Viewer y tracking

La calidad de tracking condiciona la interpretación.

Deben considerarse posibles:

- duplicados;
- refresh;
- bots;
- errores.

---

# 68. Señal débil

Ejemplo:

```text
single_product_view
+
no_other_activity
```

---

# 69. Señal moderada

Ejemplo:

```text
multiple_product_views
+
same_category
+
recent
```

---

# 70. Señal fuerte

Ejemplo:

```text
same_product_repeatedly
+
reviews_viewed
+
variant_selected
+
recent
```

Aun así, sigue siendo una inferencia de interés.

---

# 71. Señales superiores

Eventos como:

```text
ADD_TO_CART
CHECKOUT_STARTED
ORDER_PLACED
```

aportan una señal más avanzada y pueden sustituir la estrategia anterior.

---

# 72. Relevance Decay

El valor de una visualización decrece con el tiempo.

La velocidad depende de:

- ticket;
- categoría;
- ciclo de compra;
- comportamiento histórico.

---

# 73. Product Viewer y ciclos rápidos

En compras impulsivas, el interés puede caducar rápidamente.

---

# 74. Product Viewer y ciclos largos

En productos complejos o caros, el interés puede mantenerse durante semanas.

---

# 75. Product Viewer y recomendaciones alternativas

Si el producto no encaja o no está disponible, pueden tener sentido alternativas.

Pero deben ser realmente sustituibles o relevantes.

---

# 76. Product Viewer y complementos

No debe confundirse:

```text
alternative
```

con:

```text
complementary_product
```

El primero sustituye.

El segundo complementa.

---

# 77. Product Viewer y prueba de intención

La mejor confirmación de interés suele venir de nuevas acciones.

El sistema debe esperar más evidencia cuando la señal inicial es débil.

---

# 78. Antipatrón: una vista = abandono

El usuario puede seguir navegando.

---

# 79. Antipatrón: una vista = alta intención

Es una interpretación excesiva.

---

# 80. Antipatrón: descuento inmediato

Una vista de producto no demuestra que el precio sea el problema.

---

# 81. Antipatrón: perseguir el mismo producto indefinidamente

La relevancia caduca.

---

# 82. Antipatrón: ignorar progresión

Si la persona ya está en carrito, la vista de producto deja de ser la señal principal.

---

# 83. Antipatrón: ignorar compras posteriores

No debe seguir tratándose a la persona como Product Viewer si ya compró en ese contexto.

---

# 84. Antipatrón: asumir afinidad permanente

Una visita puntual no define preferencias futuras.

---

# 85. Antipatrón: mostrar comportamiento explícito

La personalización no debería hacer sentir al usuario que está siendo vigilado.

---

# 86. Preguntas que debe hacerse el agente

```text
¿Qué producto vio?
¿Cuántas veces?
¿Cuándo?
¿En una o varias sesiones?
¿Vio productos similares?
¿Consultó reviews o FAQ?
¿Seleccionó variantes?
¿Buscó el producto?
¿Pasó a carrito?
¿Pasó a checkout?
¿Compró?
¿Ya había comprado productos relacionados?
¿La señal sigue siendo reciente?
¿Existe presión comercial?
```

---

# 87. Modelo mental recomendado

```text
PRODUCT_VIEW
+
RECENCY
+
FREQUENCY
+
DEPTH
+
SEQUENCE
+
PRODUCT_CONTEXT
+
LIFECYCLE
+
PURCHASE_HISTORY
```

---

# 88. Principio maestro

Una visualización de producto es evidencia de atención sobre un SKU o propuesta concreta.

No es una compra ni una autorización automática para contactar.

La IA debe dejar de pensar:

```text
PRODUCT_VIEWED
→ send_product_email
```

y pensar:

```text
PRODUCT_VIEW_PATTERN
+
CUSTOMER_CONTEXT
+
PROGRESSION
+
RELEVANCE
→ determine_next_best_action
```

La pregunta correcta es:

> ¿Qué nivel de interés demuestra realmente esta interacción con el producto y qué acción, si alguna, merece?
