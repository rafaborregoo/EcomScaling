# Entrega técnica IMP-00, IMP-01 y preparación de IMP-10

Fecha: 1 de noviembre de 2026, Europe/Madrid. Alcance: completar las piezas parciales de inventario, medición compartida y controles iniciales de entrega. Este documento sustituye el estado operativo de los dos avances anteriores; sus snapshots se conservan como evidencia histórica.

Actualización: [la validación del 2 de noviembre](VALIDACION_AISLADA_Y_ESTADO_2026-11-02.md) acredita los resultados del candidato aislado y el estado posterior del repositorio y producción. El parche histórico ya está incorporado al repositorio; no debe reaplicarse sobre HEAD actual.

## Estado que se puede acreditar

| Bloque | Resultado de esta entrega | Condición pendiente para su cierre operativo |
|---|---|---|
| IMP-00 | Inventario técnico contrastado: agentes, herramientas, migraciones, funciones y revisiones desplegadas. Historial remoto recuperado o identificado como no disponible | Mantener la excepción del original SQL no conservado; acordar una reconciliación antes de modificar el historial con la CLI |
| IMP-01 | Implementación local del veredicto v5, consumidores compartidos, invalidación de caché y tratamiento de fuentes parciales terminados | Despliegue de la versión revisada y comprobación de los recorridos en el entorno conectado |
| IMP-10 inicial | Suites de medición, contratos, promoción, revisión, errores y costes contrastadas; candidato y procedimiento de validación/reversión preparados | Validación del candidato aislado, revisión humana y activación. El piloto real depende de las conexiones y de evidencia suficiente |
| IMP-10 transversal | Se mantiene como puerta de cada fase posterior | No se considera terminado para capacidades todavía no implementadas |
| IMP-02–09, IMP-11–12 | Esta entrega no los implementa | Siguen el orden y las dependencias del plan maestro |

No se ha desplegado esta entrega, promovido una versión de agente ni ejecutado una migración remota. No se han generado llamadas a modelos o embeddings como parte de estas pruebas.

## Qué cambia en el producto

Antes, una página parcial de eventos podía perder su marca de incompletitud al llegar al cálculo; la recuperación de una conexión podía apoyarse en un éxito anterior a su error actual; A09 consultaba entrega sin incorporar el mismo veredicto y ventana que los especialistas.

Ahora:

- A24 conserva la incompletitud de incidencias y eventos hasta el cálculo, el detalle de cobertura y la huella de las fuentes. La cobertura del diagnóstico no se declara completa si las páginas o el snapshot de incidencias están incompletos.
- El veredicto es `a24-measurement-v5`. Un dato ausente, antiguo, fallido o incompleto no autoriza una conclusión de medición sana.
- A14, A23, A25 y la herramienta `meta_delivery_health` de A09 leen el mismo módulo. A09 usa los últimos 30 días completos UTC y exige tienda seleccionada.
- La caché se valida por organización, tienda, ventana, versión, estado, cuentas seleccionadas, huella, fechas y TTL máximo de una hora. Se descarta si las cuentas o conexiones no están disponibles, si su sincronización supera las 48 horas o si hubo una sincronización/error posterior a la evaluación. Un cambio de fuentes exige una evaluación nueva.
- Una conexión solo se considera recuperada si un éxito finalizado es posterior a su último error. Esto corrige el indicador de recuperación; no resuelve por sí solo el fallo original del proveedor.
- El panel A24 ya consume `measurement_assessment` con estado, ventana, vigencia, motivos, límites y verificaciones externas pendientes. Se reutiliza ese contrato sin crear otro panel o agente.

Los agentes conservan los límites sobre atribución, CAPI, deduplicación e incrementabilidad. El indicador más favorable sigue siendo «utilizable con límites de atribución».

## Mapa de los seis recorridos incluidos

Denominador fijo de esta entrega: seis recorridos. Los seis se han localizado en código; esto no equivale a seis recorridos validados en producción.

| Recorrido | Origen | Cálculo / lectura canónica | Consumidor | Evidencia obtenida |
|---|---|---|---|---|
| Medición A24 | Pixel, aprendizaje, eventos optimizados, incidencias y snapshot de cobertura por tienda | `loadMetaMeasurementPages`, `buildMetaMeasurementVerdict`, `metaMeasurementEvidenceDetails`; contrato de caché versionado | Agente A24 y GET `/ai/medicion-meta` → `ai-diagnostic-section.tsx` | RPCs localizadas y lectura real minimizada; regresiones de cobertura, cero/ausencia, frescura y truncación |
| Operativa Meta | Ámbito Meta seleccionado + medición A24 + cálculo financiero existente | `loadMetaMeasurementVerdict` | A14 y resumen operativo del dashboard | Lector compartido y pruebas de ámbito; economía completa corresponde a IMP-02 |
| Creatividad Meta | Rendimiento y activos realmente disponibles + medición A24 | Lector compartido y `buildA23CreativeOutputContract` | A23 y decisiones creativas del panel | Contrato con proveedor simulado; no se analizó un vídeo ni se publicaron anuncios |
| Cambios Meta | Registro sincronizado de actividades + medición A24 | Lector compartido | A25 | Integración en contexto y suite de alcance; registro incompleto no prueba ausencia de cambios |
| Copiloto del consultor | RPCs de entrega por tienda + caché A24 vigente | `meta_delivery_health` y lector compartido | Herramienta de A09 | Prueba funcional de la herramienta, ventana, tenant, tienda y errores; sin proveedor real |
| Recuperación de conexiones | Estado, último error y runs de sincronización de la conexión | `hasRecoveredSync` | Readiness de integraciones | Casos de éxito anterior/posterior al error, fechas inválidas y ámbito de conexión |

## Entorno y trazabilidad

Se contrastaron 27 versiones activas de agentes con sus prompts; 45 herramientas distintas configuradas están presentes en el registro local de 86 herramientas. El modelo declarado por una versión no demuestra el enrutamiento efectivo: existen políticas y overrides de plataforma. El snapshot inicial se conserva en [IMP00_BASELINE_2026-11-01.json](IMP00_BASELINE_2026-11-01.json).

La última conciliación consultada encontró **713 versiones remotas y 626 identificadores locales**, con cero identificadores locales ausentes remotamente. Se contrastaron 14 cuerpos de funciones relevantes y los objetos de soporte indicados en [el segundo avance](SEGUNDO_AVANCE_CONCILIACION_Y_CONEXIONES_2026-11-01.md).

Las otras 87 versiones remotas están inventariadas en [el archivo histórico](../../supabase/remote-history/2026-11-01/README.md): 86 fuentes SQL recuperadas y una entrada sin sentencias conservadas. No se copiaron a la cadena ejecutable ni se aplicaron. Esto documenta la diferencia; no hace desaparecer la divergencia que verá una herramienta que compare exclusivamente identificadores.

| Superficie observada | Revisión acreditada | Forma de comprobación |
|---|---|---|
| Web de producción en Vercel, `ecom.noraapp.es` | `00ed3dfad43fafc7bf6419483244acd75e7cf582` | Despliegue READY y aliases, tras autorización del equipo |
| API del VPS | `04c26ec1dd1a2dd40e428ed2d5f43d628cc30a9d` | `GIT_SHA` del contenedor en ejecución; motor compilado `a24-measurement-v2` |
| Worker del VPS | `04c26ec1dd1a2dd40e428ed2d5f43d628cc30a9d` | `GIT_SHA` del contenedor en ejecución |
| Base del candidato local | `9fba21e7de628c98f49b2123db103d66918b74ef` | Revisión Git; cambios propios separados de las modificaciones concurrentes |

Por tanto, la autorización de Vercel permite inspeccionar el frontend; la activación de este cambio requiere entregar también API/worker en el VPS. El código local no acredita que producción ya use v5.

## Datos reales, conectores y RAG

Los errores de bloques Meta incluyen **`Application has been deleted`**. Es una evidencia más específica que el código genérico `meta_sync_partial_failure`. Se pidió reconectar mediante una aplicación activa; el usuario indicó que va a hacerlo. La reconexión debe comprobarse después mediante sincronizaciones y cobertura de fuentes, sin asumir éxito por completar OAuth.

La [sonda de fuentes](IMP01_SONDA_FUENTES_2026-11-01.json) recoge un ámbito seleccionado con identificadores sustituidos por alias. Se leyeron cinco RPCs: no devolvieron filas de pixel, aprendizaje, eventos o incidencias y el snapshot de cobertura era incompleto. El cálculo local devolvió **`unknown`**, con `source_missing_or_stale`, `review_issue_sync_stale_or_unknown` y `no_eligible_spend_observed`. Acredita degradación conservadora con esas fuentes; no acredita medición sana ni rendimiento de campañas.

Shopify conserva un error posterior a su último éxito; no se ha confirmado la causa original. No hay conexión Klaviyo en el inventario consultado. No se fuerza una recuperación o sincronización para ocultar esos estados.

**Embeddings y SQL tienen funciones distintas.** El backend de conocimiento usa Voyage mediante `createRagEmbeddingProvider`: perfil `structural-v4`, modelo `voyage-context-4`, 1.024 dimensiones. Una consulta agregada confirmó 584 documentos activos registrados con ese modelo. Supabase conserva los vectores. Los archivos SQL de auditoría no son documentos importados ni llamadas a Voyage. Las nuevas carpetas Meta Ads todavía no se han ingerido; la selección, revisión, deduplicación e ingesta corresponden a IMP-04.

## Validación y explicación de ajustes de tests para revisión

Resultados en el árbol compartido:

| Comprobación | Resultado |
|---|---|
| `npm run test:a24-contracts --workspace @e-nora/api` | 71 pruebas superadas |
| `npm test --workspace @e-nora/ai` | 291 pruebas superadas |
| Ocho suites de conexiones, circuito de proveedor, actividad, evaluación, promoción, juez y envolvente | 76 pruebas superadas |
| `npm run typecheck --workspace @e-nora/api` | Superado; debe repetirse tras el último ajuste de cobertura del GET |
| `npm run verify` | 19 guardas superadas antes del cierre documental; se repite al terminar |

Son conteos por comando, no una afirmación de cobertura de todo el producto. No se ejecutaron las suites remotas que requieren escrituras sobre un proyecto aislado, ni se certificó un flujo completo de navegador a base de datos con una sesión de cliente.

La revisión ampliada encontró expectativas anteriores a los contratos ya presentes en la base Git. Conforme a la regla de revisión explícita de `docs/ai/AI_SECURITY.md`, estos ajustes se justifican aquí para la revisión del candidato:

- A12: la comprobación de un placeholder retirado se sustituye por pertenencia, resolución del ámbito, rechazo de ámbito inválido y argumento de tienda en la función concreta.
- A13/A14: las comprobaciones de una llamada a helper retirada se sustituyen por filtros de organización/tienda, separación de alertas sin atribución y tratamiento del error, dentro de cada función. Se incrementan los asserts.
- A23: el fixture simulado incorpora los campos que el contrato vigente ya exige: referencia de decisión, IDs explícitamente nulos, métrica, denominador, comparador, ventana y madurez. Se mantiene la igualdad completa entre salida esperada y validada. No se relaja el esquema.
- A19: dos tests aún esperaban tres días, mientras `camino-review-scheduling.ts` y sus pruebas específicas ya establecen siete. Se fija ese contrato semanal, incluyendo el límite seis/siete días. No se cambia la cadencia del runtime.

No se eliminan asserts, no se omiten tests ni se modifica el dataset reservado. No se introduce reparación automática de pruebas.

## Costes y promoción

Se reutilizan los controles existentes: presupuesto predeterminado de 2 USD y 24 herramientas por turno, 20 USD diarios por organización y 50 USD diarios de plataforma, sujetos a las políticas efectivas de plan/enrutamiento. Los overrides se acotan en el código. Son valores de admisión y estimación; no equivalen a una garantía contable de gasto simultáneo exacto.

El circuito de proveedor y sus regresiones forman parte de la batería. Los timeouts dependen del agente y de la política del proveedor; esta entrega no amplía sus límites ni aumenta la frecuencia de automatismos. En la consulta agregada de costes de ese día no había ejecuciones registradas; no se atribuye una mejora de coste o latencia sin medición.

La función de promoción consultada exige evidencia asociada a la huella de la versión y resultado del juez. No había evaluaciones persistidas que justificasen promover una versión nueva desde esta revisión. Este cambio de motor no activa prompts nuevos ni modifica la allowlist de un agente.

## Candidato, activación y reversión

[El parche de 15 archivos](CANDIDATO_IMP01_2026-11-01.patch) contiene exclusivamente esta entrega de código y tests, incluyendo el script A24. [Su manifiesto](CANDIDATO_IMP01_2026-11-01.json) identifica base, árbol y SHA-256. Excluye los cambios concurrentes de estrategia creativa, generación de marketing y el script general de pruebas. Se comprobó la aplicación sobre un índice Git separado, sin preparar cambios en el índice del usuario.

Pasos para activar, con responsable técnico y consultor revisor:

1. Validar el candidato aislado y revisar el diff y las justificaciones de tests. No desplegar el árbol compartido con cambios ajenos.
2. Registrar un commit de entrega y ejecutar las comprobaciones exigidas por `ops/vps/deploy.sh` en ese contenido. No usar `ECOM_SKIP_CHECKS` o `ECOM_ALLOW_DIRTY`.
3. Desplegar coordinadamente API/worker en el VPS con su SHA verificable. No hay DDL nuevo ni cambio de formato del frontend en esta entrega.
4. Con Meta reconectado, comprobar último run por conexión y completitud de eventos/incidencias. Consultar A24 sin generar un turno de modelo y comprobar estado, ventana, alcance, razones y vigencia en API/panel.
5. Comprobar consumidores A09/A14/A23/A25 con el mismo ámbito. Mantener `unknown` donde falte evidencia; habilitar solo un piloto acotado y revisado antes de ampliar automatismos.
6. Medir errores, falsos estados sanos, coste/latencia y correcciones del consultor respecto al baseline. Parar si hay mezcla de ámbitos, estado elevado indebidamente, fallos repetidos o gasto fuera de política.

Reversión de código: conservar las imágenes actuales con su digest y configuración antes de activar, y restaurar coordinadamente API/worker si falla la validación. Comprobar salud y `GIT_SHA` tras restaurar. El lector y escritor deben usar la misma versión del motor; no reinterpretar una caché v5 como v2/v4 ni convertirla manualmente en fiable. No hay datos o migraciones de esta entrega que borrar.

La comprobación de restauración en un entorno de validación y la revisión humana siguen siendo condiciones de activación. No se afirma que se haya ensayado una reversión real de producción. La autorización de acceso a Vercel fue para inspección, no una aprobación de este despliegue.
