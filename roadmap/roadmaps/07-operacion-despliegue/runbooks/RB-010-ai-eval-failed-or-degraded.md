# RB-010 - Evals IA fallidas o agente degradado

## Sintoma

El release gate rechaza una versión de agente, la evaluación `shadow/live` cae
por debajo de los umbrales, aumentan las abstenciones inesperadas, aparecen
hallazgos de prompt injection o un proveedor entra en circuito abierto.

## Impacto y severidad

**SEV-2** si afecta a varias organizaciones, expone datos, produce
recomendaciones sin evidencia o deja un agente operativo sin controles.
**SEV-3** si sólo falla una versión candidata en evaluación offline/shadow y la
versión activa sigue protegida.

## Comprobaciones iniciales

1. Identificar `agent_code`, `agent_version_id`, dataset y modo (`offline`,
   `shadow` o `live`) del fallo. No tratar una evaluación sin `traceId` y
   evidencia como válida.
2. Revisar por organización, agente y versión: `status`, score de grounding,
   abstención, seguridad, tenant, latencia, coste y `failure_reason` en la
   evidencia AI-26/AI-31.
3. Consultar el `traceId` en LangSmith sólo si está habilitado; los payloads y
   secretos deben permanecer redactados. Si no existe traza, conservar el
   identificador local y marcar la observabilidad como incompleta.
4. Comprobar el estado del circuit breaker del proveedor y si hubo timeouts,
   reintentos agotados o errores 429/5xx. No aumentar retries ni presupuesto
   como primera medida.

## Contención segura

1. No activar la versión rechazada. El `release-gate.ts` debe seguir siendo la
   barrera; no se fuerza la activación desde SQL ni desde la UI.
2. Si una versión ya activa se degrada, volver a la última versión que tenga
   evidencia aprobada y mantener aprobación humana para cualquier escritura
   propuesta.
3. Si el problema es de proveedor, conservar el circuito abierto y responder
   con degradación honesta/abstención; no sustituir datos ausentes por valores
   inventados.
4. Si el hallazgo es prompt injection, aislar el caso, preservar el documento o
   resultado no confiable como evidencia redactada y bloquear la versión hasta
   que pasen los casos directos e indirectos del dataset.

## Diagnóstico

- **Grounding bajo o citas inconsistentes:** revisar ingestión, filtros de
  organización, periodo y `reference`; no corregirlo con prompt sin añadir un
  caso de evaluación.
- **Abstención o datos ausentes:** confirmar que el agente recibió el estado
  `unavailable` del conector y que no simuló métricas de Meta/Klaviyo/Shopify.
- **Seguridad/tenant fallida:** detener la versión inmediatamente y abrir un
  incidente de seguridad; revisar `organization_id`, herramientas y RAG.
- **Latencia/coste alta:** revisar fan-out I/O, timeout, backoff, caché y
  circuit breaker antes de ampliar límites.

## Recuperación y validación

1. Corregir código, contrato, prompt o dataset en una nueva versión; conservar
   la versión anterior para rollback.
2. Ejecutar la matriz offline completa de los diez agentes.
3. Exigir cobertura completa y cero fallos críticos en el release gate.
4. Ejecutar `shadow` con proveedor real cuando existan credenciales, comparar
   contra umbrales y revisar una muestra humana antes de `live`.
5. Registrar score, fallos, coste, latencia, abstención y `traceId`; declarar
   recuperación sólo cuando la evidencia sea reproducible.

## Escalado

Escalar al responsable de seguridad si falla tenant, anti-injection o aparece
una salida sin evidencia. Escalar al responsable de plataforma si el circuito
del proveedor permanece abierto o los timeouts/reintentos se agotan de forma
global. Escalar a producto si el agente debe permanecer desactivado.

## Evidencias a conservar

Dataset y versión del agente, resultados por caso, evidencia AI-26/AI-31,
`traceId` redactado, estado del circuito, logs correlacionados y decisión de
rollback. No conservar prompts completos, tokens ni payloads de cliente si no
son necesarios para el incidente.
