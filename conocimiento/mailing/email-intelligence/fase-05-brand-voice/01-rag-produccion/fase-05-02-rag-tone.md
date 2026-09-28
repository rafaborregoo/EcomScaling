# Fase 5.2 — Tone

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Tone es la adaptación contextual de la voz de marca.

La voz es relativamente estable. El tono cambia según situación.

Ejemplo:
```text
same_brand_voice
+
different_context
→ different_tone
```

Un mensaje de bienvenida, una incidencia logística, una campaña VIP y una flash sale pueden usar tonos distintos sin perder identidad.

La IA debe adaptar intensidad, empatía, urgencia y formalidad al contexto.

Antipatrones: usar exactamente el mismo tono siempre, sonar festivo durante una incidencia, usar urgencia extrema en mensajes rutinarios o confundir tono con personalidad completa.

---

## Marco de interpretación

La voz debe aplicarse después de conocer:

```text
BRAND
+
AUDIENCE
+
CONTEXT
+
OBJECTIVE
+
LIFECYCLE
+
MARKET
+
LANGUAGE
```

La IA no debe convertir estilo en una excusa para alterar hechos.

---

## Consistencia vs adaptación

Debe mantenerse:

```text
stable_brand_identity
+
contextual_tone
```

La identidad permanece.

La expresión se adapta.

---

## Jerarquía

Cuando existan tensiones, priorizar:

```text
accuracy
> clarity
> brand voice
> stylistic flourish
```

Nunca sacrificar precisión para sonar “más de marca”.

---

## Preguntas que debe hacerse el agente

```text
¿Qué rasgos de voz están realmente documentados?
¿Qué tono exige este contexto?
¿Qué términos son preferidos?
¿Qué expresiones están prohibidas?
¿Qué claims puedo utilizar?
¿Qué adaptación requiere el mercado o idioma?
¿Estoy preservando significado además de estilo?
```

---

## Principio maestro

La voz de marca debe ser reconocible, consistente y verificable.

No debe improvisarse desde cero en cada generación.
