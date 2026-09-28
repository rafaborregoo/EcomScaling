# Fase 11.12 — Complaint Rate

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Complaint Rate mide señales de spam o abuso reportadas por destinatarios/proveedores.

Es una métrica crítica de reputación y guardrail.

Debe interpretarse por:
- proveedor;
- dominio;
- campaña;
- fuente;
- periodo.

Pequeños volúmenes pueden producir ratios muy volátiles.

Antipatrones: ignorar complaint porque revenue fue alto, comparar porcentajes con muestras mínimas o no suprimir al contacto afectado.

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
