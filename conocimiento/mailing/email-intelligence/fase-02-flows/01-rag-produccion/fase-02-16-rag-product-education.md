# Fase 2.16 — Product Education

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Product Education ayuda a que una persona comprenda y obtenga valor de un producto.

Puede existir antes de compra, durante consideración, o después de compra. El contenido debe responder al producto real: uso, preparación, mantenimiento, expectativas, compatibilidad y errores comunes.

Una buena educación reduce incertidumbre, soporte, devoluciones por mal uso y frustración.

Antipatrones: contenido genérico, claims inventados, tutoriales irrelevantes, educación demasiado tarde o convertir toda educación en venta.

---

## Cómo debe razonar el agente

```text
trigger
→ fuerza de la oportunidad
→ estado actual
→ exclusiones
→ timing
→ siguiente mejor acción
→ exit condition
```

Debe priorizar siempre el dato más reciente y el estado más avanzado del cliente.

---

## Preguntas clave

```text
¿Por qué existe esta oportunidad?
¿Sigue vigente?
¿Qué ocurrió después del trigger?
¿Existe compra o progresión posterior?
¿Qué fricción conocemos realmente?
¿El siguiente email añade valor?
¿Debe continuar, cambiar de rama o terminar?
```

---

## Principio maestro

El flow debe responder al contexto real del cliente y desaparecer cuando deja de aportar valor.
