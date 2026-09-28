# Fase 1.3 — Browser

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA el concepto de `BROWSER` dentro de un ecommerce.

Un browser es una persona identificada o parcialmente identificada que navega por el ecommerce y genera señales de exploración.

La navegación puede aportar información sobre:

- interés;
- afinidad;
- consideración;
- intención;
- comparación;
- fricción;
- progresión.

Pero navegar no implica automáticamente:

- intención alta;
- interés fuerte;
- abandono;
- necesidad de email;
- voluntad de compra inmediata.

El agente debe interpretar la navegación como evidencia contextual, no como una conclusión definitiva.

---

# 1. Qué es un browser

Un browser es una persona que interactúa con el ecommerce mediante navegación.

Puede realizar acciones como:

```text
PAGE_VIEWED
CATEGORY_VIEWED
COLLECTION_VIEWED
PRODUCT_VIEWED
SEARCH_PERFORMED
FILTER_APPLIED
```

La navegación describe comportamiento observable.

No explica por sí sola qué quiere comprar ni cuándo.

---

# 2. Browser no es lifecycle

`BROWSER` describe comportamiento actual o reciente.

No debería utilizarse como sustituto de estados como:

```text
PROSPECT
FIRST_TIME_BUYER
REPEAT_BUYER
VIP
```

Ejemplo:

```text
lifecycle = REPEAT_BUYER
behavior = BROWSER
```

---

# 3. Browser no es Product Viewer

`BROWSER` es una categoría más amplia.

Puede incluir navegación por:

- homepage;
- categorías;
- colecciones;
- contenido;
- FAQ;
- blog;
- buscador;
- múltiples productos.

`PRODUCT_VIEWER` implica una señal más específica centrada en uno o varios productos.

---

# 4. Browser no es Browse Abandoner

Una persona puede estar navegando activamente.

No debe interpretarse inmediatamente como abandono.

Para hablar de browse abandonment normalmente debe existir:

```text
meaningful_browsing
+
time_without_progression
+
no_purchase
```

---

# 5. Browser conocido y browser anónimo

Debe distinguirse:

```text
KNOWN_BROWSER
```

de:

```text
ANONYMOUS_BROWSER
```

El comportamiento anónimo puede aportar conocimiento agregado.

Pero para una acción individual de email debe existir una identidad utilizable y un contexto adecuado.

---

# 6. Navegación superficial

Ejemplo:

```text
homepage_view
short_session
no_product_view
```

Esta señal aporta poca evidencia sobre intención.

---

# 7. Navegación exploratoria

Puede incluir:

- varias categorías;
- múltiples productos;
- búsquedas amplias;
- lectura de contenido;
- filtros.

Puede representar descubrimiento más que intención inmediata.

---

# 8. Navegación enfocada

Puede aparecer cuando existe:

```text
same_category_revisited
same_product_revisited
related_products_viewed
```

Suele aportar más información sobre consideración.

---

# 9. Navegación profunda

Puede existir cuando una persona:

- consulta varios productos;
- compara;
- utiliza filtros;
- visita FAQs;
- revisa shipping;
- revisa devoluciones;
- visita reviews.

La profundidad puede indicar consideración, pero no siempre intención alta.

---

# 10. Recencia

El tiempo desde la navegación importa.

Ejemplo:

```text
PRODUCT_VIEWED hace 15 minutos
```

tiene más relevancia inmediata que:

```text
PRODUCT_VIEWED hace 60 días
```

---

# 11. Frecuencia

La repetición puede aumentar la fuerza de una señal.

Ejemplo:

```text
product_X viewed once
```

es distinto de:

```text
product_X viewed repeatedly across sessions
```

---

# 12. Secuencia

El orden importa.

Ejemplo:

```text
CATEGORY_VIEWED
→ PRODUCT_VIEWED
→ REVIEWS_VIEWED
→ ADD_TO_CART
```

puede indicar progresión.

---

# 13. Navegación por categoría

Una persona puede mostrar interés por una categoría sin haber elegido producto.

Ejemplo:

```text
running_shoes
```

Puede ser útil para:

- educación;
- product discovery;
- recomendaciones.

---

# 14. Navegación por colección

Las colecciones pueden expresar contextos diferentes.

Ejemplos:

```text
NEW_ARRIVALS
BEST_SELLERS
SALE
SUMMER_COLLECTION
```

El significado depende de la colección.

---

# 15. Product views

Ver un producto es una señal más específica que visitar una categoría.

Pero una única vista sigue siendo insuficiente para concluir:

```text
HIGH_INTENT
```

---

# 16. Repeated Product Views

Las visitas repetidas pueden indicar:

- consideración;
- comparación;
- indecisión;
- interés.

Deben interpretarse junto con tiempo y otras acciones.

---

# 17. Búsqueda interna

Una búsqueda puede expresar necesidad de forma más explícita.

Ejemplo:

```text
SEARCH_PERFORMED = "waterproof hiking boots"
```

Puede aportar más contexto que una visita genérica.

---

# 18. Búsqueda genérica

Ejemplo:

```text
SEARCH_PERFORMED = "shoes"
```

aporta menos precisión que una búsqueda específica.

---

# 19. Búsqueda sin resultados

Puede indicar demanda no satisfecha.

Ejemplo:

```text
SEARCH_PERFORMED
results = 0
```

Esto puede ser útil para:

- merchandising;
- catálogo;
- investigación.

No significa automáticamente que deba enviarse un email.

---

# 20. Filtros

Los filtros pueden revelar preferencias.

Ejemplos:

```text
size
color
price
material
brand
category
```

Pero una preferencia de navegación no debe confundirse automáticamente con preferencia permanente.

---

# 21. Ordenación

Acciones como:

```text
sort_by_price
sort_by_best_selling
sort_by_newest
```

pueden aportar contexto secundario.

---

# 22. Reviews vistas

Visitar reviews puede indicar:

- evaluación;
- necesidad de confianza;
- comparación;
- reducción de riesgo.

Es una señal potencialmente más profunda que una simple visita de producto.

---

# 23. FAQ vista

Puede revelar dudas.

Ejemplo:

```text
shipping_FAQ
returns_FAQ
sizing_FAQ
```

No debe asumirse automáticamente cuál es la objeción.

---

# 24. Size Guide

Consultar tallaje puede ser una señal de consideración fuerte en moda.

Pero no garantiza compra.

---

# 25. Shipping Page

Visitar información de envío puede sugerir una fricción potencial.

Debe tratarse como indicio, no como certeza.

---

# 26. Return Policy

Consultar devoluciones puede representar:

- consideración;
- preocupación;
- comparación;
- seguridad.

No es necesariamente una señal negativa.

---

# 27. Navegación desde email

Ejemplo:

```text
EMAIL_CLICKED
→ PRODUCT_VIEWED
```

permite conectar mensaje y comportamiento.

Esto puede ayudar a interpretar interés.

---

# 28. Navegación desde paid media

Ejemplo:

```text
AD_CLICK
→ PRODUCT_VIEWED
```

La promesa del anuncio puede ayudar a entender el contexto inicial.

---

# 29. Navegación directa

Puede indicar:

- recuerdo de marca;
- intención;
- hábito;
- retorno.

Pero no debe sobrerinterpretarse.

---

# 30. Cross-session browsing

La navegación en distintas sesiones puede ser más relevante que una sola sesión extensa.

Ejemplo:

```text
session_1 → category_A
session_2 → product_X
session_3 → product_X
```

Puede indicar interés persistente.

---

# 31. Navegación multi-dispositivo

Una persona puede explorar desde:

- móvil;
- desktop;
- tablet.

El dispositivo no cambia necesariamente el lifecycle.

---

# 32. Navegación y afinidad

Puede ayudar a inferir:

```text
product_affinity
category_affinity
```

Pero debe existir suficiente evidencia.

---

# 33. Navegación y intención

La navegación puede aumentar intención cuando existe progresión.

Ejemplo:

```text
CATEGORY_VIEWED
→ PRODUCT_VIEWED
→ PRODUCT_VIEWED_AGAIN
→ ADD_TO_CART
```

---

# 34. Navegación y engagement

Visitar la tienda es una forma de engagement.

Pero debe distinguirse de:

```text
EMAIL_ENGAGEMENT
```

Puede existir:

```text
site_engagement = HIGH
email_engagement = LOW
```

---

# 35. Navegación y lifecycle

El mismo comportamiento puede tener distinto significado según lifecycle.

Ejemplo:

```text
PROSPECT + product browsing
```

puede representar primera consideración.

```text
REPEAT_BUYER + complementary browsing
```

puede representar cross-sell.

---

# 36. Navegación después de comprar

Un cliente reciente puede navegar para:

- revisar el producto;
- comprobar detalles;
- buscar accesorios;
- comparar precios;
- explorar otra categoría.

No debe asumirse automáticamente que quiere volver a comprar.

---

# 37. Navegación después de devolución

Puede indicar:

- sustitución;
- nueva búsqueda;
- insatisfacción;
- cambio de necesidad.

El contexto de devolución cambia la interpretación.

---

# 38. Navegación de cliente VIP

El valor del cliente puede aumentar prioridad comercial.

Pero no convierte cada visita en alta intención.

---

# 39. Navegación y producto agotado

Interés por producto sin stock puede hacer más relevante:

- back in stock;
- alternativas;
- waitlist.

No una promoción genérica sin contexto.

---

# 40. Navegación y descuento

Visitar repetidamente secciones de sale puede aportar indicios sobre sensibilidad promocional.

Debe existir comportamiento suficiente antes de inferirlo.

---

# 41. Navegación y comparación

Visitar varios productos similares puede sugerir:

```text
CONSIDERATION
```

Puede ser más útil ofrecer:

- comparación;
- guía;
- proof;
- diferenciación;

que un descuento inmediato.

---

# 42. Navegación amplia

Si una persona explora muchas categorías diferentes, puede existir:

- curiosidad;
- descubrimiento;
- baja focalización.

No debe inferirse una afinidad concreta demasiado pronto.

---

# 43. Navegación enfocada

Si la actividad se concentra repetidamente en una categoría concreta, la inferencia de afinidad puede ganar fuerza.

---

# 44. Navegación y duración

El tiempo de permanencia puede aportar contexto.

Pero una pestaña abierta no demuestra necesariamente interés.

No debe utilizarse como señal fuerte aislada.

---

# 45. Navegación y scroll

El scroll puede indicar consumo de contenido.

Suele ser señal secundaria.

---

# 46. Navegación y interacción con vídeo

Puede aportar señales de interés cuando:

- el vídeo explica producto;
- demuestra uso;
- responde objeciones.

Debe interpretarse dentro del contexto.

---

# 47. Navegación y wishlist

La wishlist puede representar una señal más persistente que una visita simple.

Pero no necesariamente intención inmediata.

---

# 48. Navegación y comparación de variantes

Cambiar entre:

- colores;
- tallas;
- tamaños;
- versiones;

puede reflejar consideración.

---

# 49. Navegación y stock de variante

Una persona puede estar interesada en un producto pero su variante no estar disponible.

Esto cambia la oportunidad comercial.

---

# 50. Navegación y mercado

La relevancia depende de que el producto:

- pueda venderse;
- pueda enviarse;
- esté disponible;

en el mercado del usuario.

---

# 51. Navegación y idioma

La navegación puede aportar señales sobre idioma preferido.

Estas deben combinarse con información explícita cuando exista.

---

# 52. Navegación y comportamiento anterior

La historia ayuda a interpretar señales nuevas.

Ejemplo:

```text
first_visit_to_category
```

es diferente de:

```text
category_revisited_after_previous_purchase
```

---

# 53. Navegación y progresión

El agente debe detectar cuando la persona avanza.

```text
browse
→ product_view
→ cart
```

Cuando esto ocurre, una estrategia basada solo en navegación puede quedar obsoleta.

---

# 54. Navegación y regresión

Una persona puede volver de checkout a browsing.

Puede indicar:

- comparación;
- duda;
- cambio de producto;
- nueva necesidad.

No debe asumirse automáticamente abandono.

---

# 55. Navegación y abandono

Para considerar un browse abandonment deberían existir al menos:

```text
meaningful_browse_signal
+
inactivity
+
no_progression
+
no_purchase
```

---

# 56. Browser y campañas

La navegación puede ayudar a definir audiencias.

Ejemplo:

```text
browsed_category_X_recently
```

Pero la campaña debe seguir teniendo una razón propia.

---

# 57. Browser y flows

La navegación puede apoyar:

- browse abandonment;
- product abandonment;
- back in stock;
- price drop.

No todo browser debería entrar en un flow.

---

# 58. Browser y personalización

Puede personalizarse mediante:

- productos recientes;
- categoría;
- intención;
- contenido.

Debe evitarse exponer comportamiento de forma invasiva.

---

# 59. Browser y recomendaciones

Las recomendaciones deberían considerar:

- relevancia;
- afinidad;
- stock;
- lifecycle;
- compra previa.

---

# 60. Browser y presión comercial

Una señal débil no debe justificar una nueva comunicación cuando la presión ya es alta.

---

# 61. Browser y NO_SEND

Puede ser correcto no enviar si:

- la señal es débil;
- es antigua;
- existe alta presión;
- ya compró;
- existe otro flow más relevante;
- no existe producto adecuado.

---

# 62. Browser y aprendizaje

El comportamiento agregado puede ayudar a comprender:

- categorías de interés;
- rutas;
- comparaciones;
- puntos de fricción.

Debe evitarse convertir cada correlación en regla.

---

# 63. Relevance Decay

Una señal de navegación pierde valor con el tiempo.

La velocidad depende de:

- producto;
- categoría;
- ciclo de decisión.

---

# 64. Browser y ciclos largos

En productos de alta consideración, una visita antigua puede seguir teniendo valor durante más tiempo.

---

# 65. Browser y ciclos cortos

En productos impulsivos, la señal puede perder relevancia rápidamente.

---

# 66. Browser y calidad del tracking

Datos incorrectos pueden producir:

- falsa afinidad;
- falsa intención;
- recomendaciones irrelevantes.

---

# 67. Bots

Tráfico automatizado puede contaminar eventos de navegación.

La IA debe reconocer que el tracking no siempre equivale a comportamiento humano real.

---

# 68. Duplicados

Eventos duplicados pueden exagerar interés.

---

# 69. Identidad incorrecta

Un dispositivo compartido o identificación defectuosa puede asociar navegación a la persona equivocada.

Por ello, el grado de confianza importa.

---

# 70. Señales débiles

Ejemplos:

```text
homepage_view
single_page_view
generic_category_view
```

---

# 71. Señales medias

Ejemplos:

```text
multiple_category_views
search
product_view
```

---

# 72. Señales fuertes

Ejemplos:

```text
repeated_product_views
wishlist
comparison_behavior
```

Especialmente cuando son recientes y consistentes.

---

# 73. Señales superiores a browsing

Cuando aparece:

```text
ADD_TO_CART
CHECKOUT_STARTED
ORDER_PLACED
```

esas señales suelen aportar contexto comercial más específico.

---

# 74. Antipatrón: cualquier visita = intención

La navegación puede ser exploratoria.

---

# 75. Antipatrón: cualquier visita = abandono

El usuario puede seguir activo.

---

# 76. Antipatrón: perseguir cada producto visto

Puede producir sensación invasiva y saturación.

---

# 77. Antipatrón: ignorar recencia

El interés puede caducar.

---

# 78. Antipatrón: afinidad permanente

Los intereses evolucionan.

---

# 79. Antipatrón: ignorar lifecycle

El mismo comportamiento puede significar cosas diferentes para prospect y repeat buyer.

---

# 80. Antipatrón: ignorar progresión

Una señal más avanzada puede volver irrelevante una estrategia anterior.

---

# 81. Preguntas que debe hacerse el agente

```text
¿Está identificado?
¿Qué ha visto?
¿Cuántas veces?
¿En cuántas sesiones?
¿Cuándo ocurrió?
¿Existe una categoría dominante?
¿Existe un producto dominante?
¿Ha buscado algo?
¿Ha utilizado filtros?
¿Ha progresado hacia carrito o checkout?
¿Ha comprado?
¿Qué lifecycle tiene?
¿Qué presión existe?
¿La señal es suficientemente fuerte para actuar?
```

---

# 82. Modelo mental recomendado

```text
BROWSER
+
RECENCY
+
FREQUENCY
+
DEPTH
+
FOCUS
+
SEQUENCE
+
LIFECYCLE
+
CUSTOMER_HISTORY
```

---

# 83. Principio maestro

La navegación es evidencia de exploración.

No es una autorización para actuar ni una prueba automática de intención.

La IA debe dejar de pensar:

```text
page_view
→ send_email
```

y pensar:

```text
browsing_pattern
+
context
+
relevance
→ determine_if_action_is_justified
```

La pregunta correcta es:

> ¿Qué demuestra realmente este patrón de navegación y merece alguna acción?
