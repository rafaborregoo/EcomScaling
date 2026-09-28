# Fase 2.8 — Delays

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un delay es una espera deliberada entre acciones de un flow. Debe existir por una razón estratégica u operativa, no por costumbre.

Puede permitir que el cliente continúe por sí mismo, que llegue un pedido, que exista experiencia de producto o que madure una ventana de recompra.

Durante el delay el mundo cambia. Por eso, al terminar debe revalidarse el contexto antes de ejecutar el siguiente paso.

No existe un delay universal correcto. Depende de intención, categoría, lifecycle, delivery, presión y ventana de relevancia.

Antipatrones: delays copiados de benchmarks, esperar sin propósito, no cancelar tras conversión y ejecutar con datos antiguos.

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
