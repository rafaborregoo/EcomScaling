# Fase 11.3 — Clicks

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Clicks representan interacción explícita con enlaces del email.

Suelen ser una señal más fuerte que opens, pero tampoco equivalen automáticamente a intención de compra.

Debe distinguirse:
- total clicks;
- unique clicks;
- link-level clicks;
- bot/security clicks cuando puedan identificarse.

Los clicks permiten aprender sobre:
- interés de contenido;
- producto;
- CTA;
- afinidad.

Antipatrones: contar bots como usuarios, sumar múltiples clicks de una misma persona como conversiones o ignorar qué enlace recibió interacción.

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
