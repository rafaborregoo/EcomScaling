# Fase 11.17 — Attribution

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Attribution asigna crédito a uno o varios touchpoints asociados a una conversión.

No demuestra causalidad.

Modelos posibles:
- last click;
- last touch;
- first touch;
- linear;
- position-based;
- provider-defined.

La IA debe indicar siempre qué modelo y ventana sustentan una cifra atribuida.

El mismo pedido puede recibir diferente crédito bajo modelos distintos.

Antipatrones: attribution = incrementality, ocultar ventana, sumar créditos incompatibles o cambiar modelo para mejorar resultados.

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
