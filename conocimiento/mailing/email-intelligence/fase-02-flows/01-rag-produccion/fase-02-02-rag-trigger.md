# Fase 2.2 — Trigger

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El trigger es el evento o condición que inicia la evaluación de un flow. No equivale a entrada ni a envío.

Puede ser un evento observable (`ADD_TO_CART`), un cambio de estado (`CUSTOMER_BECAME_LAPSED`), una condición temporal o un evento operativo. Debe provenir de una fuente suficientemente fiable.

El trigger responde a “¿qué ocurrió para que evaluemos esta oportunidad?”. Después todavía deben evaluarse identidad, elegibilidad, exclusiones, entry conditions, conflictos y presión.

La IA debe distinguir evento, estado e inferencia. Un `PRODUCT_VIEWED` es un hecho; “alta intención” es una inferencia; “entrar en Product Abandonment” es una decisión.

Antipatrones: trigger = send, eventos ambiguos, triggers duplicados, no conservar timestamp, activar por información antigua.

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
