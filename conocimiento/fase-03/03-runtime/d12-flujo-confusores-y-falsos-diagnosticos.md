# D12 — Flujo runtime de confusores y falsos diagnósticos

Fuente principal: `02-contratos-IA/D12-contrato-de-confusores-y-falsos-diagnosticos.md`.
Este flujo convierte el contrato adversarial en una pasada reproducible sobre un
caso abierto. D12 ataca la interpretación completa; no compite con D08 por la
mejor causa.

## Contrato operativo

Entrada mínima: `diagnostic_cases` con métrica, alcance, ventana de análisis,
ventana de comparación y confianza actual. El motor consulta las señales de
D05, los eventos, rupturas y segmentos de mix de D02, y los pedidos Shopify
cuando sirven para contar muestra. Toda fila se filtra por organización y,
cuando el caso lo declara, por tienda.

Salida de una pasada: una revisión vigente en `diagnostic_robustness`, sus
`diagnostic_confounders`, `confounder_tests`, la puerta
`metric_comparability_gates`, todos los `mandatory_confounder_checks` de la
familia y al menos un `sensitivity_analyses`. Las pasadas anteriores se
conservan como `superseded`.

## Secuencia

1. Seleccionar casos `open` o `investigating` de la organización. Los casos
   concluidos no se reescriben desde D12.
2. Resolver la familia diagnóstica desde la métrica. Si la métrica no tiene un
   mapeo conocido, usar `data`, dejando el límite visible en los checks.
3. Cargar señales de la misma métrica y de una ventana que se solape con el
   caso. Conservar `data_confidence`, `low_sample`, `baseline_conflict` y
   `sample_size`; no convertir un campo ausente en evidencia positiva.
4. Cargar eventos de contexto y rupturas de comparabilidad que se solapen con
   la ventana y coincidan con la tienda. Cargar también el último assessment
   de D02 y sus segmentos de mix.
5. Calcular la muestra de pedidos no test de las dos ventanas cuando existe
   `processed_at`. El conteo solo aporta suficiencia de muestra; no prueba una
   explicación.
6. Resolver las cinco preguntas de comparabilidad: misma definición, mismo
   alcance, misma lógica temporal, misma moneda y mismo filtro de estado.
   `comparable` exige cinco `yes`; un solo `no` produce `not_comparable`.
7. Crear un candidato por cada check obligatorio de la familia. Un candidato
   sin evidencia queda en `candidate`/`speculative` y no puede debilitar por sí
   solo una lectura fuerte.
8. Promover `partial_period` si las duraciones de las ventanas difieren. La
   promoción exige evidencia de las fechas y se marca material cuando invalida
   la comparación.
9. Traducir eventos observados a tipos cerrados de confusor (`promotion`,
   `launch`, `price_change`, `inventory_change`, `external_event`, etc.). Un
   evento registrado puede ser `supported`; una posibilidad externa sin fuente
   sigue siendo `plausible`.
10. Traducir rupturas de tracking, definición, moneda, schema o tecnología.
    Las rupturas que afectan la métrica son evidencia de medición; tracking,
    definición y moneda pueden ser decisivas y materiales.
11. Promover `sample_size` cuando D05 declara muestra baja. No se calcula ni se
    inventa un umbral que el contrato no define.
12. Comparar pesos y rendimiento por segmento. Si cambia el peso y el
    rendimiento within-segment permanece estable, registrar el confusor de
    composición con `masking_effect`; esto protege también contra falsos
    negativos.
13. Ejecutar la biblioteca red team determinista. La prioridad es medición,
    después composición y después eventos; si no hay evidencia observable se
    escribe igualmente la mejor contraexplicación posible y el dato que la
    resolvería.
14. Ejecutar todos los checks mínimos de la familia. `cohort_maturity` queda
    `not_possible` cuando no hay una fuente de cohortes maduras; cada estado
    no ejecutado lleva su motivo.
15. Ejecutar sensibilidad con escenario bajo y alto. Si mover la comparabilidad
    cambia la conclusión, escribir `diagnosis_changes` y la nota de impacto.
16. Determinar supervivencia: `requires_revision` ante distorsión de medición
    crítica, `weakened` ante materialidad, y
    `survives_with_limitations` ante evidencia soportada, sensibilidad o checks
    no posibles. Solo la ausencia de esos factores permite `survives`.
17. Reducir confianza cuando la revisión debilita la lectura y, si requiere
    revisión, dejar `revision_triggered` y `reopened_blocks` (`D06`–`D09`). D12
    no fuerza supervivencia ni cierra causas.
18. Persistir la revisión y sus hijos comprobando cada error. Borrar solo los
    checks y la puerta reemplazables de la pasada anterior, pasar la revisión
    vigente a `superseded`, insertar la nueva y verificar las filas escritas.

## Idempotencia y límites

La idempotencia se define por una nueva revisión histórica: no hay dos filas
`current` del mismo caso, pero las pasadas anteriores siguen auditables. Las
fuentes ausentes se expresan como `unknown` o `not_possible`; nunca se rellenan
con especulación, benchmarks o umbrales inventados. La LLM puede redactar una
explicación después de esta pasada, pero no puede promover un confusor,
invalidar un check determinista ni cambiar el estado de supervivencia.

La verificación operacional requiere sembrar un caso, un evento, una ruptura y
datos de mix en el proyecto de tests; ejecutar dos pasadas; contar las filas de
las seis tablas; y borrar la semilla comprobando cero filas. Esa pasada se hizo
el 2026-09-16 contra el staging documentado usando `.env.local`; `test:remote`
usa ese mismo fichero desde el 2026-09-23 (`.env.tests` apuntaba a un proyecto
que ya no existe).
