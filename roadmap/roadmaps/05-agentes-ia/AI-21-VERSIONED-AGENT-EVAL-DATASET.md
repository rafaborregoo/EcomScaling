# AI-21 - Dataset versionado de evals de agentes

## Estado

`implemented`: `AGENT_EVAL_DATASET_VERSION` identifica el dataset
`2026-08-26.v1` y contiene un fixture por cada uno de los diez agentes activos.

## Escenarios cubiertos

- Shopify disponible con fuente tenant-bound y afirmacion grounded.
- Conector solicitado ausente: abstencion con confianza baja y warning.
- Hechos estructurados consistentes con las afirmaciones.
- Playbook/RAG adversarial tratado como contenido no confiable y neutralizado.

`runAgentEvalDataset` no crea empresas, no llama a proveedores y no accede a
Supabase. Es la base reproducible para añadir despues una capa de evaluacion
con modelo y dataset aprobado, sin cambiar los criterios de seguridad.
