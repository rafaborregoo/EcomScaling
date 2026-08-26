# AI-20 - Evals de grounding, abstencion y tenancy

## Estado

`implemented`: todos los agentes activos pasan por casos offline de evidencia
grounded y abstencion mediante `evaluateAgentEvidenceContract`.

## Invariantes

- Una respuesta con confianza alta debe tener fuentes disponibles y del mismo
  tenant.
- Una respuesta sin fuentes debe declarar insuficiencia y usar confianza baja.
- Las referencias duplicadas, inexistentes o cross-tenant fallan el eval.
- `evaluateEvidenceConsistency` compara afirmaciones normalizadas contra hechos
  estructurados de autoridad y detecta contradicciones o ausencia de hecho sin
  hacer fallback a otro tenant.

El contrato valida procedencia y metadatos; no finge evaluar la verdad semantica
de una frase libre generada por un modelo. La normalizacion de moneda, fechas y
enums debe ocurrir antes de la comparacion.

La evaluacion semantica con LLM queda como una capa posterior que necesitara un
dataset versionado y claves de proveedor. Las barreras deterministas se
ejecutan ya en local y se aplican a los diez agentes de la matriz.
