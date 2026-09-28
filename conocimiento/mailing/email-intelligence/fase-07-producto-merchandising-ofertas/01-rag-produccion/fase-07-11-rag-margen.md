# Fase 7.11 — Margen

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El margen determina cuánto valor económico deja una venta después de los costes relevantes definidos por el negocio.

La IA debe distinguir revenue de contribution margin.

Una campaña puede aumentar ventas y destruir rentabilidad si depende de descuentos o productos con poco margen.

El margen puede condicionar:
- elegibilidad de oferta;
- profundidad de descuento;
- prioridad de producto;
- bundles.

Antipatrones: optimizar revenue bruto, ignorar coste del incentivo, asumir mismo margen en todos los productos o usar margen estimado como hecho sin etiquetarlo.

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
