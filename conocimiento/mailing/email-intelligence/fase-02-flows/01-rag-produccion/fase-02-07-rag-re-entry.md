# Fase 2.7 — Re-entry

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Re-entry define cuándo una persona puede volver a entrar en un flow después de haber salido.

Una reentrada correcta debe responder a una nueva oportunidad real: un nuevo carrito, nueva compra, nuevo ciclo de replenishment, nuevo lapse o nuevo evento equivalente.

Debe distinguirse entre repetición válida y duplicación técnica.

El cooldown puede proteger contra loops, pero no debe bloquear indefinidamente oportunidades genuinas.

Antipatrones: re-entry ilimitado, reentrar por eventos duplicados, bloquear para siempre o ignorar que el objeto de la oportunidad cambió.

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
