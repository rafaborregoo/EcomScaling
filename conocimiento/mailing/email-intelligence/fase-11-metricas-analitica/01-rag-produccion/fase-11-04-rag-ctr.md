# Fase 11.4 — CTR

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

CTR mide la proporción de una población que genera click.

La definición debe ser explícita:
```text
unique_clickers / delivered
```
es una forma común.

No debe mezclarse con CTOR, que usa aperturas como denominador.

La IA debe comparar CTR solo cuando las definiciones son consistentes.

Antipatrones: cambiar denominador entre informes, comparar CTR con CTOR, optimizar clicks sin considerar calidad del tráfico o utilizar delivered incorrecto.

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
