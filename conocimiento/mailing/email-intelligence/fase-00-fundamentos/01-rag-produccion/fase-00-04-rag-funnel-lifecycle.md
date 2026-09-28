# Fase 0.4 — Funnel y lifecycle del cliente

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA la diferencia entre:

- funnel;
- lifecycle;
- comportamiento;
- intención;
- estado del cliente.

El funnel describe el avance hacia una conversión concreta.

El lifecycle describe la relación global y evolutiva entre una persona y la marca.

Ambos conceptos se relacionan, pero no deben confundirse.

---

# 1. Qué es el funnel

El funnel representa el recorrido hacia una acción o conversión concreta.

Ejemplo simplificado:

```text
awareness
→ interest
→ consideration
→ intent
→ conversion
```

En ecommerce puede observarse mediante señales como:

```text
visit
→ product_view
→ add_to_cart
→ checkout
→ purchase
```

El funnel ayuda a entender:

- proximidad a compra;
- fricción;
- progresión;
- abandono.

---

# 2. Qué es el lifecycle

El lifecycle representa la evolución de la relación del cliente con la marca a lo largo del tiempo.

Ejemplo:

```text
subscriber
→ prospect
→ first-time buyer
→ repeat buyer
→ high-value customer
→ at-risk
→ lapsed
→ reactivated
```

El lifecycle no se limita a una compra concreta.

Puede abarcar meses o años.

---

# 3. Diferencia fundamental

El funnel responde:

> ¿Dónde está esta persona respecto a una conversión?

El lifecycle responde:

> ¿Qué relación tiene esta persona con la marca?

Ejemplo:

Un cliente recurrente puede estar:

```text
lifecycle = REPEAT_BUYER
```

y al mismo tiempo:

```text
funnel = CHECKOUT
```

para una nueva compra.

---

# 4. Funnel y lifecycle pueden coexistir

No deben representarse como una única etiqueta.

Ejemplo:

```text
customer:
  lifecycle = REPEAT_BUYER
  current_funnel_stage = PRODUCT_CONSIDERATION
```

Esto aporta más contexto que:

```text
customer_type = buyer
```

---

# 5. El funnel es contextual

Una persona puede estar en distintos funnels al mismo tiempo.

Ejemplo:

```text
category_A → checkout
category_B → awareness
```

Por tanto, no siempre existe un único funnel global.

---

# 6. El lifecycle es más estable

Los estados de lifecycle suelen cambiar menos frecuentemente.

Ejemplo:

```text
PROSPECT
→ FIRST_TIME_BUYER
```

es una transición relevante.

Mientras que dentro de una sesión pueden ocurrir:

```text
browse
→ product_view
→ cart
→ checkout
```

---

# 7. Awareness

## Definición

La persona conoce o empieza a descubrir la marca, producto o categoría.

Puede existir poca información sobre:

- necesidad;
- intención;
- producto deseado.

Los mensajes suelen necesitar más contexto y educación.

---

# 8. Interest

## Definición

La persona muestra señales de interés.

Ejemplos:

- visita;
- click;
- lectura;
- categoría vista;
- interacción con contenido.

Interés no equivale todavía a intención de compra.

---

# 9. Consideration

## Definición

La persona evalúa productos o alternativas.

Puede aparecer mediante:

- visitas repetidas;
- comparaciones;
- búsquedas;
- product views;
- reviews;
- preguntas.

En esta etapa suelen ser importantes:

- diferenciación;
- prueba social;
- claridad;
- resolución de objeciones.

---

# 10. Intent

## Definición

Existen señales más claras de posible compra.

Ejemplos:

```text
add_to_cart
checkout_started
repeated_high-intent_behavior
```

Debe seguir tratándose como una estimación, no como certeza.

---

# 11. Conversion

## Definición

Se completa la acción principal.

En ecommerce normalmente:

```text
ORDER_PLACED
```

La conversión cierra un funnel concreto.

No termina el lifecycle.

---

# 12. Después de la conversión

Tras la compra comienza otra etapa.

Ejemplo:

```text
purchase
→ post-purchase
→ product experience
→ potential second purchase
```

El sistema debe evitar pensar que:

```text
conversion = end
```

---

# 13. Subscriber dentro del lifecycle

`SUBSCRIBER` describe relación con el canal.

Puede coincidir con distintos estados comerciales.

Ejemplo:

```text
subscriber + prospect
subscriber + first-time buyer
subscriber + repeat buyer
```

Por eso no debe utilizarse como lifecycle completo.

---

# 14. Prospect

## Definición

Persona identificada con potencial comercial que todavía no ha completado la compra relevante.

Puede tener:

```text
low_intent
medium_intent
high_intent
```

---

# 15. First-Time Buyer

## Definición

Cliente que ha realizado su primera compra.

Esta etapa es crítica porque todavía debe:

- recibir correctamente;
- utilizar el producto;
- confirmar confianza;
- desarrollar una segunda compra.

---

# 16. Repeat Buyer

## Definición

Cliente que ha comprado más de una vez.

La repetición suele indicar una relación más fuerte que una única compra.

Pero no implica automáticamente:

```text
VIP
```

o:

```text
high_value
```

---

# 17. High-Value Customer

## Definición

Cliente cuyo valor económico es alto respecto al contexto de la tienda.

Puede depender de:

- gasto;
- frecuencia;
- margen;
- recurrencia;
- duración de relación.

No debe definirse únicamente por revenue bruto.

---

# 18. VIP

## Definición

Cliente que la marca decide tratar como especialmente valioso o estratégico.

Puede considerar:

- valor;
- frecuencia;
- antigüedad;
- advocacy;
- loyalty.

`VIP` puede ser una clasificación comercial más amplia que una métrica estrictamente económica.

---

# 19. At-Risk

## Definición

Cliente cuya probabilidad de reducir o abandonar su relación parece aumentar.

Señales posibles:

- caída de frecuencia;
- ausencia respecto a su ciclo esperado;
- menor engagement;
- problemas de experiencia.

Debe tratarse como estado derivado.

---

# 20. Lapsed

## Definición

Cliente cuya relación ha superado de forma significativa el periodo esperado de actividad o recompra.

No existe una ventana universal.

Depende del negocio.

---

# 21. Reactivated

## Definición

Cliente previamente inactivo que vuelve a generar una señal relevante.

Puede ser:

- visita;
- click;
- compra;
- interacción;
- checkout.

La fuerza de la reactivación depende de la señal.

---

# 22. Lifecycle no es lineal

El cliente no siempre avanza de forma ordenada.

Ejemplo:

```text
repeat_buyer
→ at_risk
→ reactivated
→ repeat_buyer
```

Puede haber regresiones y reactivaciones.

---

# 23. El funnel tampoco es lineal

Una persona puede:

```text
product_view
→ cart
→ leave
→ return
→ product_view
→ checkout
```

No debe asumirse un recorrido perfecto.

---

# 24. Una persona puede abandonar y volver

El abandono no significa pérdida definitiva.

Ejemplo:

```text
checkout_abandonment
→ 3 days
→ return
→ purchase
```

El sistema debe interpretar comportamiento en ventanas temporales.

---

# 25. Lifecycle e intención son dimensiones diferentes

Ejemplo:

```text
FIRST_TIME_BUYER
+
LOW_CURRENT_INTENT
```

Otro:

```text
LAPSED_CUSTOMER
+
HIGH_CURRENT_INTENT
```

Una persona inactiva puede volver con alta intención.

---

# 26. Lifecycle y engagement también son distintos

Ejemplo:

```text
VIP
+
LOW_EMAIL_ENGAGEMENT
```

Un cliente puede seguir siendo valioso aunque no interactúe frecuentemente con emails.

---

# 27. Lifecycle y valor son distintos

Ejemplo:

```text
REPEAT_BUYER
```

no implica automáticamente:

```text
HIGH_VALUE
```

Puede haber compras pequeñas y frecuentes.

---

# 28. Lifecycle y afinidad son distintos

Un cliente puede tener:

```text
lifecycle = REPEAT_BUYER
affinity = skincare
```

La afinidad aporta contexto de producto.

---

# 29. Lifecycle y presión comercial

La frecuencia adecuada puede variar por etapa.

Ejemplo:

Un prospect en checkout puede necesitar una respuesta contextual.

Un cliente lapsed puede necesitar menos presión y una estrategia distinta.

No existe una frecuencia universal por lifecycle.

---

# 30. Lifecycle y contenido

El contenido debe adaptarse.

Ejemplo conceptual:

```text
PROSPECT
→ education + trust

FIRST_TIME_BUYER
→ reassurance + product education

REPEAT_BUYER
→ relevance + next purchase

VIP
→ recognition + exclusivity

AT_RISK
→ retention + friction discovery

LAPSED
→ reactivation
```

---

# 31. Lifecycle y oferta

La oferta no debe ser automática.

Ejemplo:

```text
VIP
```

no significa necesariamente:

```text
discount
```

Puede recibir:

- early access;
- exclusividad;
- servicio;
- acceso especial.

---

# 32. Lifecycle y objetivos

Cada etapa puede cambiar el objetivo prioritario.

Ejemplo:

```text
PROSPECT
→ activation / conversion

FIRST_TIME_BUYER
→ satisfaction / second purchase

REPEAT_BUYER
→ retention / cross-sell

AT_RISK
→ retention

LAPSED
→ reactivation
```

---

# 33. El lifecycle depende del modelo de negocio

No debe utilizarse el mismo criterio para:

```text
coffee subscription
```

que para:

```text
luxury furniture
```

El ciclo esperado de compra es diferente.

---

# 34. Productos de compra frecuente

En categorías recurrentes puede haber transiciones rápidas.

Ejemplos:

- consumibles;
- belleza;
- alimentación;
- suplementos.

La ausencia de recompra puede adquirir significado relativamente pronto.

---

# 35. Productos de compra infrecuente

En categorías como:

- mobiliario;
- electrónica premium;
- productos de larga duración;

una ventana larga sin compra puede ser completamente normal.

No debe clasificarse al cliente como lapsed demasiado pronto.

---

# 36. Funnel por producto

El sistema puede interpretar interés por producto específico.

Ejemplo:

```text
product_A:
  stage = checkout

product_B:
  stage = consideration
```

Esto es más preciso que un único estado genérico.

---

# 37. Funnel por categoría

También puede existir:

```text
category_affinity
```

sin producto dominante.

Ejemplo:

Una persona explora múltiples zapatillas de running.

Puede estar en consideración de categoría, no de un SKU concreto.

---

# 38. Microconversiones

Antes de la compra pueden existir acciones útiles.

Ejemplos:

- signup;
- wishlist;
- quiz;
- product comparison;
- size guide;
- email click.

Estas señales ayudan a entender progresión.

No deben confundirse con conversión final.

---

# 39. Macroconversión

La acción económica principal suele ser:

```text
purchase
```

Pero el sistema debe respetar el objetivo concreto de cada estrategia.

---

# 40. Funnel de primera compra

Ejemplo:

```text
discovery
→ interest
→ product consideration
→ cart
→ checkout
→ first purchase
```

Este funnel tiene barreras de confianza diferentes al de un cliente conocido.

---

# 41. Funnel de recompra

Ejemplo:

```text
need reappears
→ product reminder
→ consideration
→ repurchase
```

Puede ser más corto porque la confianza ya existe.

---

# 42. Funnel de cross-sell

Ejemplo:

```text
existing purchase
→ complementary need
→ recommendation
→ consideration
→ purchase
```

---

# 43. Funnel de reactivación

Ejemplo:

```text
lapsed
→ re-engagement
→ visit
→ product interest
→ purchase
```

La reactivación puede comenzar antes de una compra.

---

# 44. El agente debe trabajar con transiciones

No debe analizar únicamente estados estáticos.

Debe preguntarse:

```text
¿de dónde viene?
¿dónde está?
¿hacia dónde podría avanzar?
```

La transición es tan importante como el estado.

---

# 45. Señales de progresión

Ejemplos:

```text
category_view
→ product_view

product_view
→ add_to_cart

cart
→ checkout

first_purchase
→ second_purchase
```

Estas progresiones pueden justificar cambios de estrategia.

---

# 46. Señales de regresión

Ejemplo:

```text
checkout
→ inactivity
```

puede indicar fricción.

Otro:

```text
repeat_buyer
→ long inactivity
```

puede indicar riesgo.

---

# 47. El contexto temporal importa

Una señal reciente suele tener más relevancia que una antigua.

Ejemplo:

```text
checkout_started_today
```

frente a:

```text
checkout_started_45_days_ago
```

La interpretación debe considerar recencia.

---

# 48. El agente no debe fijar estados permanentemente

Los estados cambian.

Ejemplo:

```text
AT_RISK
```

puede volver a:

```text
ACTIVE_REPEAT_BUYER
```

después de una compra.

---

# 49. El lifecycle debe ayudar a decidir

La clasificación solo tiene valor si cambia:

- objetivo;
- mensaje;
- oferta;
- timing;
- frecuencia;
- producto;
- prioridad.

Si una etiqueta no cambia ninguna decisión, puede ser innecesaria.

---

# 50. El funnel debe ayudar a decidir

También debe evitarse crear etapas decorativas.

Una etapa debe aportar contexto estratégico.

Ejemplo:

```text
cart
```

es útil porque puede cambiar radicalmente el mensaje frente a:

```text
general_browser
```

---

# 51. Lifecycle demasiado simple

Un modelo como:

```text
lead
customer
```

pierde demasiado contexto.

No distingue:

- primera compra;
- recurrencia;
- valor;
- riesgo;
- inactividad.

---

# 52. Lifecycle demasiado complejo

El extremo contrario también es un problema.

Crear decenas de estados casi idénticos puede:

- confundir;
- duplicar lógica;
- dificultar mantenimiento.

El lifecycle debe ser suficientemente preciso para tomar mejores decisiones.

---

# 53. Estado observado vs estado inferido

Ejemplo:

```text
ORDER_PLACED
```

es un hecho.

```text
HIGH_INTENT
```

es una inferencia.

El agente debe mantener esta diferencia conceptual.

---

# 54. Lifecycle y campañas

Una campaña puede segmentarse según lifecycle.

Ejemplo:

```text
new_collection
```

puede tener mensajes distintos para:

```text
prospects
repeat_buyers
VIP
```

---

# 55. Lifecycle y flows

Muchos flows corresponden a transiciones.

Ejemplos:

```text
subscription
→ welcome

purchase
→ post-purchase

expected_repurchase_window
→ replenishment

activity_decline
→ win-back
```

---

# 56. Lifecycle y personalización

Personalizar no significa solamente:

```text
Hola {first_name}
```

Puede significar adaptar:

- objetivo;
- producto;
- contenido;
- oferta;
- intensidad.

---

# 57. Preguntas que debe hacerse el agente

```text
¿Estamos hablando de funnel o lifecycle?
¿Qué relación tiene el cliente con la marca?
¿Qué conversión está considerando ahora?
¿Qué señales recientes existen?
¿Ha comprado antes?
¿Cuántas veces?
¿Existe riesgo de inactividad?
¿Está progresando o retrocediendo?
¿Qué objetivo corresponde a este momento?
¿Qué estrategia dejaría de tener sentido si cambia de estado?
```

---

# 58. Antipatrón: funnel = lifecycle

No debe tratarse:

```text
cart_abandoner
```

como lifecycle completo.

Describe una situación de intención.

---

# 59. Antipatrón: buyer como estado final

La compra abre nuevas oportunidades y necesidades.

---

# 60. Antipatrón: lifecycle basado solo en número de pedidos

Los pedidos son importantes, pero pueden necesitar combinarse con:

- recencia;
- frecuencia;
- valor;
- engagement;
- ciclo esperado.

---

# 61. Antipatrón: asumir intención por lifecycle

Un VIP puede no querer comprar ahora.

Un prospect puede estar a minutos de comprar.

---

# 62. Antipatrón: usar ventanas universales

Ejemplo:

```text
90 days without purchase = lapsed
```

puede ser razonable en una categoría y absurdo en otra.

---

# 63. Modelo mental recomendado

```text
RELATIONSHIP
→ lifecycle

CURRENT BEHAVIOR
→ events

CURRENT COMMERCIAL MOMENT
→ funnel

DERIVED PURCHASE PROXIMITY
→ intent

INTERACTION LEVEL
→ engagement
```

Estas dimensiones deben complementarse.

---

# 64. Principio maestro

El funnel explica el avance hacia una conversión.

El lifecycle explica la evolución de la relación.

La IA debe evitar comprimir ambas dimensiones en una sola etiqueta.

La interpretación correcta combina:

```text
lifecycle
+
current_funnel
+
intent
+
engagement
+
recency
+
history
```

El objetivo no es clasificar al cliente por clasificarlo.

El objetivo es comprender mejor qué relación tiene con la marca y qué siguiente acción tiene sentido.
