# Fase 2.4 — Exclusiones

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las exclusiones definen quién debe quedar fuera de un flow aunque cumpla criterios positivos de entrada.

Ejemplos: compra posterior, producto incompatible, mercado no soportado, incidencia abierta, producto agotado, presión excesiva, estado de cliente incompatible o pertenencia a un flow superior.

Las exclusiones protegen relevancia y evitan experiencias absurdas. Pueden ser temporales o persistentes.

La IA debe entender que una buena audiencia se define tanto por quién entra como por quién queda fuera.

Antipatrones: olvidar compradores posteriores, excluir demasiado, condiciones contradictorias, no actualizar exclusiones y mantener mensajes pendientes tras quedar excluido.

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
