# Fase 18.17 — Roadmap

## Tipo de artefacto
`99-auditoria`

## Objetivo

El roadmap convierte findings priorizados en una secuencia de mejora.

Cada iniciativa necesita objetivo, dependencia, owner, evidence, expected outcome, metric, validation y status.

El roadmap debe poder cambiar cuando aparece nueva evidencia.

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
