# Fase 4.23 — Copy según lifecycle

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El copy debe adaptarse a la relación que la persona ya tiene con la marca.

Ejemplo conceptual:

```text
PROSPECT
→ contexto + confianza + propuesta

FIRST_TIME_BUYER
→ reassurance + educación + experiencia

REPEAT_BUYER
→ relevancia + historial + siguiente necesidad

VIP
→ reconocimiento + acceso + servicio

AT_RISK
→ relevancia + recuperación de relación

LAPSED
→ reactivación
```

La IA no debe escribir como si todos fueran desconocidos ni utilizar el mismo nivel de explicación en todo el lifecycle.

Antipatrones: repetir bienvenida a compradores, vender agresivamente postcompra o utilizar exclusividad con personas que no son VIP.

---

## Marco de razonamiento de copy

El agente debe pensar:

```text
AUDIENCE
+
AWARENESS
+
LIFECYCLE
+
INTENT
+
OBJECTIVE
+
PRODUCT / OFFER
+
BRAND VOICE
+
PROOF
→ MESSAGE
```

El copy no debe crear hechos que no existen.

---

## Principios de calidad

Un buen copy debe ser:

- claro;
- específico;
- relevante;
- creíble;
- coherente con la marca;
- proporcional al nivel de intención;
- suficientemente breve para su función;
- suficientemente completo para resolver la fricción necesaria.

---

## Hechos vs interpretación

La IA debe separar:

```text
FACT
INFERENCE
PERSUASIVE_FRAMING
```

El framing puede ser creativo.

Los hechos no pueden inventarse.

---

## Preguntas que debe hacerse el agente

```text
¿A quién escribo?
¿Qué sabe ya?
¿Qué quiere?
¿Qué problema o deseo es relevante?
¿Qué podemos afirmar con evidencia?
¿Qué objeción necesita resolverse?
¿Qué acción tiene sentido?
¿Qué información sería inventada si la incluyera?
```

---

## Principio maestro

El copy debe aumentar comprensión y deseo sin sacrificar verdad ni relevancia.
