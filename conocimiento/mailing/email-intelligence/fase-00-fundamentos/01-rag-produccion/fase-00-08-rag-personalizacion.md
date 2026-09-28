# Fase 0.8 — Personalización

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe entender un agente la personalización en email marketing ecommerce.

Personalizar no significa únicamente insertar el nombre del destinatario.

La personalización consiste en adaptar una comunicación a contexto relevante.

Puede afectar:

- objetivo;
- producto;
- contenido;
- oferta;
- timing;
- frecuencia;
- CTA;
- diseño.

---

# 1. Personalización superficial

Ejemplo:

```text
Hola, Marta
```

Es una personalización de contenido, pero aporta poco contexto estratégico.

---

# 2. Personalización estratégica

Ejemplo:

```text
recent_purchase
+
complementary_product
+
appropriate_timing
```

Puede cambiar completamente la utilidad del mensaje.

---

# 3. Personalización por lifecycle

Un prospect y un repeat buyer no deberían recibir necesariamente el mismo enfoque.

---

# 4. Personalización por intención

La proximidad a compra puede modificar:

- agresividad comercial;
- tipo de prueba;
- CTA;
- timing.

---

# 5. Personalización por producto

Puede utilizar:

- producto visto;
- producto comprado;
- wishlist;
- carrito.

Debe evitar perseguir al usuario con señales débiles.

---

# 6. Personalización por categoría

Es útil cuando existe interés claro pero no un producto dominante.

---

# 7. Personalización por comportamiento

Puede considerar:

```text
browse
click
cart
checkout
purchase
```

La calidad depende de recencia y fuerza de la señal.

---

# 8. Personalización por compra

Después de comprar puede adaptarse según:

- producto;
- cantidad;
- categoría;
- primera o repetida compra.

---

# 9. Personalización por frecuencia de compra

Puede ayudar a estimar:

- replenishment;
- timing;
- riesgo de churn.

---

# 10. Personalización por afinidad

La afinidad debe tratarse como inferencia cuando procede de comportamiento.

No debe inventarse.

---

# 11. Personalización por idioma

Debe utilizarse cuando exista información fiable sobre idioma o mercado.

---

# 12. Personalización geográfica

Puede adaptar:

- disponibilidad;
- envío;
- moneda;
- temporada;
- mercado.

---

# 13. Personalización por oferta

No todos los clientes deben recibir el mismo incentivo.

Puede depender de:

- margen;
- historial;
- valor;
- intención;
- comportamiento promocional.

---

# 14. Personalización por timing

El momento puede ser más importante que cambiar una palabra.

Ejemplo:

```text
replenishment when need is likely
```

---

# 15. Personalización por frecuencia

Algunos usuarios pueden tolerar o necesitar distinta intensidad.

Debe respetarse la presión global.

---

# 16. Personalización por engagement

Puede modificar:

- frecuencia;
- profundidad;
- tipo de contenido.

---

# 17. Personalización por valor

Un cliente valioso puede recibir:

- reconocimiento;
- acceso;
- servicio;
- prioridad.

No implica necesariamente descuento.

---

# 18. Personalización por preferencias declaradas

Los datos declarados son especialmente útiles cuando siguen siendo actuales.

---

# 19. Datos observados vs inferidos

Ejemplo observado:

```text
bought_product_X
```

Ejemplo inferido:

```text
likes_category_X
```

El agente debe distinguirlos.

---

# 20. Confianza de la personalización

Cuanto más débil sea la evidencia, más prudente debe ser el mensaje.

---

# 21. Personalización invasiva

No todo dato disponible debe exponerse.

Ejemplo poco recomendable:

> Has visto este producto siete veces desde tu móvil.

Puede resultar incómodo.

---

# 22. Personalización invisible

Muchas de las mejores personalizaciones no necesitan decir al usuario que lo son.

Ejemplo:

- elegir producto correcto;
- no enviar;
- ajustar timing;
- cambiar oferta.

---

# 23. Personalización incorrecta

Una mala personalización puede perjudicar más que un email genérico.

Ejemplos:

- nombre incorrecto;
- producto ya comprado;
- talla incompatible;
- oferta no válida.

---

# 24. Fallbacks

Si falta información, debe existir una versión segura y natural del mensaje.

La IA no debe inventar datos.

---

# 25. Personalización y privacidad

La personalización debe respetar expectativas razonables y políticas aplicables.

La disponibilidad técnica de un dato no implica que sea apropiado utilizarlo en copy.

---

# 26. Personalización y escala

No toda personalización debe ser individual.

Puede existir:

```text
segment-level personalization
```

que resulte suficiente y más robusta.

---

# 27. Personalización y creatividad

Puede adaptar:

- hero;
- productos;
- reviews;
- benefits;
- CTA.

---

# 28. Personalización y recomendaciones

Una recomendación debe responder a relevancia, no simplemente a disponibilidad de inventario.

---

# 29. Personalización y aprendizaje

Los resultados pueden revelar qué tipos de adaptación funcionan para determinados contextos.

No deben universalizarse sin evidencia.

---

# 30. Antipatrón: nombre = personalización

El nombre es solo una pequeña parte.

---

# 31. Antipatrón: hiperpersonalización sin necesidad

Más datos no siempre producen mejor experiencia.

---

# 32. Antipatrón: personalizar con información antigua

Los intereses evolucionan.

---

# 33. Antipatrón: personalización sin fallback

Los datos pueden faltar o estar corruptos.

---

# 34. Antipatrón: asumir preferencias

La IA debe decir:

```text
likely_affinity
```

cuando se trata de una inferencia.

---

# 35. Preguntas que debe hacerse el agente

```text
¿Qué información conocemos realmente?
¿Qué parte es inferida?
¿Esta adaptación cambia la relevancia?
¿Puede resultar invasiva?
¿Está actualizada?
¿Qué ocurre si falta el dato?
¿La personalización ayuda al objetivo?
```

---

# 36. Principio maestro

La mejor personalización no es la que utiliza más datos.

Es la que utiliza el contexto correcto para mejorar una decisión.

```text
personalization
=
relevant_context
→ better_message_or_action
```
