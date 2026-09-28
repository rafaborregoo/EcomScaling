# Fase 7.2 — Afinidad

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La afinidad estima la relevancia relativamente persistente entre una persona y un producto, categoría o conjunto de atributos.

Debe distinguirse de intención actual. Un cliente puede tener afinidad alta con una categoría y no querer comprar hoy.

La afinidad puede surgir de:
- compras;
- repetición;
- navegación;
- búsquedas;
- clicks;
- wishlist;
- interacción con contenido.

La IA debe utilizar afinidad como señal de relevancia, no como certeza.

Antipatrones: una visita = afinidad alta, intereses permanentes, ignorar señales negativas o usar afinidad sin recencia.

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
