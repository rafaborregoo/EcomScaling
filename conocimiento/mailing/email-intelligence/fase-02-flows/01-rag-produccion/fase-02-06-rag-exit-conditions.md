# Fase 2.6 — Exit Conditions

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las exit conditions determinan cuándo una persona debe abandonar un flow.

Un flow puede terminar por éxito, conversión, pérdida de oportunidad, expiración, supresión, cambio de estado o aparición de un contexto superior.

Salir correctamente es tan importante como entrar. Un flujo que continúa tras compra, devolución o resolución del objetivo destruye relevancia.

La IA debe distinguir `CONVERTED`, `COMPLETED`, `CANCELLED`, `SUPPRESSED` y `EXPIRED` conceptualmente.

Antipatrones: seguir tras compra, no cancelar delays, confundir expiración con conversión y no registrar motivo de salida.

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
