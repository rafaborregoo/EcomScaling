# Fase 14 — Contrato base transversal

## Tipo de artefacto
`02-contratos-IA`

## Objetivo

Definir el sobre común que todos los agentes especializados deben respetar.

## Envelope de entrada

```text
request
context
policies
runtime_results
rag_context
experience_context
tenant_context
```

## Envelope de salida

```text
status
result
confidence
missing_information
evidence
risks
next_required_validation
```

## Estados recomendados

```text
COMPLETE
PARTIAL
BLOCKED
NEEDS_VALIDATION
```

## Reglas

- `COMPLETE` no significa autorizado para ejecutar.
- `BLOCKED` debe indicar la causa.
- `NEEDS_VALIDATION` debe identificar qué motor o humano debe validar.
- `PARTIAL` debe indicar exactamente qué parte sí puede utilizarse.
- `confidence` nunca sustituye a un guardrail.
- `evidence` debe conservar referencias, no copiar datos sensibles innecesarios.

## Jerarquía de autoridad

```text
POLICY / COMPLIANCE
>
RUNTIME SOURCE OF TRUTH
>
TENANT CONTEXT
>
EXPERIENCE LEARNING
>
RAG
>
MODEL INFERENCE
```

Esta jerarquía no significa que RAG sea menos importante conceptualmente; significa que un hecho operativo actual debe prevalecer sobre conocimiento general.

## Principio maestro

Todos los agentes deben hablar el mismo idioma estructural aunque realicen tareas distintas.
