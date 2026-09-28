# Fase 5.3 — Personalidad

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La personalidad de marca representa los rasgos humanos que orientan su forma de comunicarse.

Puede expresarse en dimensiones como:
- directa vs narrativa;
- sobria vs energética;
- técnica vs accesible;
- premium vs informal;
- irreverente vs prudente.

La personalidad debe traducirse en comportamiento lingüístico concreto. “Divertida” no sirve si no se define qué tipo de humor se acepta.

La IA debe evitar sobreactuar la personalidad hasta convertirla en caricatura.

Antipatrones: demasiados rasgos contradictorios, adjetivos sin ejemplos, exagerar personalidad en todos los mensajes o copiar la personalidad de competidores.

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
