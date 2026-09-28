# Fase 7.12 — AOV

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

AOV es el valor medio de pedido.

Ayuda a comprender el tamaño típico de una compra, pero no debe optimizarse de forma aislada.

Puede aumentar mediante:
- cross-sell;
- bundles;
- threshold offers;
- upsell.

Un AOV mayor puede coincidir con menor margen o menor conversión.

La IA debe tratarlo como una métrica económica contextual.

Antipatrones: perseguir AOV a cualquier coste, recomendar extras irrelevantes o confundir AOV con LTV.

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
