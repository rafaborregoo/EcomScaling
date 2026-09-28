# Fase 18.16 — Prioridades

## Tipo de artefacto
`99-auditoria`

## Objetivo

Priorizar una auditoría significa ordenar el trabajo.

Debe considerar dependencia, riesgo, impacto esperado, esfuerzo, reversibilidad, confidence y velocidad de aprendizaje. Primero deben resolverse bloqueos y problemas que invalidan otras acciones.

La IA debe explicar por qué una acción va antes que otra.

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
