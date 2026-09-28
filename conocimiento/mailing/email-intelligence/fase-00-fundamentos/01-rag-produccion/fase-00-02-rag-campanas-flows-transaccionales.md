# Fase 0.2 — Campañas vs flows vs emails transaccionales

## Tipo de artefacto

`01-rag-produccion`

## Objetivo

Definir cómo debe diferenciar un agente de IA entre:

- campañas;
- flows;
- emails transaccionales.

La distinción es esencial porque cada tipo de comunicación responde a una lógica diferente de activación, audiencia, timing, prioridad, objetivo y medición.

El agente debe comprender primero qué tipo de comunicación está tratando antes de recomendar estrategia, copy, diseño u oferta.

---

# 1. Campaña

Una campaña es una comunicación iniciada de forma deliberada por la marca y enviada a una audiencia definida en un momento concreto.

Normalmente responde a una decisión:

- comercial;
- promocional;
- editorial;
- de producto;
- de marca;
- estacional.

Ejemplos:

- lanzamiento de producto;
- promoción de fin de semana;
- Black Friday;
- newsletter;
- restock;
- campaña educativa;
- campaña VIP;
- campaña de contenido.

La lógica principal es:

```text
la marca tiene algo relevante que comunicar
→ selecciona audiencia
→ decide momento
→ envía campaña
```

---

# 2. Flow

Un flow es una secuencia automatizada activada por:

- un evento;
- un comportamiento;
- una condición;
- un cambio de estado;
- una combinación de señales.

Ejemplos:

- welcome;
- browse abandonment;
- cart abandonment;
- checkout abandonment;
- post-purchase;
- replenishment;
- win-back.

La lógica principal es:

```text
algo ocurre con una persona
→ se evalúa si corresponde actuar
→ comienza una secuencia
```

Un flow no debe entenderse simplemente como una serie fija de emails.

Puede incluir:

- condiciones;
- ramas;
- delays;
- salidas;
- exclusiones;
- prioridades.

---

# 3. Email transaccional

Un email transaccional existe principalmente para comunicar información necesaria relacionada con una acción, operación o servicio.

Ejemplos:

- confirmación de pedido;
- confirmación de pago;
- envío realizado;
- tracking;
- devolución;
- cambio de contraseña;
- verificación de cuenta.

Su función principal es:

```text
informar
confirmar
facilitar una operación
```

No debe diseñarse principalmente como una pieza promocional.

---

# 4. Diferencia principal

La diferencia fundamental está en qué provoca la comunicación.

## Campaña

La marca decide comunicar algo.

```text
brand_decision
→ campaign
```

## Flow

El comportamiento o estado del cliente activa una lógica.

```text
customer_event_or_state
→ flow
```

## Transaccional

Una operación necesita una comunicación funcional.

```text
transaction_or_service_event
→ transactional_message
```

---

# 5. Campañas: cuándo suelen tener sentido

Las campañas suelen ser adecuadas cuando existe:

- una novedad;
- una promoción;
- una razón editorial;
- una necesidad comercial;
- una fecha relevante;
- un lanzamiento;
- una oportunidad de segmentación.

La pregunta típica es:

> ¿Qué queremos comunicar ahora a este grupo de personas?

---

# 6. Flows: cuándo suelen tener sentido

Los flows suelen ser adecuados cuando existe:

- comportamiento repetible;
- trigger claro;
- necesidad de respuesta automática;
- contexto individual;
- ventana temporal relevante.

La pregunta típica es:

> Ha ocurrido esto con este cliente. ¿Qué debería pasar ahora?

---

# 7. Transaccionales: cuándo tienen sentido

Los emails transaccionales tienen sentido cuando el usuario necesita información para:

- confirmar;
- continuar;
- comprender;
- resolver;
- verificar;

una acción relacionada con su cuenta, pedido o servicio.

La pregunta típica es:

> ¿Qué información necesita recibir esta persona para completar correctamente esta operación?

---

# 8. Campaña no significa envío masivo

Una campaña puede dirigirse a:

- toda la base elegible;
- un segmento;
- una cohorte;
- clientes VIP;
- compradores de una categoría;
- prospects de alta intención.

El hecho de ser campaña no implica:

```text
send_to_everyone
```

---

# 9. Flow no significa automatizar todo

No todo comportamiento merece una automatización.

Un flow solo tiene sentido cuando existe:

- señal suficientemente relevante;
- lógica repetible;
- objetivo claro;
- contexto suficiente.

La automatización no debe utilizarse simplemente porque la plataforma lo permite.

---

# 10. Transaccional no significa “sin diseño”

Un email transaccional puede tener:

- buena jerarquía;
- identidad visual;
- claridad;
- tono de marca.

Pero la función operativa debe seguir siendo prioritaria.

El diseño nunca debe ocultar:

- estado del pedido;
- importe;
- tracking;
- instrucciones;
- información crítica.

---

# 11. Campañas y flows son complementarios

No deben tratarse como alternativas excluyentes.

Un ecommerce puede utilizar:

```text
campaigns
+
flows
+
transactional_messages
```

de forma coordinada.

El problema no es que coexistan.

El problema aparece cuando compiten sin control.

---

# 12. Conflicto campaña vs flow

Ejemplo:

Una persona:

```text
ADD_TO_CART
```

y entra en un cart flow.

Dos horas después existe una campaña general con descuento.

Enviar ambos mensajes sin coordinación puede:

- aumentar presión;
- regalar incentivo innecesario;
- crear incoherencia;
- dificultar atribución.

El agente debe reconocer el conflicto.

---

# 13. Conflicto flow vs flow

Ejemplo:

```text
browse_abandonment
```

seguido por:

```text
add_to_cart
```

La segunda señal muestra una intención más avanzada.

El flow anterior puede perder prioridad.

---

# 14. Conflicto con transaccionales

Los mensajes operativos suelen tener prioridad funcional.

Ejemplo:

```text
shipping_delay
```

puede ser más importante para el cliente que:

```text
new_collection_campaign
```

La urgencia comercial no debe imponerse sobre una necesidad operativa.

---

# 15. Progresión de intención

Puede existir una progresión conceptual como:

```text
browse
→ product view
→ cart
→ checkout
→ purchase
```

Cuando una persona avanza, comunicaciones basadas en estados anteriores pueden dejar de ser relevantes.

---

# 16. Campaña con comportamiento individual

Una campaña puede utilizar comportamiento para definir audiencia.

Ejemplo:

```text
campaign:
new_running_collection

audience:
customers_with_running_affinity
```

Sigue siendo campaña porque la comunicación nace de una decisión de la marca, no de un trigger individual inmediato.

---

# 17. Flow con contenido comercial

Un flow puede incluir:

- producto;
- oferta;
- cross-sell;
- promoción.

Eso no lo convierte en campaña.

La clasificación depende de la lógica de activación.

---

# 18. Email transaccional con contenido de marca

Un email de pedido puede incluir:

- educación;
- soporte;
- recomendaciones útiles;
- branding.

Pero su objetivo principal sigue siendo transaccional.

La función principal determina la clasificación.

---

# 19. Campaña recurrente no equivale a flow

Ejemplo:

```text
newsletter_every_Friday
```

sigue siendo una campaña recurrente si no está activada por un evento individual.

La repetición temporal no convierte automáticamente una campaña en flow.

---

# 20. Flow de calendario

Algunos flows pueden incluir lógica temporal.

Ejemplo:

```text
birthday
anniversary
replenishment_window
```

Aunque haya una fecha involucrada, la activación sigue siendo individual.

---

# 21. Una campaña puede convertirse en flow

Una acción inicialmente manual puede automatizarse cuando:

- se repite;
- existe un trigger fiable;
- depende del individuo;
- el timing puede definirse.

Ejemplo:

Una campaña manual de reposición puede evolucionar hacia un replenishment flow.

---

# 22. Un flow puede requerir revisión humana

Automático no significa completamente autónomo.

Puede haber flows donde:

- la oferta sea sensible;
- el riesgo comercial sea alto;
- el contexto sea ambiguo.

En esos casos puede ser necesaria revisión o guardrails adicionales.

---

# 23. Diferencias de audiencia

## Campaña

Parte de una audiencia o segmento.

```text
segment
→ campaign audience
```

## Flow

Parte de individuos que cumplen trigger y condiciones.

```text
event/state
→ eligible individual
```

## Transaccional

Parte de una operación concreta.

```text
transaction
→ affected user
```

---

# 24. Diferencias de timing

## Campaña

Suele tener:

- fecha;
- ventana;
- calendario.

## Flow

Suele depender de:

- trigger;
- delay;
- evolución del comportamiento.

## Transaccional

Suele requerir:

- inmediatez;
- sincronización con la operación.

---

# 25. Diferencias de objetivo

## Campaña

Frecuentemente:

- conversión;
- lanzamiento;
- promoción;
- educación;
- marca.

## Flow

Frecuentemente:

- activación;
- recuperación;
- lifecycle;
- retención;
- postcompra.

## Transaccional

Principalmente:

- informar;
- confirmar;
- facilitar una operación.

---

# 26. Diferencias de personalización

## Campaña

Puede utilizar segmentación y contenido dinámico.

## Flow

Suele disponer de mayor contexto individual porque nace de un evento o estado.

## Transaccional

Utiliza principalmente información de la operación concreta.

---

# 27. Diferencias de duración

## Campaña

Tiene una vida limitada.

## Flow

Puede mantenerse activo de forma continua.

## Transaccional

Existe cada vez que ocurre la operación correspondiente.

---

# 28. Diferencias de mantenimiento

Las campañas requieren:

- planificación;
- calendario;
- producción continua.

Los flows requieren:

- diseño inicial;
- mantenimiento;
- auditoría periódica;
- actualización.

Los transaccionales requieren:

- fiabilidad;
- consistencia;
- exactitud;
- mantenimiento técnico.

---

# 29. Diferencias de medición

Una campaña y un flow no deben evaluarse exactamente igual.

En campañas puede analizarse:

- rendimiento por envío;
- audiencia;
- oferta;
- campaña.

En flows puede analizarse además:

- entrada;
- paso;
- secuencia;
- ramas;
- progresión;
- conversión total del flow.

Los transaccionales priorizan más:

- entrega;
- precisión;
- funcionalidad;
- incidencias.

---

# 30. Errores frecuentes en campañas

El agente debe detectar prácticas como:

- enviar porque “toca”;
- enviar a toda la lista;
- repetir promociones;
- ignorar compras recientes;
- ignorar flows activos;
- priorizar calendario sobre relevancia.

---

# 31. Errores frecuentes en flows

Debe detectar:

- automatizar señales demasiado débiles;
- no definir salidas;
- no detener tras compra;
- usar descuentos por defecto;
- mantener secuencias obsoletas;
- ignorar otros flows;
- asumir que una secuencia fija sirve para todos.

---

# 32. Errores frecuentes en transaccionales

Debe detectar:

- ocultar información importante;
- priorizar venta sobre operación;
- utilizar lenguaje ambiguo;
- enviar datos incorrectos;
- mezclar excesivamente promoción y servicio.

---

# 33. La clasificación debe preceder al copy

Antes de escribir, el agente debe saber:

```text
communication_type
```

Porque cambia:

- intención;
- estructura;
- tono;
- CTA;
- timing;
- medición.

---

# 34. Modelo conceptual

El agente debería pensar:

```text
¿La comunicación nace de una decisión de la marca?
→ CAMPAIGN

¿Nace de un evento o estado individual?
→ FLOW

¿Nace de una operación que requiere información?
→ TRANSACTIONAL
```

Cuando exista ambigüedad, debe analizar el objetivo principal y la lógica de activación.

---

# 35. Un mismo tema puede existir en los tres tipos

Ejemplo: envío.

## Campaña

```text
Free shipping this weekend
```

## Flow

```text
Cart abandonment with shipping objection
```

## Transaccional

```text
Your order has shipped
```

El tema no determina la clasificación.

La lógica sí.

---

# 36. Coordinación global

El cliente no percibe:

```text
campaign_system
flow_system
transactional_system
```

Percibe una única marca.

Por tanto, las tres capas deben mantener:

- coherencia;
- frecuencia razonable;
- tono;
- contexto;
- prioridad.

---

# 37. Regla conceptual de prioridad

Como principio general:

```text
operational_need
>
high_relevance_individual_context
>
general_commercial_communication
```

Esto no debe interpretarse como una regla técnica universal, sino como criterio estratégico.

---

# 38. Preguntas que debe hacerse el agente

Antes de clasificar:

```text
¿Qué provoca esta comunicación?
¿Quién decide que se envía?
¿Existe un evento individual?
¿Existe una operación?
¿Es repetible?
¿Depende del estado del cliente?
¿Existe una audiencia planificada?
¿Cuál es el objetivo principal?
```

---

# 39. Antipatrón: campaign-first thinking

No debe pensarse:

```text
tenemos que hacer una campaña
→ busquemos una razón
```

Debe pensarse:

```text
existe una oportunidad o necesidad
→ decidamos si requiere campaña, flow o ninguna comunicación
```

---

# 40. Antipatrón: flow-first thinking

No todo evento necesita flow.

Ejemplo:

```text
PAGE_VIEWED
```

no debe convertirse automáticamente en automatización.

---

# 41. Antipatrón: todo email comercial = campaña

Un cart abandonment puede tener un objetivo comercial fuerte y seguir siendo flow.

La función comercial no determina la categoría.

---

# 42. Antipatrón: todo email automático = transaccional

Un email automático de welcome o win-back sigue siendo marketing.

Automatización no significa transaccional.

---

# 43. Antipatrón: tratar sistemas por separado

Diseñar campañas sin conocer flows activos produce conflictos.

Diseñar flows sin conocer calendario comercial también.

El agente debe razonar sobre el sistema completo.

---

# 44. Qué debe saber el agente antes de recomendar

Idealmente:

```text
objective
trigger_or_reason
audience
customer_state
timing
existing_flows
existing_campaigns
operational_context
```

---

# 45. Principio maestro

Campañas, flows y emails transaccionales no son simplemente tres tipos de plantilla.

Son tres mecanismos diferentes de comunicación.

La distinción correcta depende principalmente de:

```text
qué provoca el mensaje
+
para qué existe
+
a quién afecta
+
cuándo debe ocurrir
```

El agente debe clasificar primero la naturaleza de la comunicación y diseñar después la estrategia.
