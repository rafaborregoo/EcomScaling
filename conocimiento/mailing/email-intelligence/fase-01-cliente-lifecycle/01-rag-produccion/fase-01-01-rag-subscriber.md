# Fase 1.1 — Subscriber

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA el concepto de `SUBSCRIBER` dentro de un ecommerce.

Un subscriber es una persona vinculada al canal de email bajo las condiciones aplicables.

Ser subscriber no implica automáticamente:

- ser comprador;
- tener intención alta;
- estar activamente interesado en un producto;
- tener engagement alto;
- pertenecer a un segmento valioso;
- necesitar una promoción;
- estar preparado para comprar.

El agente debe tratar la suscripción como una dimensión de la relación con el canal, no como una descripción completa del cliente.

---

# 1. Qué es un subscriber

Un subscriber es una persona cuya identidad de email es conocida y que forma parte de la audiencia potencial del canal bajo las condiciones correspondientes.

Puede haberse incorporado mediante:

- formulario;
- popup;
- newsletter;
- lead magnet;
- registro;
- checkout;
- creación de cuenta;
- campaña;
- referral;
- evento promocional.

La fuente de alta puede aportar contexto sobre su expectativa inicial.

---

# 2. Subscriber no es buyer

Debe mantenerse esta separación:

```text
subscriber
≠
buyer
```

Una persona puede estar suscrita y no haber comprado nunca.

También puede existir:

```text
buyer
≠
active_marketing_subscriber
```

Un comprador no necesariamente debe recibir marketing por email.

---

# 3. Subscriber no es prospect de alta intención

La suscripción demuestra una relación con el canal.

No demuestra necesariamente:

```text
HIGH_INTENT
```

Las motivaciones de alta pueden ser muy diferentes:

- interés por la marca;
- descuento;
- contenido;
- sorteo;
- curiosidad;
- intención de compra;
- acceso anticipado.

El comportamiento posterior suele aportar más información.

---

# 4. Subscriber como dimensión independiente

Un subscriber puede ser simultáneamente:

```text
PROSPECT
```

o:

```text
FIRST_TIME_BUYER
```

o:

```text
REPEAT_BUYER
```

La suscripción no sustituye al lifecycle.

---

# 5. Fuente de adquisición

La procedencia puede influir en la interpretación inicial.

Ejemplos:

```text
POPUP
CHECKOUT
LEAD_MAGNET
GIVEAWAY
ORGANIC_FORM
REFERRAL
PAID_ACQUISITION
ACCOUNT_REGISTRATION
```

La fuente no determina por sí sola la calidad del subscriber.

---

# 6. Subscriber procedente de popup

Puede haberse registrado por:

- incentivo;
- interés;
- curiosidad;
- contenido.

Debe observarse su comportamiento posterior antes de sacar conclusiones fuertes.

---

# 7. Subscriber procedente de checkout

Puede existir una señal comercial más fuerte porque la persona estaba cerca de comprar.

Aun así, debe comprobarse si la compra llegó a producirse.

---

# 8. Subscriber procedente de lead magnet

Puede tener principalmente interés educativo.

Ejemplos:

- guía;
- checklist;
- quiz;
- recurso;
- contenido especializado.

La estrategia inicial puede requerir educación antes de venta.

---

# 9. Subscriber procedente de giveaway

Los sorteos pueden captar personas motivadas principalmente por el premio.

Esto no significa que sean malos contactos.

Significa que su intención comercial debe demostrarse mediante comportamiento posterior.

---

# 10. Subscriber procedente de compra

Un cliente puede aceptar o activar relación por email durante o después de comprar.

En ese caso no debe recibir necesariamente una bienvenida diseñada para un prospect sin historial.

---

# 11. New Subscriber

Un nuevo subscriber tiene poco historial.

El agente debe evitar asumir demasiado sobre:

- intención;
- afinidad;
- valor;
- sensibilidad al descuento.

La estrategia inicial debería ayudar a aprender y construir relación.

---

# 12. Engaged Subscriber

Un subscriber engaged mantiene señales útiles de interacción.

Puede incluir:

- clicks;
- visitas;
- compras;
- respuestas;
- navegación reciente.

Engagement debe interpretarse utilizando varias señales cuando sea posible.

---

# 13. Cooling Subscriber

Un subscriber puede mostrar una disminución progresiva de actividad.

Ejemplo:

```text
frequent_clicks
→ occasional_clicks
→ no_recent_interaction
```

Esto puede indicar enfriamiento, pero no debe asumirse automáticamente que la relación está perdida.

---

# 14. Disengaged Subscriber

Un subscriber puede considerarse desengaged cuando lleva un periodo significativo sin señales útiles.

El periodo relevante depende de:

- categoría;
- frecuencia histórica;
- ciclo de compra;
- comportamiento previo.

No existe una ventana universal.

---

# 15. Reactivated Subscriber

Una persona previamente desengaged puede volver a mostrar actividad.

Ejemplos:

```text
EMAIL_CLICKED
SITE_VISITED
PRODUCT_VIEWED
ADD_TO_CART
ORDER_PLACED
```

La fuerza de la reactivación depende de la señal.

---

# 16. Subscriber y engagement

Debe mantenerse:

```text
subscription_state
≠
engagement_state
```

Una persona puede seguir suscrita aunque ya no interactúe.

---

# 17. Subscriber e intención

También:

```text
subscription_state
≠
intent_state
```

Puede existir:

```text
subscriber + low_intent
```

y:

```text
subscriber + high_intent
```

---

# 18. Subscriber y lifecycle

Ejemplos válidos:

```text
subscriber + prospect
subscriber + first_time_buyer
subscriber + repeat_buyer
subscriber + VIP
subscriber + lapsed_customer
```

La condición subscriber no explica por sí sola la relación comercial.

---

# 19. Subscriber y afinidad

La afinidad puede surgir posteriormente a través de:

- navegación;
- compras;
- clicks;
- búsquedas;
- preferencias declaradas.

Si no existe evidencia suficiente:

```text
affinity = UNKNOWN
```

---

# 20. Subscriber y personalización

La personalización inicial debe ser proporcional a la información disponible.

Puede utilizar:

- idioma;
- fuente de alta;
- preferencias declaradas;
- comportamiento reciente;
- historial de compra.

No debe inventarse información que todavía no existe.

---

# 21. Subscriber y welcome

La suscripción puede justificar una estrategia de bienvenida.

Pero la bienvenida debería considerar:

- si ya era cliente;
- de dónde llegó;
- qué esperaba recibir;
- si existe historial;
- si hubo una oferta de captación.

No todos los nuevos subscribers son iguales.

---

# 22. Welcome para prospect

Puede centrarse en:

- marca;
- propuesta de valor;
- productos;
- confianza;
- educación.

---

# 23. Welcome para comprador existente

Puede centrarse más en:

- relación;
- ventajas del canal;
- contenido;
- preferencias;
- próximos pasos.

No debería fingir que la marca no conoce al cliente.

---

# 24. Subscriber y campañas

Ser subscriber no significa que deba recibir todas las campañas.

Una campaña debe considerar:

- objetivo;
- relevancia;
- lifecycle;
- afinidad;
- engagement;
- presión.

---

# 25. Subscriber y descuentos

No debe utilizarse:

```text
subscriber
→ automatic_discount
```

como regla conceptual.

El descuento es una táctica.

---

# 26. Subscriber y frecuencia

La frecuencia no debe decidirse únicamente por estar suscrito.

Puede variar según:

- engagement;
- intención;
- lifecycle;
- presión;
- estrategia.

---

# 27. Subscriber y preferencias

Cuando el usuario declara preferencias, estas pueden mejorar relevancia.

Ejemplos:

- categorías;
- idioma;
- tipo de contenido;
- frecuencia deseada.

Las preferencias pueden cambiar con el tiempo.

---

# 28. Subscriber y comportamiento posterior

La calidad comercial de un subscriber se entiende mejor observando qué ocurre después del alta.

Ejemplos:

```text
signup
→ product_view
→ cart
```

o:

```text
signup
→ no_activity
```

Son situaciones distintas.

---

# 29. Subscriber y primera compra

La primera compra representa una transición importante.

```text
PROSPECT
→ FIRST_TIME_BUYER
```

La persona puede seguir siendo subscriber, pero su estrategia cambia.

---

# 30. Subscriber y segunda compra

La segunda compra puede indicar una relación más consolidada.

La suscripción deja de ser la característica más importante del contexto.

---

# 31. Subscriber y valor

El valor económico no debe inferirse por estar suscrito.

Puede haber:

```text
high_engagement
+
zero_purchases
```

o:

```text
low_email_engagement
+
high_customer_value
```

---

# 32. Subscriber y sensibilidad promocional

Haber entrado mediante descuento no demuestra necesariamente sensibilidad permanente a promociones.

Debe observarse:

- compras a precio completo;
- respuesta a distintas ofertas;
- comportamiento posterior.

---

# 33. Subscriber y contenido

El contenido puede ayudar a:

- educar;
- generar confianza;
- descubrir afinidad;
- activar interés;
- construir marca.

La venta inmediata no es el único objetivo posible.

---

# 34. Subscriber y prueba social

En fases tempranas puede ayudar a reducir incertidumbre mediante:

- reviews;
- UGC;
- testimonios;
- ejemplos de uso.

Debe ser relevante al contexto.

---

# 35. Subscriber y adquisición

El canal de adquisición puede modificar las expectativas.

Ejemplo:

Una persona que se registró para contenido puede esperar una relación distinta a una persona que pidió un cupón.

---

# 36. Subscriber y cohortes

Puede resultar útil analizar grupos por:

- fecha de alta;
- fuente;
- oferta de captación;
- campaña de adquisición.

Esto permite comparar calidad y evolución.

---

# 37. Subscriber y recencia

El tiempo desde la suscripción aporta contexto.

Ejemplo:

```text
subscribed_today
```

es diferente de:

```text
subscribed_2_years_ago
```

aunque ambas personas sigan en la lista.

---

# 38. Subscriber y señales posteriores

Las señales posteriores deben ir reemplazando gradualmente las suposiciones basadas en adquisición.

El comportamiento real tiene más valor que una etiqueta inicial.

---

# 39. Subscriber y baja interacción

La ausencia de interacción no debe responderse automáticamente con más frecuencia.

Puede requerir:

- cambio de contenido;
- reducción;
- re-engagement;
- silencio.

---

# 40. Subscriber y re-engagement

Una estrategia de re-engagement debe buscar comprobar si la relación sigue teniendo valor.

No simplemente generar otro impacto promocional.

---

# 41. Subscriber y sunset

Un contacto persistentemente desengaged puede dejar de justificar comunicación frecuente.

Sunset protege:

- atención;
- calidad de lista;
- entregabilidad;
- experiencia.

---

# 42. Subscriber y calidad de lista

El tamaño bruto de subscribers no es equivalente a calidad.

Una lista puede contener:

- activos;
- compradores;
- prospects;
- inactivos;
- contactos antiguos;
- personas con poco interés.

---

# 43. Métricas de calidad

La calidad puede observarse mediante evolución de:

- engagement;
- visitas;
- compras;
- retención;
- bajas;
- reactivación.

No existe una única métrica suficiente.

---

# 44. Subscriber y email opens

Las aperturas pueden aportar información limitada.

No deben utilizarse como única señal para clasificar engagement o interés.

---

# 45. Subscriber y clicks

Los clicks suelen aportar más contexto cuando se sabe:

- qué elemento se pulsó;
- a qué producto llevaba;
- qué contenido representaba.

---

# 46. Subscriber y compras

La compra es una señal comercial más fuerte que muchas interacciones superficiales.

Pero una compra tampoco describe por sí sola la relación futura.

---

# 47. Subscriber y soporte

Un subscriber puede tener simultáneamente un problema operativo.

Ejemplo:

```text
subscriber
+
support_issue_open
```

La situación operativa puede modificar la prioridad de comunicaciones comerciales.

---

# 48. Subscriber y expectativas

La marca debe intentar mantener coherencia entre:

```text
what_was_promised_at_signup
```

y:

```text
what_is_sent_after_signup
```

Romper esa expectativa puede deteriorar confianza.

---

# 49. Subscriber y relevancia

La pregunta no debe ser:

> ¿Podemos enviarle un email porque está en la lista?

Debe ser:

> ¿Existe ahora una comunicación relevante para esta persona?

---

# 50. Antipatrón: todos los subscribers son iguales

Una base de email puede contener clientes en etapas muy diferentes.

---

# 51. Antipatrón: subscriber = lead caliente

La suscripción por sí sola no demuestra intención alta.

---

# 52. Antipatrón: subscriber = descuento

No todos necesitan un incentivo.

---

# 53. Antipatrón: welcome idéntico

Debe considerarse el contexto previo.

---

# 54. Antipatrón: medir éxito por tamaño de lista

Una lista grande con baja calidad puede aportar menos valor que una lista menor y relevante.

---

# 55. Antipatrón: mantener siempre la misma frecuencia

El engagement y la relación evolucionan.

---

# 56. Antipatrón: asumir afinidad por origen

La fuente aporta una hipótesis inicial, no una verdad permanente.

---

# 57. Preguntas que debe hacerse el agente

Al analizar un subscriber:

```text
¿Cómo llegó?
¿Cuándo se suscribió?
¿Ha comprado?
¿Qué lifecycle tiene?
¿Qué comportamiento posterior existe?
¿Qué engagement muestra?
¿Qué intención muestra?
¿Conocemos afinidades?
¿Qué esperaba recibir?
¿Qué presión ha recibido?
¿Qué objetivo tiene sentido ahora?
```

---

# 58. Modelo mental recomendado

```text
SUBSCRIBER
+
LIFECYCLE
+
ENGAGEMENT
+
INTENT
+
BEHAVIOR
+
AFFINITY
+
RECENCY
+
CONTEXT
```

La etiqueta `SUBSCRIBER` es solo una pieza.

---

# 59. Principio maestro

Ser subscriber significa existir dentro de la relación del canal de email.

No significa automáticamente estar preparado para comprar.

La IA debe dejar de pensar:

```text
subscriber
→ send
```

y pensar:

```text
subscriber
+
context
→ determine_relevance
```

La pregunta correcta es:

> ¿Qué sabemos realmente de esta persona además de que está suscrita?
