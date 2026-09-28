# Fase 7.7 — Bundles

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un bundle agrupa productos que juntos ofrecen mayor utilidad, conveniencia o valor.

Puede ser:
- funcional;
- temático;
- starter kit;
- replenishment;
- gift set.

El bundle debe tener lógica propia. No es simplemente agrupar inventario lento.

La IA debe considerar compatibilidad, margen, stock de todos los componentes y claridad de ahorro cuando exista.

Antipatrones: bundle artificial, ahorro engañoso, componente agotado, demasiados SKUs o forzar productos poco relevantes.

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
