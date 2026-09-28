# Fase 0.10 — Cuándo enviar

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe razonar un agente para determinar cuándo una comunicación tiene suficiente sentido estratégico para ser enviada.

No existe una hora, frecuencia o regla universal válida para todos los ecommerce.

La decisión depende de contexto.

---

# 1. Una razón válida para enviar

Debe existir al menos una oportunidad o necesidad real.

Ejemplos:

- intención;
- novedad;
- educación;
- recuperación;
- postcompra;
- reposición;
- información operativa.

---

# 2. Debe existir un objetivo

Antes del envío debe estar claro qué se pretende conseguir.

---

# 3. Debe existir una audiencia relevante

La comunicación debe tener sentido para las personas seleccionadas.

---

# 4. Debe existir actualidad

La razón para enviar debe seguir vigente.

Una señal antigua puede haber perdido valor.

---

# 5. Debe existir coherencia con el lifecycle

El mensaje debe corresponder al tipo de relación existente.

---

# 6. Debe existir coherencia con intención

El mensaje debería adaptarse a la proximidad a compra.

---

# 7. Debe existir valor para el receptor

El email debería aportar al menos una de estas cosas:

- información;
- utilidad;
- producto relevante;
- oportunidad;
- solución;
- soporte;
- inspiración.

---

# 8. Debe existir relevancia temporal

Algunos mensajes dependen fuertemente del momento.

Ejemplos:

```text
cart_recovery
shipping_update
flash_sale
```

---

# 9. Debe existir coherencia de producto

No debe promocionarse algo irrelevante o incompatible con el contexto conocido.

---

# 10. Debe existir coherencia de oferta

Si existe incentivo, debe:

- estar vigente;
- ser aplicable;
- tener sentido comercial.

---

# 11. Debe existir coherencia operativa

No tiene sentido generar demanda para:

- producto agotado;
- checkout roto;
- oferta inválida;
- logística incapaz de cumplir.

---

# 12. Debe considerarse la presión comercial

Un mensaje válido puede necesitar esperar si el usuario ya recibió demasiadas comunicaciones.

---

# 13. Debe considerarse competencia entre mensajes

Cuando existen varios mensajes posibles, puede ser mejor elegir uno.

---

# 14. Debe considerarse el estado de servicio

Una incidencia abierta puede cambiar la prioridad.

---

# 15. Eventos de alta intención

Señales como:

```text
ADD_TO_CART
CHECKOUT_STARTED
```

pueden justificar respuestas relativamente próximas.

---

# 16. Compra reciente

Puede justificar:

- reassurance;
- educación;
- seguimiento.

No necesariamente otra promoción inmediata.

---

# 17. Replenishment

Debe alinearse con el ciclo esperado de consumo.

---

# 18. Win-back

Debe considerar cuándo la ausencia empieza a ser anómala respecto al patrón normal.

---

# 19. Lanzamientos

Pueden enviarse cuando existe:

- producto;
- audiencia;
- propuesta;
- timing.

No todos los lanzamientos son relevantes para toda la base.

---

# 20. Promociones

Deben tener:

- razón;
- objetivo;
- audiencia;
- límite claro;
- viabilidad económica.

---

# 21. Contenido editorial

Puede enviarse aunque no exista intención de compra inmediata cuando aporta valor a la relación.

---

# 22. Calendario comercial

Las fechas pueden crear oportunidades.

No obligan a participar.

---

# 23. Mejor momento

El mejor momento no debe definirse exclusivamente por una “hora mágica”.

Depende de:

- contexto;
- audiencia;
- comportamiento;
- urgencia;
- mercado.

---

# 24. Comportamiento reciente

Una señal reciente puede modificar la prioridad de un mensaje planificado.

---

# 25. Ventana de relevancia

Toda comunicación contextual tiene una ventana durante la cual mantiene sentido.

---

# 26. Relevancia decreciente

Con el tiempo, muchas señales pierden valor.

---

# 27. Enviar después de una interacción

Puede tener sentido cuando la interacción demuestra interés suficiente.

No debe responderse automáticamente a cualquier click o visita.

---

# 28. Enviar después de una compra

Debe respetar:

- recepción;
- uso esperado;
- experiencia;
- siguiente necesidad.

---

# 29. Enviar después de inactividad

Debe depender del ciclo normal de la tienda.

---

# 30. Enviar tras una incidencia resuelta

Puede ser apropiado cuando la relación ha recuperado normalidad.

No debería asumirse automáticamente.

---

# 31. Enviar por aprendizaje

Una campaña experimental puede tener sentido si existe:

- hipótesis;
- audiencia;
- métrica;
- posibilidad real de aprender.

---

# 32. Antipatrón: enviar porque “hoy toca”

El calendario operativo no sustituye una razón estratégica.

---

# 33. Antipatrón: enviar porque hay un hueco

La ausencia de campaña no es un problema por sí mismo.

---

# 34. Antipatrón: copiar horarios de otras marcas

El comportamiento de otra tienda no garantiza aplicabilidad.

---

# 35. Antipatrón: retrasar siempre

Una señal de alta intención también pierde valor si se responde demasiado tarde.

---

# 36. Preguntas que debe hacerse el agente

```text
¿Por qué enviar?
¿Por qué ahora?
¿Por qué a esta audiencia?
¿Qué ha cambiado?
¿Sigue vigente la oportunidad?
¿Existe otro mensaje más importante?
¿El cliente está saturado?
¿El producto y la oferta siguen siendo válidos?
```

---

# 37. Principio maestro

Un buen momento de envío aparece cuando coinciden:

```text
relevance
+
objective
+
audience
+
timing
+
context
```

La pregunta no es únicamente “cuándo enviar”, sino “cuándo esta comunicación merece existir”.
