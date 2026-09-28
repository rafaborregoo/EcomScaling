# Fase 16.11 — Orquestación entre agentes

## Tipo de artefacto
`02-contratos-IA`

## Objetivo

Definir cómo cooperan los agentes especializados sin convertirse en un sistema de decisiones contradictorias.

## Principio

Ningún agente debe intentar realizar todas las tareas.

La especialización permite separar:
- estrategia;
- campaña;
- flow;
- copy;
- creatividad;
- merchandising;
- lifecycle;
- experimentación;
- deliverability;
- auditoría.

## Patrón de handoff

```text
REQUEST
→ ROUTER
→ PRIMARY AGENT
→ SPECIALIST AGENTS / ENGINES
→ OUTPUT VALIDATION
→ FINAL RESPONSE OR APPROVAL
```

## Handoff mínimo

Todo handoff debe preservar:

```text
request_id
tenant_id
task
current_context_version
evidence_refs
runtime_refs
policy_refs
open_questions
confidence
risks
```

## Regla de no duplicación

Si otro agente es owner natural de una tarea:
- el agente actual no improvisa esa especialidad;
- formula la necesidad;
- transfiere contexto mínimo;
- recibe la salida estructurada;
- integra solo lo necesario.

## Conflictos entre agentes

Cuando dos agentes discrepan:
1. comparar fuentes;
2. priorizar runtime/source of truth;
3. revisar policy;
4. conservar ambas interpretaciones si la evidencia sigue siendo ambigua;
5. escalar a humano cuando la decisión exceda autonomía.

## Principio maestro

La arquitectura multiagente debe aumentar especialización y control, no multiplicar opiniones.
