# Fase 7.13 — Descuento porcentual

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un descuento porcentual reduce el precio en una proporción relativa.

Puede ser eficaz cuando la reducción resulta significativa respecto al precio del producto, pero su coste económico crece con el ticket.

La IA debe considerar sensibilidad promocional, margen, historial de descuentos y claridad del mensaje.

Antipatrones: porcentajes permanentes, descuentos demasiado profundos, comparar contra precios de referencia inválidos o ofrecerlo a quien ya iba a comprar a precio completo.

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
