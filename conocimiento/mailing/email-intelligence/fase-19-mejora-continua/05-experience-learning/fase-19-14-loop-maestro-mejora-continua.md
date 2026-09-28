# Fase 19.14 — Loop maestro de mejora continua

## Tipo de artefacto
`05-experience-learning`

## Objetivo

Cerrar el ciclo completo de aprendizaje del sistema.

```text
EXECUTE
→ MEASURE
→ CAPTURE
→ NORMALIZE
→ OBSERVE
→ HYPOTHESIZE
→ EXPERIMENT
→ EVIDENCE
→ LEARN
→ PROMOTE / DEPRECATE
→ UPDATE CONTEXT
→ EXECUTE AGAIN
```

## Regla de arquitectura

- RAG = conocimiento conceptual estable.
- Experience Learning = conocimiento surgido de resultados.
- Runtime = cálculo y transición.
- Policies = límites.
- Tenant Context = realidad/configuración local.
- Auditoría = trazabilidad y revisión.

## Condición de cierre de loop

Un aprendizaje solo afecta decisiones futuras cuando:
1. tiene scope definido;
2. dispone de evidence;
3. tiene confidence suficiente;
4. está vigente;
5. no viola policies;
6. Context Assembly puede recuperarlo;
7. el agente correspondiente sabe interpretarlo.

## Principio maestro

EcomScaling IA no debe “recordar” por acumulación: debe aprender mediante un ciclo gobernado.
