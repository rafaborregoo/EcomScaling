# Fase 11.6 — Revenue

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Revenue mide ingresos asociados a pedidos o conversiones económicas.

Debe distinguirse:
- gross revenue;
- net revenue;
- attributed revenue;
- incremental revenue.

Revenue no equivale a profit.

La IA debe evitar conclusiones económicas basadas únicamente en facturación, especialmente cuando existen descuentos, devoluciones o costes variables altos.

Antipatrones: revenue = rentabilidad, ignorar refunds, comparar gross y net, o considerar revenue atribuido como valor incremental real.

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
