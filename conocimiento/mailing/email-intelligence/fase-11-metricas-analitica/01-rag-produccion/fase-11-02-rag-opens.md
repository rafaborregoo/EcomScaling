# Fase 11.2 — Opens

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Opens intenta medir aperturas de email, normalmente mediante carga de pixel u otras señales del proveedor.

Es una métrica imperfecta. Mecanismos de privacidad, precarga de imágenes y diferencias entre clientes pueden inflar o distorsionar aperturas.

La IA debe tratar opens como señal débil y contextual, no como verdad absoluta de atención.

Puede ser útil para:
- tendencia relativa;
- diagnóstico aproximado;
- comparación interna consistente.

Antipatrones: usar open rate como KPI principal de negocio, asumir una apertura = lectura o clasificar engagement únicamente con opens.

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
