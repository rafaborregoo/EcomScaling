# Cierre de auditoría y comienzo de implementación del juez

**Actualizado:** 10 de octubre de 2026  
**Estado de la auditoría:** cerrada como diagnóstico de estado actual.  
**Estado del juez:** integración de código para los 26 agentes; cola durable desplegada en esquema en TEST y producción. Activación visible, calibración y certificación siguen bloqueadas.

## Qué significa el cierre

La auditoría deja de ser la fase activa de trabajo y pasa a ser la línea base documentada para implementar. Contiene el inventario y rúbricas propuestas de los 26 agentes, hallazgos, riesgos, requisitos por agente y el resultado real de la revisión del release gate.

El cierre no certifica la calidad de los agentes. Las fichas que dicen `parcial`, `fallido` o `no verificado` conservan ese estado. En especial, no hay un release gate operativo demostrado en la ruta de promoción actual, las rúbricas aún no están calibradas con consultores y no existe evidencia gold suficiente para activar el juicio visible en producción.

## Implementación entregada en esta fase

- Contratos, rúbricas multidimensionales y cálculo determinista del dictamen para los 26 códigos de agente.
- Evaluador de calibración holdout que exige doble revisión humana, adjudicación cuando hay desacuerdo y cobertura íntegra de criterios; produce acuerdo, error de score, recall crítico y tasa de falsos críticos por agente. Sus pruebas usan datos sintéticos y no certifican la calidad semántica.
- Preflight de coste antes de la llamada al juez: se consulta `pricingFor`, que prioriza `ai_model_prices` y conserva el catálogo como fallback. Un modelo sin precio en ambas fuentes se rechaza como `judge_model_price_unknown` antes de llamar al proveedor.
- Prueba de integración del runtime para los 26 códigos: usa una respuesta de proveedor y una persistencia Supabase simuladas, pero ejecuta el contrato, las evidencias, el scoring y la escritura reales. Comprueba también los cuatro agentes multimodales con bytes adjuntos; no sustituye la adjudicación semántica gold.
- Validación de referencias contra el output y snapshot exactos; recibos de herramientas incompletos y evidencia visual ausente impiden emitir una evaluación afirmativa.
- Persistencia ligada a organización, ejecución y output, con huella SHA-256, idempotencia, versión de rúbrica, tokens, coste y duración.
- Modos `off`, `shadow` y `visible`; `off` por defecto. `visible` solo adjunta el dictamen a la respuesta del runner compartido y nunca reemplaza la aprobación humana.
- Integradas las rutas especializadas A01, A09, A11, A15 y A16 además de los agentes del runner común; los turnos A09 y los snapshots A01/A11 ya congelan su contexto para evaluación.
- Evidencia visual limitada a buckets propios de E-NORA, descargada con límite, tipo MIME permitido y hash SHA-256. URL inválida, evidencia ausente o descarga fallida produce abstención. A16 no puede puntuar legibilidad del render ni coherencia de carrusel sin PNG final y slides vecinos.
- Consulta de resultados en la traza de ejecución para consultores y administradores de plataforma. El navegador no recibe acceso directo a la tabla.
- Feedback por criterio en la traza (`De acuerdo`, `Incorrecto`, `No aplica`, `Corregido`), con motivo y nota opcional. Cada envío queda append-only, idempotente y ligado al juicio/run/organización; solo el usuario que revisó ve sus revisiones en la traza. La tabla no permite escrituras directas ni siquiera al `service_role`, que solo tiene SELECT; la escritura pasa por RPC con autorización de consultor. No modifica prompts ni rúbricas automáticamente.
- Cola privada durable con deduplicación, lease SQL `SKIP LOCKED`, recuperación de leases vencidos, límite de tres intentos y borrado del payload al terminar. `shadow` encola sin esperar al proveedor; `visible` conserva el dictamen en la respuesta. La traza muestra estado, intento y error sin exponer el payload, y se refresca mientras el trabajo sigue pendiente. El worker se inicia al levantar el API si el modo juez está activo.
- Migraciones aplicadas en TEST y producción para juicios, cola durable y feedback protegido, además del cambio para representar costes desconocidos como `NULL`.
- Ejecución real en TEST: A17 terminó con `review`, puntuación 2,2/4 y 7 criterios evaluados. El resultado identificó problemas verificables de evidencia y planificación. El coste, corregido tras detectar que la primera versión lo guardó como cero, se recalcula a partir de los tokens y la tarifa configurada.

## Pendientes que impiden declarar el objetivo terminado

1. Añadir timeout operativo y reconciliación explícita con ejecuciones huérfanas; `shadow` ya usa retorno no bloqueante y la cola recupera trabajos tras caídas.
2. Capturar el render final de A16 y el binding probado por E2E de las imágenes de A15/A23/A26 al artefacto, tienda/cuenta, periodo y fuente exactos.
3. Construir y adjudicar conjuntos gold por agente, medir acuerdo con consultores y fijar umbrales/falsos positivos por severidad.
4. Incorporar preflight determinista para invariantes que no deben depender de opinión probabilística.
5. Implementar el release gate real en la ruta de promoción, con rechazo negativo comprobado en TEST y conservación de la versión activa anterior.
6. Verificar integración de interfaz y API con una ejecución autenticada, más pruebas E2E de permisos, fallos del proveedor y aislamiento por organización.
7. Mantener `off` por defecto hasta completar esos puntos y aprobar coste, latencia y calibración.

## Verificación de esta entrega

- Pruebas de contrato y scoring del paquete AI: 8/8 correctas. La cobertura valida en los 26 códigos los controles comunes, criterios específicos, instrucciones/pesos y la inclusión íntegra de cada rúbrica en el prompt; incluye el gate determinista A16.
- Revalidación del 10-oct-2026: contrato/rúbricas AI 8/8, calibración AI 3/3, API juez 10/10 (incluye runtime simulado de los 26 agentes, bloqueo sin tarifa, tarifa viva, despacho shadow no bloqueante y recuperación de un job multimodal), gate determinista 4/4, typecheck API y web, build API y `git diff --check` correctos.
- Feedback: 4/4 pruebas, incluidas validación, rechazo por scope/rol y 14/14 pruebas combinadas de feedback + runtime juez; typechecks API/web y build API correctos. TEST y producción confirman RLS, sin lectura/escritura directa para `authenticated`, RPC disponible solo a `authenticated` (no `anon`) y `service_role` solo con SELECT; falta E2E autenticada con una cuenta consultora.
- Suite completa del paquete AI reejecutada después de añadir el calibrador: 246/246 pruebas correctas; build de `@e-nora/ai` y typecheck API/web correctos.
- TEST: evaluación real persistida para A17; seis intentos fallidos también quedaron registrados como errores, lo que permitió corregir referencias y no borrar la evidencia de fallos. Resultado final: `review`, 2,20/4, 7 criterios, coste `$0,000898`, 8.876 ms.
- TEST y producción: en tablas de juicios y cola, RLS activado; `authenticated` no tiene SELECT ni EXECUTE del claim y `service_role` conserva permisos de worker.
- Lint puntual no disponible: el repo usa ESLint 9 pero no contiene `eslint.config.*` en este checkout.

El inventario por ficha está en [auditoría por agente](./AUDITORIA_JUEZ_AGENTES.md), el recorrido de código de cada catálogo en [cobertura por agente](./COBERTURA_JUEZ_26_AGENTES.md) y la arquitectura/gates/dataset en [plan de implementación](./PLAN_JUEZ_AGENTES.md). Esta nota marca el cierre de la auditoría como fase y el cambio a implementación/validación de los pendientes listados.
## Revalidación posterior: gate de release y estado actual (10-oct-2026)

La auditoría conserva su cierre como diagnóstico, pero los puntos de implementación evolucionaron desde su primera versión. El gate de base de datos ya aplica `promote_agent_version` y triggers de activación en TEST y producción. Se probaron negativamente ambos proyectos: activar una versión sin evidencia candidate-pinned se rechaza y la versión permanece inactiva. El control comprueba hash del manifiesto, release eligibility y cada caso live contra código/versión/hash, split gold/holdout y mínimos requeridos.

El endpoint/UI de candidatas también verifica estas atestaciones antes de habilitar la acción; los estados `passed` históricos por sí solos no bastan. Build AI, contrato live 9/9, runner API 10/10, release admin 4/4 y typecheck API pasaron en esta revisión.

Quedan pendientes: preflight de CI contra migraciones privilegiadas que activen versiones; provider operativo que ejecute cada candidata aislada; gold/holdout humano suficiente para 26 agentes; capturas/render/binding E2E visual; despliegue del código y pruebas autenticadas de extremo a extremo. `AI_JUDGE_MODE` sigue `off`, por lo que no se afirma calidad calibrada ni rollout visible.
## Preflight de migraciones de release (10-oct-2026)

`db:push` ahora detecta migraciones que activan `agent_versions` directamente y, antes de ejecutarlas, verifica contra la base destino que el trigger está habilitado, que la función de evidencia valida pinning/código/versión/hash/holdout y que `promote_agent_version` usa ese gate. `scripts/verify.mjs` incorpora una guarda estática: migraciones posteriores al baseline candidate-pinned no pueden activar versiones con DML directo; deben usar la RPC protegida. La detección ignora comentarios, strings SQL y el cuerpo de funciones, y revisa bloques DO.

Verificación: 5/5 pruebas del preflight; guarda aplicada a 498 migraciones existentes; sintaxis de los scripts y `git diff --check` correctos. Este control cubre `db:push` del repositorio y `npm run verify`; el trigger SQL continúa siendo la protección efectiva ante otras rutas privilegiadas. No se cambió el estado de las bases en esta entrega. Falta incorporar el preflight en el CI/deploy real y demostrar que todas las rutas de despliegue lo ejecutan.

## Runner candidato integrado — 10-oct-2026

La ejecución candidate-pinned ya está conectada en código y en el panel de fixtures. `POST /v1/admin/agent-release-eval-fixtures/run` exige `platform_admin`, carga los fixtures inmutables seleccionados y verifica agente, rúbrica y dataset antes de ejecutar. El panel permite elegir versión candidata y fixtures del mismo agente, ejecutar la suite y ver el resultado por caso, coste, latencia y elegibilidad.

El proveedor vuelve a comprobar el manifiesto/prompt fijado, usa el modelo y prompt de la versión exacta y únicamente declara herramientas que tienen replay. El candidato recibe parámetros, alcance y fuentes disponibles; no recibe constraints, grabaciones ni resultados esperados. Una discrepancia en argumentos, orden, hash o llamadas omitidas hace que el caso no pueda aprobar. Se rechaza el modelo sin precio conocido antes de llamar al proveedor y se limita cada turno candidato a 0,25 USD y cada juicio a 0,03 USD.

Los contratos especializados v3 (incluidos A19 arquitecto y revisión) y los casos visuales sin bytes/render final quedan `no_evaluable`; no se presentan como aprobados. La suite de release necesita 10 casos de calibración y 3 de release por agente y no declara elegibilidad con una muestra menor. Esto deja 20 agentes de contrato v1 con ejecución textual disponible; la certificación de todo el catálogo sigue pendiente de soporte específico para los contratos v3, evidencia multimodal vinculada y datos gold/holdout humanos adjudicados.

Verificación local: `npm run verify` 19/19; paquete AI 252/252; API `test:unit` 1.091/1.091; typecheck API y web; build API; `git diff --check`. El test de proveedor cubre schema no soportado, cambio de huella, agente visual sin bytes y que el candidato no ve información de evaluación. El panel muestra la elegibilidad de la evaluación; la promoción continúa bajo el gate SQL.

No se ejecutó una campaña contra un candidato real, no se desplegó el código, no se activó `AI_JUDGE_MODE` y no se aplicaron migraciones en esta verificación. Los datos gold/holdout existentes siguen siendo insuficientes para certificar agentes.