# Fase 7.15 — Free Shipping

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Free Shipping elimina o reduce una fricción de entrega.

Puede funcionar como incentivo cuando el coste de envío es una barrera importante.

No es gratuito para el negocio. Debe evaluarse coste logístico y margen.

Puede aplicarse:
- sin mínimo;
- con threshold;
- a regiones;
- a métodos concretos.

Antipatrones: prometer envío gratis donde no aplica, esconder excepciones, threshold poco claro o utilizarlo cuando shipping ya era gratuito.

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
