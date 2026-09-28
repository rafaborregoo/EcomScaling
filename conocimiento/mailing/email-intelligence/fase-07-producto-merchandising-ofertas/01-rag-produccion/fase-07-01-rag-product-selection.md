# Fase 7.1 — Product Selection

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Product Selection consiste en decidir qué producto o conjunto de productos merece ocupar atención en una comunicación.

La selección debe partir del objetivo, audiencia y contexto, no del catálogo completo. Puede priorizar relevancia, intención, afinidad, margen, stock, novedad, complementariedad o estrategia de negocio.

La IA debe distinguir entre:
- producto estratégicamente prioritario;
- producto personalmente relevante;
- producto disponible;
- producto rentable.

La mejor selección suele equilibrar varias dimensiones.

Antipatrones: elegir el producto más vendido para todos, ignorar stock o margen, seleccionar demasiados SKUs, recomendar productos incompatibles o priorizar inventario sin relevancia para el cliente.

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
