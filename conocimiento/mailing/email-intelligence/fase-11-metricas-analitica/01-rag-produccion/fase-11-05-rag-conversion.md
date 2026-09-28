# Fase 11.5 — Conversion

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Conversion representa la acción objetivo atribuida u observada después de una comunicación.

Puede ser:
- purchase;
- signup;
- review;
- referral;
- other target action.

La IA debe distinguir:
```text
observed_conversion
attributed_conversion
incremental_conversion
```

Una conversión posterior a un email no demuestra que el email la causó.

Antipatrones: tratar atribución como causalidad, cambiar definición entre campañas, contar múltiples conversiones cuando el objetivo era único o ignorar devoluciones/cancelaciones.

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
