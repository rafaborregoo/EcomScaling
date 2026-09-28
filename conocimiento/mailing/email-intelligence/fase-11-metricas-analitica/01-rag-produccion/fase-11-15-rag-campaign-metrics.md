# Fase 11.15 — Campaign Metrics

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Campaign Metrics evalúa una ejecución planificada.

Debe relacionar:
- audiencia;
- entrega;
- interacción;
- conversión;
- revenue;
- margin/profit;
- guardrails.

La lectura debe comenzar por objetivo y no por una tabla genérica de métricas.

La IA debe distinguir métricas primarias, secundarias y guardrails.

Antipatrones: declarar ganadora una campaña por open rate cuando el objetivo era profit, comparar campañas con audiencias incompatibles o ignorar presión y seasonality.

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
