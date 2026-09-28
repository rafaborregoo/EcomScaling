# Fase 11.14 — Flow Metrics

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Flow Metrics evalúa el rendimiento de una automatización a lo largo de una secuencia y de sus oportunidades.

No debe limitarse a sumar revenue del flow.

Puede analizar:
- entries;
- exits;
- conversion;
- time-to-conversion;
- step drop-off;
- revenue;
- margin;
- suppression;
- conflicts.

La unidad correcta puede ser la oportunidad, la persona o la instancia del flow.

La IA debe distinguir impacto del flow completo y rendimiento de cada paso.

Antipatrones: optimizar un email aislado perjudicando la secuencia, comparar flows con triggers distintos o ignorar clientes que salen por conversión antes de mensajes posteriores.

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
