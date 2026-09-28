# Fase 18.6 — Copy

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de copy evalúa claridad, coherencia estratégica y evidencia.

Debe revisar awareness, desire, pain points, value proposition, hooks, subject/preheader, headline, body, CTA, objeciones, proof, urgencia/escasez, lifecycle fit, intent fit, brand voice, claims y anti-patrones.

No debe valorar copy por gusto personal.

---

## Estructura de hallazgo

```text
finding_id
domain
observation
evidence
current_state
expected_or_required_state
gap
risk
confidence
dependencies
recommended_action
validation_method
```

## Estados recomendados

```text
OK
PARTIAL
GAP
RISK
BLOCKED
UNKNOWN
NOT_APPLICABLE
```

`UNKNOWN` no debe convertirse en `OK`.

## Evidencia

Distinguir siempre:
- dato observado;
- output de runtime;
- configuración del tenant;
- policy vigente;
- evidencia experimental;
- interpretación de IA.

## Principio maestro

Una auditoría útil construye una cadena trazable de evidencia → gap/riesgo → acción → validación.
