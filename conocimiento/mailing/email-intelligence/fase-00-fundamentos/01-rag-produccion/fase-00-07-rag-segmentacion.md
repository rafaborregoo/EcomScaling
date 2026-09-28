# Fase 0.7 — Segmentación

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente la segmentación en email marketing ecommerce.

Segmentar significa agrupar personas mediante criterios relevantes para cambiar una decisión de marketing.

Una segmentación útil debe permitir mejorar:

- relevancia;
- mensaje;
- producto;
- oferta;
- timing;
- frecuencia;
- análisis.

---

# 1. Segmentación no es simplemente dividir una lista

Crear grupos no aporta valor si todos reciben exactamente la misma estrategia.

Un segmento debería existir porque permite tomar una decisión diferente.

---

# 2. Segmento vs audiencia

Un segmento es un grupo definido por criterios.

Una audiencia es el conjunto final considerado para una comunicación concreta.

```text
SEGMENT
→ filtros adicionales
→ exclusiones
→ audiencia final
```

---

# 3. Segmentación por lifecycle

Ejemplos:

```text
PROSPECTS
FIRST_TIME_BUYERS
REPEAT_BUYERS
VIP
AT_RISK
LAPSED
```

Permite adaptar estrategia a la relación con la marca.

---

# 4. Segmentación por intención

Ejemplos:

```text
LOW_INTENT
MEDIUM_INTENT
HIGH_INTENT
```

Puede modificar objetivo y presión.

---

# 5. Segmentación por engagement

Ejemplos:

```text
ENGAGED
COOLING
DISENGAGED
```

Puede modificar frecuencia y contenido.

---

# 6. Segmentación por comportamiento

Ejemplos:

```text
viewed_product_X
added_to_cart
started_checkout
searched_category_Y
```

Debe considerar recencia.

---

# 7. Segmentación por compra

Ejemplos:

```text
bought_product_X
bought_category_Y
orders_count >= 2
```

Puede ayudar a postcompra, cross-sell y retención.

---

# 8. Segmentación por recencia

Puede distinguir:

- actividad reciente;
- actividad antigua;
- compra reciente;
- inactividad.

La ventana debe ser contextual.

---

# 9. Segmentación por frecuencia

Puede analizar:

- frecuencia de compra;
- frecuencia de interacción;
- frecuencia de visitas.

No debe confundirse con presión de contacto.

---

# 10. Segmentación por valor

Puede considerar:

- revenue;
- margen;
- frecuencia;
- valor acumulado.

El valor debe adaptarse a la economía de la tienda.

---

# 11. RFM

La segmentación RFM combina:

```text
Recency
Frequency
Monetary Value
```

Es útil para comprender patrones de valor y relación.

No debe utilizarse como única segmentación posible.

---

# 12. Afinidad

Puede segmentarse por:

```text
product_affinity
category_affinity
collection_affinity
```

La afinidad puede proceder de compras o comportamiento.

---

# 13. Sensibilidad promocional

Puede observarse si una persona:

- compra principalmente con descuento;
- responde a promociones;
- compra también a precio completo.

Debe evitarse etiquetar con poca evidencia.

---

# 14. Segmentación declarada

Los datos declarados pueden incluir:

- preferencias;
- talla;
- intereses;
- idioma.

Pueden ser muy útiles cuando están actualizados.

---

# 15. Segmentación geográfica

Puede utilizar:

- país;
- región;
- mercado.

Es relevante cuando cambian:

- catálogo;
- envío;
- moneda;
- legislación;
- idioma.

---

# 16. Segmentación temporal

Puede considerar:

- antigüedad;
- fecha de alta;
- cohortes;
- tiempo desde compra.

---

# 17. Cohortes

Una cohorte agrupa personas que comparten un momento o condición de origen.

Ejemplo:

```text
customers_acquired_in_January
```

Es especialmente útil para análisis comparativo.

---

# 18. Segmentación dinámica

Los usuarios pueden entrar y salir de un segmento a medida que cambian sus datos.

Esto resulta especialmente importante en:

- intención;
- engagement;
- riesgo;
- lifecycle.

---

# 19. Segmentación estática

Puede ser útil en contextos puntuales.

Ejemplo:

- lista de asistentes;
- participantes;
- grupo manual.

No debe sustituir segmentos dinámicos cuando el comportamiento cambia.

---

# 20. Segmentación demasiado amplia

Ejemplo:

```text
all_subscribers
```

puede ser poco útil para mensajes específicos.

---

# 21. Segmentación demasiado estrecha

Crear cientos de grupos minúsculos puede dificultar:

- operación;
- medición;
- aprendizaje.

---

# 22. Segmentación útil

Una segmentación aporta valor si cambia al menos una de estas decisiones:

```text
send_or_not
message
product
offer
timing
frequency
creative
analysis
```

---

# 23. Segmentación y personalización

Segmentación y personalización no son iguales.

```text
segmentación = agrupar
personalización = adaptar
```

Una campaña puede personalizarse dentro de un segmento.

---

# 24. Segmentación y campañas

Una campaña debe seleccionar audiencia según el objetivo.

No debería empezar por:

> enviemos a toda la lista.

---

# 25. Segmentación y flows

Los flows también pueden utilizar segmentos para:

- entrada;
- exclusión;
- branching;
- tratamiento diferente.

---

# 26. Segmentación y exclusiones

La audiencia correcta no se define solo por quién entra.

También por quién debe quedar fuera.

---

# 27. Segmentación y experimentos

Los resultados pueden variar entre segmentos.

Un “ganador” global puede no ser ganador para todos los grupos.

---

# 28. Segmentación y tamaño de muestra

Segmentar demasiado puede reducir capacidad de aprender.

La precisión debe equilibrarse con suficiente volumen.

---

# 29. Segmentación y sesgos

El agente debe evitar asumir características no observadas o sensibles a partir de señales insuficientes.

---

# 30. Segmentación y calidad de datos

Una regla basada en datos incompletos produce audiencias incorrectas.

Debe considerarse:

- freshness;
- consistencia;
- cobertura.

---

# 31. Segmentos de intención

Ejemplo conceptual:

```text
BROWSER
PRODUCT_VIEWER
CART_PROSPECT
CHECKOUT_PROSPECT
```

Pueden representar niveles distintos de comportamiento.

---

# 32. Segmentos postcompra

Ejemplos:

```text
FIRST_TIME_BUYERS
RECENT_BUYERS
REPEAT_BUYERS
```

Ayudan a adaptar la siguiente acción.

---

# 33. Segmentos de riesgo

Ejemplos:

```text
AT_RISK
LAPSED
DISENGAGED
```

No deben definirse con ventanas universales.

---

# 34. Segmentos comerciales

Ejemplos:

```text
VIP
HIGH_VALUE
DISCOUNT_SENSITIVE
```

Deben tener criterios transparentes.

---

# 35. Antipatrón: segmentar por segmentar

Un segmento sin uso estratégico añade complejidad.

---

# 36. Antipatrón: segmentación basada en una sola señal débil

Ejemplo:

```text
visited_category_once
→ strong_affinity
```

---

# 37. Antipatrón: segmentos permanentes

La conducta y el lifecycle cambian.

---

# 38. Preguntas que debe hacerse el agente

```text
¿Qué decisión cambiará gracias a este segmento?
¿Qué criterio lo define?
¿Es observable o inferido?
¿La ventana temporal tiene sentido?
¿Es suficientemente grande para actuar o aprender?
¿Necesitamos exclusiones?
¿Debe ser dinámico?
```

---

# 39. Principio maestro

La segmentación no consiste en crear más grupos.

Consiste en crear diferencias que mejoren decisiones.

```text
useful_segment
=
meaningful_difference
+
actionable_decision
```
