# Fase 7.4 — Complementariedad

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Complementariedad describe la relación entre productos que funcionan mejor juntos o resuelven partes distintas de una misma necesidad.

Puede ser:
- funcional;
- de uso conjunto;
- accesorio;
- reposición asociada;
- bundle natural.

Debe estar respaldada por catálogo, conocimiento de producto o comportamiento real.

No todo producto de la misma categoría es complementario.

Antipatrones: complementariedad por proximidad de catálogo, recomendaciones incompatibles, bundle artificial o complementariedad inventada.

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
