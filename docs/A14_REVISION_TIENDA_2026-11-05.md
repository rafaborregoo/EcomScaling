# A14 · Operativa de Meta Ads

**Estado más reciente del 5/11:** el usuario delegó elegir cuenta. Se verificó ficha e informes de Rafael Borrego Reyes (`act_1797270924877645`), se seleccionó y asignó a E-NORA Demo mediante los helpers de acceso/auditoría existentes. Rafa Borrego se desasignó y deseleccionó conservando histórico. Se corrigió el fallo `Permission Denied` de campos de facturación: ahora se reintenta ficha básica; si también falla, se mantiene el error. La sincronización inicial de noventa días finalizó sin errores; las dos ventanas de A14 no contienen adquisición. No se interpreta como validación de rentabilidad ni se mezclan cifras de la cuenta anterior.

Comparación nueva `a14_operativa_meta:real-store-runtime-2026-11-05-readable-account`: seis respuestas válidas. Sol principal y Terra fallback fijados para diagnóstico/abstención. La selección del modelo queda cerrada para este uso; optimización con campañas activas y economía acreditada sigue fuera de lo validado. Perfil actualizado: 40.713 tokens entrada, 1.122 salida; 0,092646 USD/ejecución y 2,77938 por treinta, según catálogo sin caché. Respuesta seleccionada verificada para cliente y consultor: run `1d7e3e46-724c-4e96-9b46-6d06dde25635`, output `7fa9af4b-9c1d-49e2-94cc-3cc87e9a7ca6`, tres hallazgos y cero tareas. Se actualizaron modelo/costes/laboratorio/UI. Recibos en `a14-real-2026-11-05-readable-account` y `a14-closeout-2026-11-05`. No requiere volver a reconectar la cuenta actual. Los apartados históricos siguientes conservan la secuencia anterior y sus límites; esta actualización prevalece sobre el estado provisional anterior.

Comparación ejecutada el 3/11/2026; configuración y visibilidad verificadas el 5/11/2026, Europe/Madrid. **Selección provisional: GPT-6.1 Sol principal y GPT-6.1 Terra como segundo modelo. La auditoría del escenario con cobertura completa sigue pendiente.**

## Qué recibe y cuándo se ejecuta

El runtime exige una tienda y cuentas Meta elegibles. Prepara treinta días completos UTC y el periodo anterior contiguo, gasto y atribución Meta, suficiencia financiera y monetaria Shopify, veredicto determinista A24, Camino activo, tareas, actividad e histórico de especialistas. Se capturaron veinte bloques para Prueba Borrego / E-NORA Demo con autorización del propietario de la tienda. Hay datos TEST de demostración, no resultados comerciales reales.

El orquestador genera una lectura por tienda elegible; no hay otra ejecución por abrir el resultado como cliente o consultor. La referencia de diseño se corrigió de dos a una diaria por tienda, manteniendo los controles de actividad, antigüedad, límites y presupuesto. Ajustes administrativos de frecuencia pueden modificar esa referencia. Abrir la página solo lee la salida guardada.

## Comparación y precio

Caso conservado: `a14_operativa_meta:real-store-runtime-2026-11-03`. Seis modelos con el mismo contexto y contrato, sin Astra, sin herramientas dinámicas ni API pagada. Claude confirmó el ID servido; Codex CLI no lo confirmó. Una respuesta por modelo y revisión retrospectiva del asistente, sin evaluación humana independiente.

| Modelo | USD/ejecución sin caché | USD/30 ejecuciones | Observación de esta muestra |
|---|---:|---:|---|
| Haiku 5.5 | 0,0062965 | 0,188895 | Reconoce carencias, pero compara un ticket histórico como incoherencia actual y prescribe mantener gasto. |
| Sonnet 5.5 | 0,080228 | 2,40684 | Afirma incorrectamente que 8.235 compras superan 9.652 clics y repite esa premisa en su recomendación. |
| Opus 5.5 | 0,26604 | 7,9812 | Detalle útil, pero compras atribuidas/clics no acredita conversión de clic; prescribe mantener gasto y usa un plazo antiguo. |
| Luna | 0,0039146 | 0,117438 | Prudente y barato, con menor cobertura del historial y trabajo abierto. |
| Sol | 0,09327 | 2,7981 | Mejor combinación de cifras, límites, fechas y seguimiento del trabajo ya abierto. |
| Terra | 0,043806 | 1,31418 | Segundo candidato prudente y económico, con menos detalle y seguimiento. |

Tarifas del catálogo del laboratorio, documentadas allí a 28/10/2026. Equivalente API sobre tokens CLI, no factura ni tarifa externa revalidada a 5/11. Treinta ejecuciones es un escenario; herramientas, fallback, reintentos, actividad y número de tiendas cambian el coste. Sol usa 39.695 tokens de entrada y 1.388 de salida en esta muestra, sin asumir descuento de caché. El contador de administración incluye su asignación provisional.

Sol distingue CPA atribuido de CAC de clientes nuevos, EUR compatible de cobertura económica suficiente y actividad histórica de veredicto vigente. No duplica la propuesta de medición ni controles económicos abiertos. Terra conserva esas cautelas con menos información. El fallback entre ambos modelos no cubre indisponibilidad de todo OpenAI.

La propuesta adicional de Opus no se penaliza por ser adicional: se cuestionan su premisa de atribución, criterio de éxito y fecha. El filtro nativo conservador de A14 retira esa propuesta por incluir términos de inversión. Respuesta original, revisión y recuento antes/después del filtro permanecen guardados.

## Dependencias pendientes

**Actualización de cierre del 5/11, posterior a la primera verificación:** se aplicó `imp02_financial_comparability` exclusivamente a TEST tras revisar el esquema y el SQL preparado. `shopify_financial_coverage` ya responde sin error. Acceso anónimo/autenticado directo denegado; ejecución interna por service_role permitida. No se aplicó a producción ni se rellenaron bases financieras antiguas por deducción.

Registro remoto TEST: versión `20261105190726`, nombre `imp02_financial_comparability`. Archivo revisado local: `supabase/migrations/20270115120000_imp02_financial_comparability.sql`, SHA-256 `196c8daf2563a03523723b23cd4111156c317ef155c8dff046d1bfd23bf95011`. Los identificadores remoto y local difieren: se conserva esta correspondencia para reconciliar la cadena, sin fingir que el archivo futuro ya figura con su versión local. Docker local estaba detenido; esta sesión no volvió a ejecutar las pruebas SQL aisladas previamente documentadas. Sí comprobó la RPC remota, contrato de respuesta y permisos después de aplicar la migración.

Se regeneró la evaluación determinista de A24 desde las fuentes actuales, sin llamada LLM. Continúa en `unknown`: cero filas de píxel, tres conjuntos con correspondencia incompleta e incidencias cuya sincronización no completó. La cuenta seleccionada es Rafa Borrego (`act_946548861093802`); los registros del 5/11 muestran `(#200) ... has NOT grant ads_management or ads_read permission` para sus informes, píxeles, incidencias y actividad. La conexión sigue en error; no se fuerza a connected. Es necesario revisar el acceso a esa cuenta y reconectar mediante `/integraciones/meta` autorizando lectura. Se corrigió el clasificador del error para mostrar esa acción y se actualizó el mensaje de TEST conservando su estado de error.

La cobertura financiera ahora identifica el problema real: 951 pedidos sin `total_before_returns` verificado y 951 líneas cuyo coste procede del coste actual, no un coste histórico fechado. La conexión Meta no disponible añade `ads_source_stale_or_unavailable`. Requiere reconciliación con el proveedor y costes históricos acreditados; no se inventan valores para convertirlo en `comparable`.

La guarda de A14 se comprobó: devuelve `meta_source_not_ready` **antes** de preparar una llamada al modelo. Recibo: `.e-nora-test-lab/a14-closeout-2026-11-05/coverage.json`, reproducible con `scripts/a14-refresh-coverage.mts`. Las cinco pruebas de clasificación del error pasan. No se repiten las seis generaciones sobre una fuente bloqueada ni se declara cerrado el escenario completo. Los puntos siguientes describen la situación histórica de la tanda original y quedan sustituidos por esta actualización donde corresponda.

**Después de que el usuario confirmara la reconexión:** comprobaciones directas con el token guardado, sin imprimir credenciales ni modificar Meta, confirman `ads_read: granted`. Sin embargo, la ficha y los informes de `act_946548861093802` devuelven error 200 de acceso. `/me/adaccounts` lista únicamente `act_1797270924877645`, «Rafael Borrego Reyes». Por tanto, no basta con volver a pedir `ads_read`: hay una discrepancia entre la cuenta asignada a la tienda («Rafa Borrego») y la cuenta que la conexión permite listar. Se solicitó al usuario elegir mantener la cuenta histórica y revisar su acceso, o utilizar la otra cuenta. No se modifica la asignación ni se mezcla el histórico sin esa elección. Recibo reproducible: `scripts/a14-check-meta-access.mts`, `.e-nora-test-lab/a14-closeout-2026-11-05/meta-access.json`. Listar una cuenta tampoco certifica por sí solo acceso a todos sus informes.

1. A24 devuelve `unknown` por ausencia de un veredicto vigente para tienda/ventana. Una comprobación o propuesta histórica no lo sustituye.
2. TEST responde `PGRST202` para `shopify_financial_coverage`. El código IMP-02 que aporta esa RPC está preparado en otra línea de trabajo; su documento reserva el despliegue para la entrega final indicada por el usuario. Esta auditoría no despliega ese conjunto ni sustituye la cobertura por cifras antiguas.
3. La importación histórica organizativa al 57 % no acredita cobertura por cuenta. Los recuentos llamativos no prueban por sí solos un fallo del píxel ni una tasa de conversión de clics: `omni_purchase` es atribución de plataforma.

La selección no valida decisiones de inversión con datos completos. Tras activar la dependencia financiera y obtener A24 vigente, hay que capturar otro caso y repetir los seis modelos conservando esta tanda limitada. Mientras tanto, se mantienen los controles que bloquean propuestas de inversión sin evidencia suficiente.

## Resultado en las cuentas

En **Meta Ads → A14 · Operativa de Meta Ads**, `/meta#meta-pendiente`, la lectura aparece abierta para cliente y consultor; el botón de actualización y la gestión de propuestas siguen el permiso de consultor. La API devuelve a ambas cuentas el mismo resultado seleccionado de Sol: tres hallazgos y cero tareas nuevas. El resumen se publica sin aprobación porque no propone escrituras, siguiendo el comportamiento del runtime.

- Run: `96f3bc95-6dee-4fff-8f21-eaf7efe69755`.
- Output: `9e946d76-8a1e-4350-ba86-790eed18d8ae`.
- Snapshot fechado 3/11 visible en las advertencias; publicación del 5/11 marcada como simulación CLI en TEST. No se presenta como captura nueva del día 5.
- No se crearon tareas ni se modificaron anuncios, presupuestos o cuentas externas.
- Comparaciones y revisión en Platform admin → Laboratorio de IA → A14, con selección provisional y respuestas plegadas.

Recibos privados: `.e-nora-test-lab/a14-real-2026-11-03/review.json` y `visibility.json`. Scripts reproducibles: `a14-capture-real-store.mts`, `a14-review-real-store.mts`, `a14-check-financial-source.mts` y `a14-share-and-verify-real-store.mts`.

## Comprobaciones

Compilación de contratos, tipos de API/web y prueba de asignación A14 superados. Sesiones reales de ambas cuentas verificadas por API y página Meta con HTTP 200. Sin sesión, la API devuelve 401; el propietario de tienda recibe 403 al catálogo de platform admin. No se amplían permisos para comprobarlo. La revisión visual permanece pendiente: el acceso al navegador y a aplicaciones nativas no está disponible en esta sesión.
