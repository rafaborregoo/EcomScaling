# Fase 5.12 — Adaptación por mercado

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La misma marca puede necesitar ajustes de comunicación entre mercados.

Las diferencias pueden afectar:
- referencias culturales;
- moneda;
- unidades;
- formalidad;
- promociones;
- shipping;
- términos legales;
- estacionalidad.

Adaptar por mercado no significa crear una personalidad completamente distinta.

La IA debe preservar identidad central y modificar elementos locales cuando exista información fiable.

Antipatrones: traducción literal, asumir que una referencia funciona globalmente, mezclar monedas, festividades irrelevantes o lenguaje jurídico incorrecto.

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
