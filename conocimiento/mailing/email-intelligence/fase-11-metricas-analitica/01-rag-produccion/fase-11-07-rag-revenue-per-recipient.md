# Fase 11.7 — Revenue Per Recipient

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Revenue Per Recipient (RPR) relaciona ingresos atribuidos u observados con la cantidad de destinatarios.

Conceptualmente:
```text
revenue / recipients
```

Es útil para comparar eficiencia entre audiencias o campañas, pero hereda todas las limitaciones del modelo de revenue y atribución.

La IA debe evitar considerar RPR una medida pura de causalidad.

Antipatrones: comparar RPR con distintas ventanas de atribución, usar sent en una campaña y delivered en otra o ignorar tamaño y calidad de audiencia.

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
