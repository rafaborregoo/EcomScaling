# Fase 2.5 — Entry Conditions

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las entry conditions son el conjunto completo de condiciones necesarias para que una oportunidad entre realmente en un flow.

El trigger abre una evaluación. Las entry conditions deciden si esa oportunidad cumple los requisitos del flow.

Pueden incluir recencia, estado, producto, lifecycle, ausencia de compra, mercado, mínimo de señal o una combinación.

Deben ser suficientemente estrictas para evitar entradas irrelevantes, pero no tan complejas que el flow resulte imposible de entender.

Antipatrones: entradas implícitas, condiciones ambiguas, repetir entrada por eventos duplicados, no versionar reglas.

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
