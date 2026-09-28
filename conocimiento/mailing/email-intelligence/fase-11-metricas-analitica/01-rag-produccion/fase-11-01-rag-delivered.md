# Fase 11.1 — Delivered

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Delivered representa mensajes aceptados por el servidor receptor o contabilizados como entregados por el proveedor de envío.

No significa:
- inbox placement;
- lectura;
- interacción;
- ausencia de filtrado a spam.

La IA debe distinguir claramente:
```text
SENT
DELIVERED
BOUNCED
DEFERRED
```

Delivered es una métrica de infraestructura, no de impacto comercial.

Antipatrones: interpretar delivered como visto, comparar tasas entre proveedores sin revisar definición o ignorar cambios de metodología del ESP.

---

## Marco de interpretación

La IA debe separar siempre:

```text
OBSERVED
ATTRIBUTED
INCREMENTAL
ESTIMATED
```

y no presentar una categoría como si fuera otra.

---

## Reglas de lectura

Una métrica solo tiene significado cuando conocemos:

- definición;
- numerador;
- denominador;
- ventana;
- población;
- fuente;
- versión;
- contexto.

Comparar números con definiciones diferentes produce conclusiones falsas.

---

## Preguntas que debe hacerse el agente

```text
¿Qué mide exactamente?
¿Cuál es el denominador?
¿Qué población incluye?
¿Qué ventana se usa?
¿Es observado, atribuido o causal?
¿La fuente es fiable?
¿Existen refunds, cancelaciones o bots?
¿Hay suficiente muestra?
¿La comparación es realmente equivalente?
```

---

## Principio maestro

La analítica no consiste en acumular métricas.

Consiste en utilizar definiciones consistentes para responder preguntas de negocio correctamente.
