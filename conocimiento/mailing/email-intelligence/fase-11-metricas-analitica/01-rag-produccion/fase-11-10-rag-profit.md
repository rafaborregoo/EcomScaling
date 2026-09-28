# Fase 11.10 — Profit

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Profit representa beneficio después de los costes definidos para el análisis.

En marketing de email puede ser más útil evaluar contribution profit que beneficio contable total, dependiendo del objetivo.

La IA debe distinguir:
- revenue;
- gross margin;
- contribution profit;
- net profit.

No debe asumir que una campaña con alto revenue es rentable.

Antipatrones: mezclar costes fijos y variables sin criterio, comparar campañas con modelos de costes distintos o presentar estimaciones como cifras contables oficiales.

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
