# AI-16 — RAG y Playbook inteligente: frontera anti-prompt-injection

Estado: implementado en código local; pendiente únicamente la activación/verificación remota de migraciones cuando Supabase permita operar sobre el proyecto.

## Objetivo

El conocimiento propio de la organización, la metodología global, los playbooks importados, las respuestas de conectores y los resultados de tools son evidencia no confiable. Nunca pueden convertirse en un canal alternativo de instrucciones para el modelo.

## Controles cerrados

- `packages/ai/src/untrusted-context.ts` es la frontera única y reutilizable para serializar bloques RAG/playbook y resultados de tools.
- Delimitadores explícitos (`FUENTE_NO_CONFIABLE`, `datos_recuperados`, `tool_result_no_confiable`).
- Neutralización de patrones de prompt injection directa e indirecta en español e inglés.
- Límite de tamaño por bloque y por contexto para evitar abuso de tokens y degradación CPU/I/O.
- Política runtime que prohíbe cambiar rol, reglas, tenant, permisos, herramientas, aprobaciones, formato o revelar prompts/secretos.
- La organización, la audiencia, la tienda y las tools se fijan en backend; ningún documento puede modificarlas.
- Los resultados de `search_knowledge` y de cualquier tool vuelven a cruzar la frontera antes de llegar al modelo en los ciclos Anthropic y OpenAI.
- El playbook debe entrar como evidencia versionada y con provenance; no se interpreta como system prompt.

## Criterio de aceptación

Los tests adversariales deben fallar si un documento interno o playbook intenta ignorar instrucciones, revelar el prompt, llamar tools, saltarse aprobación o cambiar el rol. Debe conservarse el aislamiento por organización y audiencia ya garantizado por los RPC de conocimiento.

## Pendiente antes de producción

- Ejecutar evals de regresión con corpus real anonimizado y ataques multilingües/encoded.
- Medir `blockedPatterns` y truncados en observabilidad sin registrar contenido sensible.
- Verificar en Supabase remoto la migración híbrida y los advisors; el bloqueo actual es de permisos MCP, no de diseño local.
