# Fase 7.16 — BOGO

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

BOGO agrupa promociones del tipo Buy One Get One.

Puede ser:
- buy one get one free;
- buy one get one discounted;
- buy X get Y.

Funciona mejor cuando existe margen, inventario y complementariedad o consumo suficiente.

La IA debe explicar claramente qué producto activa y cuál recibe beneficio.

Antipatrones: condiciones ambiguas, inventario insuficiente, regalar producto de alto coste sin control o presentar BOGO cuando el cliente no necesita múltiples unidades.

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
