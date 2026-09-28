# Fase 11.13 — Bounce Rate

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Bounce Rate mide la proporción de mensajes rechazados.

Debe distinguir:
- hard bounce;
- soft bounce;
- policy rejection;
- temporary deferral.

Una tasa agregada sin clasificación puede ocultar causas diferentes.

La IA debe observar tendencia y fuente de adquisición, además del porcentaje global.

Antipatrones: sumar todos los rechazos como iguales, ignorar hard bounce o atribuir un spike únicamente al proveedor sin evidencia.

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
