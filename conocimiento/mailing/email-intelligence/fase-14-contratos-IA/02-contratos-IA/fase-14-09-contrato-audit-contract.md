# Fase 14.9 — Audit Contract

## Tipo de artefacto
`02-contratos-IA`

## Objetivo

Definir una salida uniforme para auditorías de tienda, estrategia, campañas, flows y configuración.

---

## Principio arquitectónico

Este contrato define la interfaz semántica entre contexto, agentes y runtime.

No contiene:
- lógica determinista duplicada;
- reglas de negocio hardcodeadas;
- conocimiento conceptual que ya vive en RAG;
- datos específicos de una tienda.

---

## Entradas

- `audit_scope`
- `current_state`
- `metrics`
- `policies`
- `runtime_states`
- `historical_context`
- `business_objectives`

---

## Salidas

- `findings`
- `gaps`
- `risks`
- `evidence`
- `priority_dimensions`
- `recommended_next_actions`
- `missing_information`
- `confidence`

---

## Reglas comunes

Toda salida debe distinguir:

```text
FACT
INFERENCE
RECOMMENDATION
UNKNOWN
```

El agente no debe transformar `UNKNOWN` en un hecho probable sin marcarlo como inferencia.

---

## Reglas de calidad

- toda recomendación material debe tener rationale;
- hechos críticos deben estar vinculados a `evidence`;
- ausencia de datos debe expresarse en `missing_information`;
- incertidumbre debe expresarse en `confidence`;
- riesgos deben representarse en `risks`;
- ninguna salida puede sobreescribir una policy hard;
- ninguna salida generativa sustituye un cálculo oficial del runtime.

---

## Estado de ejecución

Cuando el contrato produce una recomendación que requiere runtime, la salida debe entenderse como:

```text
PROPOSED
```

hasta que el motor correspondiente la valide.

Ejemplos:
- oferta recomendada → Offer Engine;
- productos recomendados → Product Recommendation Engine;
- elegibilidad → Eligibility Engine;
- cumplimiento → Compliance Engine;
- decisión final → Send Decision Engine.

---

## Manejo de información ausente

Si falta un dato requerido:

```text
missing_information.required = true
```

y el agente debe:
1. identificar qué falta;
2. explicar su impacto;
3. utilizar un fallback seguro solo si existe;
4. bloquear cualquier afirmación o acción que dependa críticamente del dato ausente.

---

## Trazabilidad

Toda salida debería poder relacionarse con:

```text
request_id
agent_id
agent_version
contract_version
context_version
evidence_refs
runtime_refs
generated_at
```

---

## Principio maestro

Los contratos obligan a la IA a producir estructuras verificables, no respuestas libres difíciles de gobernar.
