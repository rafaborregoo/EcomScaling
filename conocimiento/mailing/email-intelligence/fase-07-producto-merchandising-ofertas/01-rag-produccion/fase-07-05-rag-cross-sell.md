# Fase 7.5 — Cross-Sell

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Cross-sell aumenta el valor de una relación recomendando productos complementarios a una compra o intención existente.

Debe responder a una lógica de uso, no simplemente a “otro producto”.

Puede aplicarse:
- antes de compra;
- en cart;
- postcompra;
- replenishment context.

La IA debe considerar compatibilidad, ownership, stock y timing.

Antipatrones: productos aleatorios, complementariedad débil, recomendar algo ya poseído cuando no es consumible o convertir cross-sell en presión constante.

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
