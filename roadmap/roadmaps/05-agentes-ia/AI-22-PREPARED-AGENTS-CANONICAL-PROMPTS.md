# AI-22 — Prompts canónicos de agentes preparados

## Objetivo

Dejar A03 (adquisición), A05 (estrategia de campañas) y A07 (rendimiento de
contenido) con definiciones, versiones y prompts de nueve secciones antes de
que existan credenciales o cuentas reales de Meta/Instagram.

## Implementación

La migración `20260826120000_ai_22_prepared_agent_prompts.sql` crea las
definiciones, prompts v1 y versiones declarativas de futuras tools. Las nueve
secciones son ROLE, GOAL, CONTEXT, INPUT, RULES / CONSTRAINTS, TOOLS, OUTPUT,
FAILURE BEHAVIOUR y EXAMPLES.

Los prompts incorporan abstención por falta de conector, separación entre datos
Shopify y atribución de Meta, aprobación humana, alcance tenant-bound y defensa
contra instrucciones incrustadas en RAG/Playbook/tool outputs.

## Gate de activación

Definición y versión quedan `is_active=false` hasta que existan implementación
real de las tools, scopes aprobados, cuenta de validación, pruebas de contrato y
evaluación live o shadow con dataset versionado.

## Evidencia

`agent-prepared-prompts.test.ts` verifica la presencia de los tres agentes, las
nueve secciones y el estado inactivo. Las evals offline generales siguen
cubriendo los diez agentes del catálogo.
