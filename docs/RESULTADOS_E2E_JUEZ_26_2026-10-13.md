# Resultados de ejecuciones reales del juez (13 oct 2026)

## Alcance y condiciones

Se ejecutaron los cuatro perfiles que faltaban en el registro de TEST usando llamadas reales a los proveedores y `AI_JUDGE_MODE=visible`. Las ejecuciones utilizaron organizaciones sintéticas creadas por cada harness, con borrado al terminar. Los límites de generación fueron de 0,15 USD por ejecución; no se aplicaron datos ni acciones sobre clientes existentes. El paquete `@e-nora/ai` se reconstruyó antes de validar los resultados v7, porque inicialmente `dist` seguía en v6 aunque el código fuente estaba en v7.

Los dictámenes observados en la consola se consultaron antes de que cada harness borrara la organización sintética. Por diseño, sus filas no quedan como evidencia durable ni como casos gold.

## Resultados

| Perfil | Ejecución | Dictamen v7 | Hallazgo operativo | Resultado de la auditoría |
|---|---|---|---|---|
| A01 Analista de llamadas | 5 escenarios (`tareas_claras`, `sin_tareas_accionables`, `tarea_sin_responsable`, `audio_deficiente`, `varios_interlocutores`), repetidos después de corregir el gate del harness; coste agregado observado: 0,0044 USD. | 1 `passed`, 3 `review` y 1 error `judge_provider_or_validation_failed` (`sin_tareas_accionables`). | El juez identificó problemas de atribución, responsables sin asignación y fidelidad de turnos. El harness antes podía terminar sin fallos aunque el dictamen fuese error; ahora lo convierte en fallo bloqueante. Un fallo de proveedor se reprodujo en dos corridas. | Ejecución completa; **no certificada** por error intermitente del juez y un fallo heurístico de interlocutores.
| A02 Monitor de negocio | `stock_roto`; coste 0,117206 USD; latencia total 53.980 ms. | `review`, 3,03/4, v7. | El agente detectó producto y cantidades (40 vendidas, 2 disponibles), pero calificó urgencia alta/crítica con una sola jornada de venta y sin cobertura calculable. El juez puntuó incertidumbre 3 y priorización 2. Superó el límite de latencia de 45.000 ms. | Ejecución completa; **no certificada** por latencia y sobrepriorización que requiere revisar salida/prompt.
| A08 Gestor de conocimiento | `catalogo_vacio`; ejecución final coste 0,003154 USD; latencia 16.723 ms. | `review`, 3,16/4, v7. | Tras dar prioridad al resumen compacto de cobertura antes de la lista documental, el agente informó 316 globales, 0 privados, 80/316 de muestra y sus límites. El harness ahora contrasta estos valores con el snapshot y los checks duros pasaron. El juez pide calibrar una afirmación de paginación/coverage y el alcance de la muestra semántica; se observaron además errores transitorios del proveedor en dos intentos anteriores. | Ejecución completa; **no certificada** por revisión de fidelidad/alcance y fallos intermitentes del juez.
| A19 Revisión del Camino | Dos ejecuciones sobre Camino sintético sin fases, hitos ni objetivo numérico; la validación final fue tras reconstruir `dist` v7. Generación 0,001447 USD y 12.328 ms. | `blocked`, 3,12/4, v7. | El juez marcó como fallo crítico `progress_measurement`: la salida combina ventana de revisión de tres días con métrica autorizada MTD de un día y no reconcilia ambos periodos. La revisión no modificó el Camino, que siguió activo en versión 1. | Ejecución completa; hallazgo de rúbrica confirmado y bloqueo correcto.

## Cambios y controles añadidos

- Los harnesses A01, A02 y A08 fallan ahora si el dictamen está ausente o su estado es `error`; `review` y `blocked` siguen siendo resultados de calidad, no fallos de transporte.
- A08 entrega primero contadores de cobertura/telemetría y después la muestra de documentos, para que el límite de contexto no elimine hechos de mayor prioridad. El harness A08 compara conteos y muestra con el snapshot congelado.
- Se corrigió el diagrama de arquitectura: `shadow` va a cola/worker asíncrono; `visible` espera el juez en la petición del agente.
- El build de `packages/ai` ahora materializa v7 en `dist`; la ejecución previa que mostró v6 no se contabiliza como prueba de v7.

## Estado de certificación

Esta tanda completa la cobertura de ejecución puntual de los cuatro perfiles que faltaban: 26/26 claves activas han tenido al menos una ejecución real del runtime/juez registrada en el periodo de auditoría. No demuestra que los 26 estén certificados ni que todas las rutas UI/HTTP, retries, streams y artefactos visuales se hayan ejercitado.

La consulta actual confirma TEST con 66 dictámenes durables de 22/26 códigos, PROD con 0 dictámenes, y ambos entornos con 0 casos `agent_judge_eval_cases` y 0 adjudicaciones. Los harnesses eliminan sus organizaciones sintéticas y, con ellas, los nuevos dictámenes; por tanto, el total durable de TEST no aumenta. Siguen pendientes los casos de referencia anonimizados, revisión doble independiente, adjudicación, holdout congelado, métricas por agente/segmento y gates de promoción. El juez permanece sin certificación de calidad y no se debe habilitar como señal visible para clientes.
