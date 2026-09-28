# Fase 2.3 — Elegibilidad

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Elegibilidad responde a si una persona puede participar en un flow una vez detectada una oportunidad.

Puede depender de consentimiento aplicable, estado del cliente, mercado, producto, disponibilidad, lifecycle, presión comercial, supresiones y conflictos.

Elegible no significa que haya que enviar inmediatamente. La persona puede entrar y posteriormente esperar, ramificarse o salir.

La elegibilidad debe evaluarse con datos actuales y ser explicable. Cuando el contexto puede cambiar durante un delay, conviene revalidarla antes del siguiente mensaje.

Antipatrones: trigger implica elegibilidad, utilizar datos obsoletos, ignorar supresiones o asumir que todo subscriber puede recibir cualquier flow.

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
