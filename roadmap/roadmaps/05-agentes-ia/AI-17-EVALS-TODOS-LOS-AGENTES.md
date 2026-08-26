# AI-17 — Evals de todos los agentes

Estado: matriz offline implementada y verificable sin claves; evals live con proveedor quedan preparadas para ejecutarse cuando existan credenciales.

## Cobertura

La matriz cubre todos los agentes del catálogo: A01, A02, A03, A04, A05, A06, A07, A08, A09 y A11. Los agentes preparados (A03/A05/A07) se evalúan explícitamente para garantizar abstención honesta hasta que llegue su conector. Cada agente tiene casos de calidad, abstención por falta de datos, prompt injection directa/indirecta, aislamiento de tenant y límites de rendimiento.

## Estrategia de fixtures

No se crea una empresa real en producción para probar. `runOfflineAgentEvalSuite` usa fixtures sintéticas y no escribe en Supabase. Los evals live existentes pueden crear organizaciones efímeras con el prefijo `eval-` únicamente en un entorno de evaluación autorizado; antes de ejecutarlos deben existir claves de embeddings/modelo y una base aislada.

## Gates

- Ningún agente activo puede carecer de un caso por categoría.
- El contenido de RAG/Playbook que intenta dar órdenes debe ser neutralizado antes del modelo.
- La falta de datos debe producir abstención y warning, nunca cifras inventadas.
- El tenant, las tools, el presupuesto y la aprobación permanecen fijados por backend.
- La activación live queda bloqueada si falla cualquier caso offline o si no existe evidencia de proveedor.
- A08 usa desde AI-18 la plantilla canónica de nueve secciones, igual que el resto de agentes activos.
