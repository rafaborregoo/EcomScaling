# Fase 8.2 — Frequency Caps — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista necesaria para `Frequency Caps`.

---

## Reglas específicas

- Contar comunicaciones elegibles por ventana.
- Bloquear o retrasar cuando se excede el cap.
- Permitir overrides solo explícitos y auditados.
- Consumir clasificación correcta de mensaje.

---

## Pipeline

```text
collect active opportunities
→ normalize state
→ apply suppressions
→ apply hard exclusions
→ calculate pressure
→ detect conflicts
→ resolve priority
→ evaluate timing
→ SEND / DELAY / SUPPRESS / NO_SEND
```

---

## Invariantes

- las suppressions y hard exclusions se evalúan antes del ranking comercial;
- una decisión debe ser idempotente respecto a la misma oportunidad y versión;
- los datos operativos provienen de fuentes autoritativas;
- toda decisión relevante devuelve `reason_code`;
- los cambios de contexto fuerzan reevaluación;
- el LLM no puede sobreescribir una restricción dura.

---

## Auditoría mínima

```text
customer_id
decision_context_id
active_opportunities
active_flows
active_campaigns
pressure_state
conflicts
priority_result
decision
reason_codes
rules_version
evaluated_at
```

---

## Principio maestro

El runtime arbitra entre oportunidades; no maximiza el número de mensajes.
