# Fase 11.18 — Incrementality

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Incrementality intenta estimar cuánto resultado ocurrió gracias a una intervención y no simplemente después de ella.

La pregunta es:
```text
¿Qué habría ocurrido sin esta campaña o flow?
```

Por ello suele requerir:
- control;
- holdout;
- experimento;
- diseño causal adecuado.

Una diferencia observada sin control puede estar explicada por selección, seasonality, intención previa u otros factores.

La IA debe tratar incremental lift con mayor valor causal que attributed revenue cuando el experimento está bien diseñado.

Antipatrones: llamar incremental a cualquier revenue atribuido, comparar grupos no equivalentes, terminar experimento demasiado pronto o ignorar contaminación entre grupos.

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

---

## Puente cross-channel

El revenue que Klaviyo u otra herramienta atribuye a email no es revenue incremental, tampoco cuando se compara con paid media o con las ventas de Shopify. Las afirmaciones incrementales siguen exigiendo la evidencia causal de `conocimiento/fase-09/01-rag-produccion/9.05-incrementality.md`; el marco multicanal está en `conocimiento/fase-10/01-rag-produccion/10.01-principios-cross-channel-attribution.md`.
