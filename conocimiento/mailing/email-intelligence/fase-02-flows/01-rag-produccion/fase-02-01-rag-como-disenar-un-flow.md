# Fase 2.1 — Cómo diseñar un flow

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un flow es una automatización orientada a un objetivo concreto. Debe diseñarse desde el objetivo hacia atrás: qué cambio queremos producir, qué oportunidad lo justifica, qué trigger la detecta, quién puede entrar, qué debe excluirse, cuándo termina, qué mensajes son necesarios y cómo se medirá.

La IA debe pensar un flow como una lógica dinámica, no como una serie fija de emails. Cada mensaje debe tener una función distinta. El diseño mínimo debe contemplar objetivo primario, trigger, elegibilidad, exclusiones, entry conditions, exit conditions, re-entry, delays, branching, presión comercial, prioridad y métrica principal.

Un flow debe abandonar la oportunidad cuando cambia el contexto. Compra, incidencia, pérdida de stock, expiración, presión excesiva o aparición de un flow superior pueden volver irrelevante el siguiente paso.

El mejor flow no es el más largo. Es el que utiliza el menor número de acciones necesarias para mover al cliente sin deteriorar experiencia, margen o entregabilidad.

Antipatrones: construir flows por costumbre, añadir emails sin función, copiar secuencias universales, medir solo opens/clicks, ignorar otros flows y no definir cómo termina.

---

## Marco de razonamiento

Antes de recomendar cualquier acción, el agente debe comprobar:

```text
trigger
→ oportunidad
→ elegibilidad
→ exclusiones
→ contexto actual
→ presión
→ prioridad
→ salida
```

Debe asumir que los estados pueden cambiar durante la ejecución.

---

## Preguntas que debe hacerse el agente

```text
¿Qué oportunidad existe?
¿Qué evidencia la soporta?
¿Sigue vigente?
¿Quién debe quedar fuera?
¿Hay un estado más avanzado?
¿El objetivo ya se cumplió?
¿El siguiente paso aporta algo nuevo?
¿Existe un flow más prioritario?
```

---

## Principio maestro

Un flow es una respuesta dinámica a una oportunidad, no una cadena rígida de emails.
