# Fase 11.16 — Cohorts

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Cohort analysis agrupa clientes que comparten un evento o periodo de origen y observa su comportamiento a lo largo del tiempo.

Ejemplos:
- first purchase month;
- signup month;
- acquisition campaign;
- first product/category.

Permite distinguir cambios reales de lifecycle de mezclas de poblaciones diferentes.

La IA debe comparar cohortes con ventanas equivalentes.

Antipatrones: comparar cohortes con madurez distinta, modificar definición a mitad del análisis o usar cohortes demasiado pequeñas para conclusiones fuertes.

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
