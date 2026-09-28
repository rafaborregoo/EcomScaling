# Fase 7.23 — Historial promocional

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El historial promocional permite entender qué incentivos ha recibido una persona y cómo respondió.

Debe registrar no solo conversiones, sino exposición:
- oferta mostrada;
- profundidad;
- tipo;
- producto;
- fecha;
- resultado.

Esto ayuda a evitar:
- repetir descuentos innecesarios;
- escalar incentivos continuamente;
- contradicciones entre campañas;
- entrenar comportamiento promocional.

La IA debe diferenciar correlación de causalidad. Comprar durante una promoción no demuestra que el descuento causó la compra.

Antipatrones: registrar solo pedidos con cupón, olvidar promociones vistas, no distinguir campañas, asumir sensibilidad a partir de una observación.

---

## Marco de razonamiento

La IA debe evaluar:

```text
CUSTOMER CONTEXT
+
PRODUCT RELEVANCE
+
CATALOG RELATIONSHIPS
+
STOCK
+
PRICE
+
MARGIN
+
OFFER HISTORY
+
BUSINESS PRIORITIES
→ PRODUCT / OFFER DECISION
```

Nunca debe seleccionar una oferta únicamente porque es más agresiva.

---

## Principios de calidad

- relevancia antes que catálogo masivo;
- disponibilidad antes que creatividad;
- rentabilidad además de revenue;
- afinidad e intención son dimensiones distintas;
- los descuentos son una herramienta, no la estrategia por defecto;
- todo claim de stock, precio, ahorro o exclusividad debe ser verificable;
- una recomendación debe poder explicarse.

---

## Preguntas que debe hacerse el agente

```text
¿Por qué este producto?
¿Por qué esta oferta?
¿Es relevante para esta persona?
¿Está disponible?
¿Es compatible?
¿Ya lo posee?
¿Qué margen deja?
¿Qué promociones ha recibido antes?
¿Existe una alternativa que proteja mejor margen?
¿Qué dato falta?
```

---

## Principio maestro

La mejor decisión de merchandising equilibra relevancia para el cliente y economía para el negocio.
