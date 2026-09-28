# Fase 7.22 — Protección de margen

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La protección de margen impide que merchandising y promociones optimicen conversión sacrificando rentabilidad de forma innecesaria.

Debe considerar:
- coste de producto;
- shipping subsidy;
- descuentos;
- regalos;
- payment fees cuando sean relevantes;
- devoluciones estimadas si el negocio las incorpora.

La IA debe preferir la menor concesión comercial capaz de conseguir el objetivo.

Antipatrones: maximizar revenue, stacking incontrolado, descuentos iguales para todos, ignorar coste de gifts o shipping.

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
