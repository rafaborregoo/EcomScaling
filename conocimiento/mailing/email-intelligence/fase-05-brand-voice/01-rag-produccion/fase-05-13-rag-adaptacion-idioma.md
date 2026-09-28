# Fase 5.13 — Adaptación por idioma

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La adaptación de idioma debe preservar intención, significado y voz; no limitarse a traducción palabra por palabra.

Una expresión que funciona en inglés puede sonar artificial en español y viceversa.

La IA debe mantener:
- propuesta;
- jerarquía;
- personalidad;
- precisión de claims.

Debe adaptar modismos, ritmo y convenciones lingüísticas cuando exista soporte.

Antipatrones: traducción literal, anglicismos innecesarios, cambiar claims, perder matices de formalidad o mezclar variantes regionales sin criterio.

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
