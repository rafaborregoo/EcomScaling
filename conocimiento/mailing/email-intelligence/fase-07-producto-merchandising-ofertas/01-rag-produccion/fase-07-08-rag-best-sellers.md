# Fase 7.8 — Best Sellers

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Best Sellers utiliza popularidad como señal de prueba y selección.

Debe definirse sobre un periodo y contexto concretos. “Más vendido” sin ventana o población puede ser ambiguo.

Puede ayudar a clientes con baja afinidad o discovery temprano.

La IA debe evitar presentar popularidad como calidad objetiva.

Antipatrones: ranking histórico eterno, best seller sin definición, manipular orden para aparentar demanda o usar popularidad cuando la afinidad individual ofrece mejor señal.

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
