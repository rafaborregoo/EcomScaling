# Fase 7.3 — Recomendaciones

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una recomendación de producto debe responder a una necesidad o patrón observable.

Puede basarse en:
- afinidad;
- compra previa;
- complementariedad;
- comportamiento similar;
- contexto de lifecycle;
- merchandising.

La IA debe poder explicar por qué un producto es relevante.

Una recomendación no debe mostrar productos agotados, incompatibles o ya innecesarios.

Antipatrones: “otros clientes también compraron” sin evidencia, recomendar por popularidad global a todos, repetir siempre los mismos productos o ignorar contexto postcompra.

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
