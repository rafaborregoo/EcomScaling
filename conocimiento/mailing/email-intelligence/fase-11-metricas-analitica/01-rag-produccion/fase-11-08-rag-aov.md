# Fase 11.8 — AOV

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Average Order Value representa el valor medio de los pedidos válidos.

Conceptualmente:
```text
order_revenue / valid_orders
```

AOV ayuda a interpretar merchandising y oferta, pero no debería optimizarse de forma aislada.

Un AOV mayor puede coexistir con:
- menor margen;
- menor frecuencia;
- menor conversión.

Antipatrones: confundir AOV con LTV, usar pedidos cancelados o ignorar efectos de descuentos y devoluciones.

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
