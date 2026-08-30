# ADR — Proveedores, orquestación, RAG y fine-tuning

Estado: implementado parcialmente y verificado (2026-08-26)

## Decisión

EcomScaling incorporará LangChain, LangGraph y LangSmith de forma selectiva, detrás de
adaptadores propios y sin exponer sus tipos en el API ni en la base de datos. La migración será
incremental: el runtime actual sigue siendo la referencia de comportamiento hasta que el nuevo
camino supere los mismos tests y gates. Los agentes usan actualmente:

- SDK directo de Anthropic como proveedor principal.
- SDK directo de OpenAI como fallback con el mismo contrato.
- Contratos propios tipados para prompts, tools, presupuestos, outputs y aprobaciones.
- Supabase/Postgres/pgvector y `knowledge_search` como capa de conocimiento multi-tenant.
- Evaluaciones y fixtures propias para replay, prompt injection, retrieval y validación de outputs.

La orquestación de negocio queda en el backend y en los workers durables existentes. El modelo no
decide el tenant, los permisos, la aprobación ni los límites de coste.

## Cómo se usarán LangChain, LangGraph y LangSmith

LangChain se usará como capa de integración de modelos, mensajes, tools y agentes donde reduzca
trabajo repetido. LangGraph será la capa de orquestación para flujos con estado, reintentos,
aprobación humana, ejecución durable y streaming. LangSmith será la capa opcional de trazas,
datasets y evaluaciones; no será una dependencia necesaria para que el producto funcione.

La adopción no sustituye las garantías propias: tenant, permisos, aprobación, límites de coste,
RAG multi-tenant, contratos Zod, idempotencia, auditoría y redacción de secretos siguen siendo
responsabilidad de EcomScaling. Las trazas externas se optarán por entorno y se enviarán con
identificadores pseudonimizados, nunca con tokens, secretos ni payloads sensibles sin redacción.

El primer piloto recomendado es un flujo de diagnóstico no mutante: entrada canónica -> retrieval
RAG -> tools de lectura -> síntesis estructurada -> evaluación. Se comparará en paralelo con el
runtime actual antes de activar cualquier escritura o automatización.

Se reabrirá esta decisión solo si aparece una necesidad concreta y medible, por ejemplo:

1. un proveedor nuevo que reduzca significativamente el código de integración;
2. workflows durables con branching/retries que superen claramente los workers actuales;
3. una mejora demostrada en latencia, fiabilidad o coste;
4. observabilidad interoperable que no permita mantener los contratos actuales.

Si se adopta, será detrás de un adapter propio; nunca se expondrán tipos de LangChain, LangGraph o
LangSmith al API o a la base de datos. La decisión queda condicionada a paridad de tests, latencia,
coste, aislamiento multi-tenant, recuperación ante fallos y capacidad de desactivar la integración.

## RAG y fine-tuning

La estrategia es híbrida, pero por fases:

1. prompts estructurados en nueve secciones (`ROLE`, `GOAL`, `CONTEXT`, `INPUT`, `RULES / CONSTRAINTS`,
   `TOOLS`, `OUTPUT`, `FAILURE BEHAVIOUR`, `EXAMPLES`);
2. RAG gobernado para metodología, conocimiento de la organización y evidencia contextual;
3. tools para datos vivos y acciones, separados del conocimiento recuperado;
4. evaluaciones golden, retrieval metrics, trazas y feedback humano;
5. fine-tuning únicamente cuando exista un dataset suficiente, consentido y versionado, con una
   mejora medida frente al baseline.

Fine-tuning no sustituye RAG: no sirve para mantener datos cambiantes de una tienda ni para resolver
autorización. Antes de entrenar se exigirá dataset de calidad, separación por tenant, revisión de
privacidad, baseline reproducible y rollback de modelo/prompt.

## Evidencia actual

- `packages/ai/src/index.ts` implementa los loops Anthropic/OpenAI, el contrato de prompt, tools,
  outputs y `VoyageEmbeddingProvider`.
- `apps/api/src/ai-runtime.ts` compone contexto, controla permisos, presupuesto, auditoría y RAG.
- `supabase/migrations/20260718110000_db_11_rag_conocimiento.sql` define la búsqueda de conocimiento.
- `packages/ai/src/index.test.ts` cubre el contrato de prompts y replay de tools.

La activación completa sigue requiriendo claves de proveedores, datos reales y evaluación externa;
esta decisión no declara esos bloqueos como resueltos.

## Implementación inicial del stack

La primera implementación queda en `packages/ai/src/agent-orchestration.ts` y
`packages/ai/src/langsmith-observability.ts`. El runtime de API ya envuelve cada turno de agente con
el adaptador opcional de LangSmith. La configuración requiere expresamente `LANGSMITH_TRACING=true`
y `LANGSMITH_API_KEY`; por defecto no se capturan payloads y el producto funciona sin el servicio
externo. El grafo inicial solo hace retrieval, síntesis y validación de lectura.

La selección operacional se controla con `AI_ORCHESTRATION_MODE`: `direct` es el valor por defecto y
`langgraph` es un opt-in de shadow/piloto. El modo LangGraph envuelve el turno ya protegido, por lo
que no puede saltarse presupuesto, fallback, validación, tenant ni aprobación humana.

Actualización 2026-08-26: el adaptador usa `RunnableLambda` de `@langchain/core` como boundary de
ejecución dentro del grafo LangGraph. Los tipos de LangChain siguen encapsulados en `packages/ai`;
el API y la base de datos solo reciben los contratos propios de EcomScaling.

Verificación 2026-08-26: piloto LangGraph 2/2, adaptador LangSmith 2/2 y
configuración de entorno 20/20. Las claves de LangSmith siguen siendo
opcionales; sin ellas el runtime funciona localmente sin enviar trazas.
