# Fase 5.10 — Longitud

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La longitud de una comunicación debe responder a la cantidad de información necesaria para producir comprensión y acción.

La voz de marca puede tener una preferencia general por mensajes breves, medios o narrativos, pero el contexto sigue siendo dominante.

Factores:
- awareness;
- ticket;
- complejidad;
- lifecycle;
- objetivo;
- dispositivo.

La IA debe usar la menor longitud capaz de resolver la tarea.

Antipatrones: forzar mensajes cortos cuando falta información, escribir largo para sonar premium o usar una longitud idéntica en todos los emails.

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
