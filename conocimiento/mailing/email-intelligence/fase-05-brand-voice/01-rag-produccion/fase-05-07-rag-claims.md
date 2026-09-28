# Fase 5.7 — Claims

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un claim es una afirmación sobre producto, marca, resultado, rendimiento o ventaja.

Los claims deben estar respaldados por evidencia adecuada. La IA puede reformular un claim aprobado, pero no ampliar su significado más allá de lo soportado.

Debe distinguirse:
```text
FACT
APPROVED_CLAIM
MARKETING_FRAMING
```

El framing puede ser creativo. El hecho y el alcance del claim no.

Antipatrones: “el mejor”, “garantizado”, resultados universales, comparaciones sin evidencia, claims médicos o técnicos no validados.

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
