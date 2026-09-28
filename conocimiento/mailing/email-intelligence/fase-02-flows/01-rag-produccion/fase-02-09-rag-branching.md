# Fase 2.9 — Branching

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Branching permite que una secuencia cambie según información relevante.

Una rama solo merece existir si cambia una decisión real: mensaje, timing, producto, oferta, prioridad o salida.

Pueden ser útiles ramas por compra, lifecycle, producto, engagement, mercado, valor o respuesta. Deben basarse en datos observables o estados calculados de forma fiable.

Árboles excesivamente complejos son difíciles de mantener, medir y auditar. Debe preferirse la mínima complejidad capaz de producir una decisión mejor.

Antipatrones: ramificar por cualquier dato, ramas casi idénticas, condiciones solapadas, orden ambiguo y ausencia de fallback.

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
