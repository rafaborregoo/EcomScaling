# AI-08 - Outcomes de recomendaciones

> Correccion documental 2026-08-21: AI-08 deja de aparecer como una fase sin contrato.
> El dominio actual ya permite enlazar una recomendacion con su salida IA y la tarea aprobada;
> la medicion numerica queda preparada pero no se activa hasta que cada outcome tenga un KPI
> canonico y una ventana de medicion definida por producto.

## Estado

- **Estado real:** `contract_ready`
- **Dependencias:** AI-10, AI-12, DB-07, AI-07
- **Bloqueador externo de producto:** definir por KPI qué significa éxito, baseline, ventana,
  atribución y quién puede cerrar un outcome.
- **Regla:** ausencia de KPI o datos de canal no se convierte en cero, éxito ni dato simulado.

## Contrato preparado

El vínculo mínimo reutiliza entidades existentes y no crea una segunda representación:

1. `agent_outputs.id` identifica la recomendación original y conserva sus fuentes, periodo,
   confianza y `proposed_writes`.
2. `agent_approvals` registra la decisión humana (`approved`/`rejected`) y su motivo.
3. Una tarea materializada guarda `metadata.agent_output_id`, que permite enlazar la acción
   aprobada sin duplicar la propuesta dentro de `tasks`.
4. El futuro registro de outcome debe referenciar `organization_id`, `agent_output_id` y,
   cuando exista, `task_id`; nunca aceptar ids de otra organización.

## Forma futura del outcome

La migración futura deberá ser aditiva y tenant-scoped, con estos campos mínimos:

- `outcome_type` y `status` (`unmeasured`, `measuring`, `observed`, `invalidated`);
- `baseline` y `observed` como snapshots de métricas reales, con `metric_key`, valor, moneda,
  periodo y `source_ref`;
- `measurement_window`, `attribution_method`, `created_by` y `closed_by`;
- `agent_output_id`, `task_id` opcional e `idempotency_key` único por organización;
- RLS, grants mínimos, auditoría y política de retención iguales al resto del dominio IA.

## Criterios de activación

- Definir KPI y baseline por tipo de recomendación (stock, tarea operativa, marketing, etc.).
- Añadir migración y RPC tenant-scoped solo después de aprobar ese contrato de producto.
- Mostrar `not_measured`/`insufficient_data` en la UI cuando falten canales o ventana suficiente.
- Calcular before/after desde métricas existentes, nunca desde valores introducidos por el modelo.
- Añadir tests de aislamiento, idempotencia, atribución y ausencia de datos antes de habilitarlo.
