# Fase 5.6 — Palabras prohibidas

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Las palabras prohibidas son términos que la marca decide no utilizar por razones de posicionamiento, cumplimiento, claridad o sensibilidad.

Pueden incluir:
- superlativos no demostrables;
- jerga agresiva;
- expresiones legales problemáticas;
- palabras asociadas a competidores;
- términos fuera de tono.

La IA debe tratar estas restricciones como límites duros de estilo cuando estén definidas.

Antipatrones: prohibiciones vagas, listas sin contexto, reemplazar una palabra prohibida por un sinónimo igualmente problemático o ignorar restricciones en traducciones.

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
