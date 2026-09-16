# F3/D14 — Flujo runtime de salida diagnóstica y validación

## Entrada y frontera

D14 recibe las filas actuales de D09, D10, D11, D12 y D13 más la evidencia concreta del caso. No diagnostica de nuevo, no recomienda acciones y no calcula prioridad. `packages/contracts/src/output.ts` compone el resumen calibrado y ejecuta las reglas puras; `apps/api/src/diagnostic-output-engine.ts` hace la lectura/escritura.

## Secuencia atómica

1. Se carga el caso dentro del `organization_id` autorizado junto con causa raíz, constraint, severidad, robustez adversarial, temporalidad, hipótesis, `diagnostic_evidence` y claims de confianza.
2. Se crea el `diagnostic_snapshot` con rangos, versiones de reglas/modelo/contrato y límites de reproducibilidad. Sin evidencia y metadatos suficientes, el snapshot se marca no reproducible y la salida no puede ser final.
3. El motor puro compone `diagnostic_output_record`: resumen, confianza y lenguaje de usuario salen de `confidence_level`; nunca se redacta una certeza aparte.
4. Se ejecutan exactamente los once validadores: structural, semantic, causal, evidence, confidence, severity, temporal, confounder, scope, contradiction y output integrity.
5. La salida se inserta inicialmente como `invalid_output` o, si pasa el gate, como `finalized_valid`. El gate exige sus doce condiciones y `handoff_ready` solo puede abrirse por esa puerta.
6. Se persisten ledger de evidencia (incluida la contradictoria), validaciones y transición. Una nueva combinación material crea una versión nueva, enlaza `supersedes/superseded_by` y no muta el historial.
7. Los retries son idempotentes por referencias de componentes actuales; un caso sin novedades no crea otra versión. Los errores técnicos quedan separados de `insufficient_data`.

## Visibilidad

`/v1/consultant/diagnostic-outputs` es la lectura administrativa con salida, snapshot, ledger y validadores. El panel de consultor muestra la completitud, finalización, confianza, evidencia, errores y reproducibilidad. La vista de usuario queda limitada por `visibility` y no recibe trazas internas ni datos sensibles.

## Verificación

La ruta pura prueba salida incompleta, lenguaje calibrado y evidencia contradictoria. La verificación real con `.env.local` sembró un caso y seis señales, ejecutó D13 y D14, comprobó una salida y los 11 validadores, observó `invalid_output` por ausencia legítima de causa/evidencia, y borró todo el árbol: cleanup confirmado a cero en `kopcblejsxpkxoykldyh`.
