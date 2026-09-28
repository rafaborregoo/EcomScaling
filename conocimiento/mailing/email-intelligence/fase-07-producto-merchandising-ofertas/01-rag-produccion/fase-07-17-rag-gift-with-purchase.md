# Fase 7.17 — Gift with Purchase

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Gift with Purchase añade un producto o beneficio gratuito al superar una condición.

Puede aumentar valor percibido sin reducir directamente el precio principal.

Debe existir coherencia entre regalo, audiencia y compra.

La IA debe considerar disponibilidad del regalo y coste económico.

Antipatrones: regalo irrelevante, “gratis” con condiciones ocultas, regalo sin stock o usar un producto de bajo valor percibido que empeora la oferta.

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
