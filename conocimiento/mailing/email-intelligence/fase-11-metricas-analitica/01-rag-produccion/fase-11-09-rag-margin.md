# Fase 11.9 — Margin

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Margin mide la contribución económica después de determinados costes definidos por el negocio.

Debe quedar claro qué costes incluye:
- COGS;
- descuentos;
- shipping subsidy;
- payment fees;
- fulfillment;
- otros costes variables.

No existe una única definición universal de margen operativo para todos los ecommerce.

La IA debe usar la definición del tenant y distinguir margen bruto de contribution margin.

Antipatrones: comparar márgenes con definiciones distintas, usar revenue como sustituto o inventar costes faltantes.

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
