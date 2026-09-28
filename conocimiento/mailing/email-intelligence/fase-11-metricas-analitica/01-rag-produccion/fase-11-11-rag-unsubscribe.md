# Fase 11.11 — Unsubscribe Rate

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Unsubscribe Rate mide la proporción de destinatarios que se dan de baja tras una comunicación o dentro de una ventana atribuida.

Es una métrica de guardrail importante.

Debe interpretarse junto con:
- presión;
- audiencia;
- tipo de campaña;
- acquisition source;
- engagement.

Una tasa alta puede indicar irrelevancia, frecuencia, expectativa incorrecta o mala captación.

Antipatrones: ocultar bajas para proteger métricas, comparar sin denominador consistente o asumir que toda baja es causada solo por el último email.

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
