# Consultor: preparación para mercado y auditoría funcional

Fecha: 26 de octubre de 2026. Evaluación del árbol de trabajo actual, web y API locales y base de datos **TEST ES IA**. Se utilizaron las sesiones abiertas de consultor y cliente en dos perfiles de Chrome. No se ha certificado el despliegue de producción.

Actualización: las correcciones y mejoras del piloto están recogidas en [la entrega de implementación](2026-10-26-consultor-mejoras-implementadas.md). Los hallazgos siguientes conservan la evidencia de la auditoría inicial.

## Decisión como CTO

El producto tiene alcance suficiente para un piloto comercial: cartera, revisión de negocio, tareas, propuestas de IA, comunicación, informes y tiendas propias cubren un trabajo útil para un consultor. Ampliar el número de funciones antes de resolver los problemas descritos aquí retrasaría el aprendizaje con usuarios.

Recomiendo corregir primero los fallos de permisos y de contexto entre tiendas, recuperar las comprobaciones de despliegue y empezar con 3–5 consultores acompañados durante 2–4 semanas. Son cifras propuestas para este piloto, no resultados de una investigación de mercado.

Las mejoras de producto que priorizaría son:

1. **Primer cliente guiado:** vincularlo, conectar su tienda, confirmar la calidad del dato y dejar una primera acción con responsable y fecha. Hacer visible el paso pendiente y el motivo de un bloqueo.
2. **Contexto de trabajo inequívoco:** mostrar y conservar cliente y tienda en métricas, enlaces, informes, tareas y propuestas. Distinguir con claridad el agregado del cliente y una tienda concreta.
3. **Una lectura coherente de prioridades:** el mismo cliente aparece como «Urgente» en la mesa y «Al día» en Gestión con los datos revisados. Las dos pantallas usan criterios distintos. La interfaz debe explicar esa diferencia o compartir el criterio.
4. **Entrega comprobable:** cada informe programado debe mostrar si se generó, si se envió y si necesita reintento. Una tarea debe dejar claro qué resultado permite cerrarla; buena parte de esa estructura ya existe.

Para después del piloto: unos pocos procedimientos reutilizables de tareas —alta de cliente, revisión semanal y cierre mensual— y personalización visual adicional de informes. Ya existen plantillas de informes y de email; un catálogo propio de procedimientos de consultoría sería una ampliación, no una capacidad confirmada del módulo actual.

Mediría tres resultados durante el piloto: tiempo hasta el primer cliente operativo, porcentaje de informes programados entregados y consultores que vuelven cada semana y cierran una acción útil. La recomendación de aprender pronto con usuarios y mantener pequeño el lanzamiento es coherente con la [guía de YC](https://www.ycombinator.com/blog/ycs-essential-startup-advice/).

## Alcance y evidencia

Se revisaron los flujos de cartera, tiendas propias, métricas y comparativas, informes, agentes y alertas, tareas, mensajes, permisos y plantillas. La carga asumida es la de un piloto con pocos consultores y varias tiendas por consultor; no se realizó una prueba de carga.

Se combinaron:

- Descubrimiento con el grafo MCP y lectura del código actual.
- Navegación real con las dos sesiones existentes.
- Pruebas automatizadas seleccionadas de API, web, contratos y worker.
- Tres reproducciones aisladas con HTTP simulado: fallo al leer permisos, informe programado de un cliente con dos tiendas y fallo de entrega de correo.
- Consultas de solo lectura al esquema, políticas, permisos y datos de prueba de Supabase.
- Comprobación real de la consulta REST que falla en «Tus permisos».
- Ejecución de `npm run verify` y del chequeo de tipos de API, web y worker.

Las pruebas simuladas no enviaron correos ni publicaron campañas. No se crearon tiendas, clientes ni usuarios reales para probar escrituras. La base de prueba tiene una tienda activa y otras dos inactivas en el cliente revisado; no tiene cuentas con acceso limitado a tiendas ni planes en estado borrador. Estos límites afectan a las comprobaciones indicadas abajo.

## Debe resolverse antes del lanzamiento abierto

### 1. Los fallos al leer permisos vuelven a habilitar escrituras — alta

**Qué ocurre.** `loadConsultantPermissions` ignora el error de la consulta y mezcla un resultado nulo con los permisos por defecto. Esos valores habilitan configuración, tareas, borradores e invitaciones.

**Caso reproducido.** Se simuló una respuesta HTTP 500 de la consulta de permisos. La función devolvió `manage_tasks: true` y `decideOrgAccess` permitió la escritura. Si la lectura de esa tabla falla mientras las demás escrituras siguen disponibles, una restricción guardada por el propietario deja de aplicarse.

**Cambio mínimo.** Distinguir «no existe fila» de «falló la consulta». El primer caso puede usar los valores de producto; el segundo debe devolver un error y bloquear la escritura.

**Si se mantiene.** Los permisos efectivos dependen de que una lectura funcione. Contradice la decisión del propietario.

Fuente: [organization-settings.ts](../../apps/api/src/organization-settings.ts), función `loadConsultantPermissions`, línea 79; [org-access-guard.ts](../../apps/api/src/org-access-guard.ts). El criterio de denegación por defecto está documentado por [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#deny-by-default).

### 2. «Tus permisos» no carga por una relación ambigua — alta

**Qué ocurre.** `listMyConsultantPermissions` pide `organizations(display_name)` desde `consultant_assignments`. Ahora hay dos relaciones a organizaciones: la del cliente y la de la consultora.

**Caso reproducido.** La pantalla muestra «No se pudieron cargar tus permisos» y, a la vez, el encabezado «Aún no tienes clientes asignados», aunque la cartera contiene un cliente. La consulta REST real devolvió HTTP 300, código `PGRST201`, y solicitó elegir entre `consultant_assignments_consulting_organization_id_fkey` y `consultant_assignments_organization_id_fkey`.

**Cambio mínimo.** Indicar explícitamente la relación del cliente en el embed. Hacer que el encabezado trate el error como error y no como una cartera vacía.

**Si se mantiene.** El consultor no puede consultar sus permisos y recibe una explicación falsa sobre su cartera.

Fuente: [organization-settings.ts](../../apps/api/src/organization-settings.ts), línea 126; [consultant-permissions.tsx](../../apps/web/src/app/configuracion/consultant-permissions.tsx).

### 3. El inicio de una tienda mezcla su alcance con el agregado del cliente — alta

**Qué ocurre.** `ClientPulse` añade `connectionId` a las métricas de Shopify y a varios diagnósticos, pero no a las consultas de Meta, Klaviyo y operaciones. `ConsultantClientDesk` también consulta Meta sin ese filtro. La API de Meta interpreta la ausencia del filtro como agregado de la organización.

**Caso concreto.** Con dos tiendas A y B, al seleccionar A las ventas corresponden a A mientras su tarjeta de Meta puede mostrar el rendimiento conjunto de A y B. También pueden aparecer tareas del resto de la organización. La misma consulta y clave de caché se conservan al cambiar de tienda.

**Cambio mínimo.** Propagar el alcance seleccionado a los endpoints que lo admiten y etiquetar de forma explícita cualquier bloque que deba seguir siendo del cliente completo. Revisar también el resumen de seguimiento del workbench, cuyo filtro es por organización.

**Si se mantiene.** El usuario puede tomar decisiones para una tienda a partir de cifras de varias tiendas.

Fuente: [client-pulse.tsx](../../apps/web/src/app/dashboard/client-pulse.tsx), líneas 1642–1645; [consultant-desk.tsx](../../apps/web/src/app/dashboard/consultant-desk.tsx), línea 931; [meta-metrics.ts](../../apps/api/src/meta-metrics.ts), función `getMetaMetrics`. Confirmado por seguimiento del código; falta la prueba visual con dos tiendas activas.

### 4. Los informes mensuales no pueden programarse correctamente para varias tiendas — alta

**Qué ocurre.** El modelo de programación tiene `store_id` y el worker lo utiliza. El formulario y `upsertReportSchedule` no recogen ni guardan ese campo. La restricción única es por organización y plantilla, lo que tampoco permite una programación de la misma plantilla por tienda.

**Caso reproducido.** Se llamó a la función con una tienda elegida: la escritura descartó `store_id` y devolvió éxito. Al ejecutar la generación con dos tiendas activas, incluso en EUR ambas, se obtuvo `shopify_store_selection_required`.

**Cambio mínimo.** Selección y autorización de tienda en formulario y API, persistencia y devolución de `store_id`, e identidad de programación que permita el alcance por tienda. Verificar también pausar y reanudar conservando ese alcance.

**Si se mantiene.** Se acepta una programación que después no puede generar el PDF.

Fuente: [informes/page.tsx](../../apps/web/src/app/informes/page.tsx), componente `SchedulesCard`; [reports-api.ts](../../apps/api/src/reports-api.ts), líneas 99 y 181; [migración de informes](../../supabase/migrations/20261218090000_informes_historial_y_programados.sql).

### 5. Las políticas activas de planes permiten saltarse el filtro de borradores — alta, validación de lectura pendiente

**Qué ocurre.** En TEST ES IA conviven políticas permisivas `*_select_authorized` y `*_store_scope_select` para planes, fases e hitos. La primera restringe borradores; la segunda solo comprueba acceso a la tienda. El guard restrictivo también comprueba la tienda, sin recuperar el requisito de publicación.

**Caso concreto.** Un miembro o usuario de solo lectura de una organización, con acceso al alcance del plan, satisface la segunda política aunque el plan sea `draft`. Esa vía permitiría leer el borrador. Los propietarios y gestores tienen una vía específica para revisar sus planes; el problema descrito afecta a los demás roles.

**Evidencia y límite.** Se inspeccionaron las políticas efectivas y el permiso `SELECT` de `authenticated`. La evaluación con un usuario cliente devolvió `is_admin=false`, `is_consultant=false`, filtro original de borrador `false` y filtro de tienda `true`. La combinación permisiva dio `true`. El helper de tienda no distingue owner, manager, member y readonly. No había borradores ni un fixture member/readonly para ejecutar una lectura real de una fila bloqueable; no se afirma haber observado una filtración de datos existentes.

**Cambio mínimo.** Mantener simultáneamente el alcance de tienda y la regla de visibilidad del borrador. Añadir una prueba real con owner, manager, member y readonly, y revisar las tablas hijas con el mismo patrón.

**Si se mantiene.** El acceso a una tienda puede dar visibilidad anticipada al trabajo que aún no corresponde ver a ese rol.

Fuente: `pg_policies` y helpers activos en TEST ES IA; [strategic-plans.ts](../../apps/api/src/strategic-plans.ts), funciones `assertCanManagePlan` y `getStrategicPlan`. [PostgreSQL explica la combinación OR de políticas permisivas y AND de restrictivas](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

### 6. El árbol actual no supera la puerta de preparación del despliegue — alta

**Qué ocurre.** Las pruebas seleccionadas pasan, pero los controles globales no.

**Resultados concretos.**

- `npm run typecheck -w @e-nora/api -w web -w @e-nora/worker`: API falla con `TS2352` en `integration-delivery.test.ts`, línea 76. El fixture convierte directamente un perfil incompleto a `AuthContext`. Web y worker no emitieron errores de tipos en esta ejecución.
- `npm run verify`: cuatro guardas en rojo: activación de versiones de agentes sin la promoción exigida, enlaces locales Markdown, idempotencia de migraciones y archivos de pruebas fuera de la suite.
- La guarda de agentes señala seis migraciones: A09, A11, A15, A23, A25 y A28.
- La guarda de idempotencia señala tres migraciones: `20261231230700_a11_remaining_integrity.sql`, `20270102120000_a14_operational_integrity.sql` y `20270106110000_a23_creative_full_evidence_and_coordination.sql`.
- Pruebas omitidas por los scripts: `channel-access-regression.test.ts`, `meta-creative-library.test.ts`, `metric-analyst-presentation.test.ts` y `shopify-discount-proposals.test.ts`.

**Cambio mínimo.** Corregir las causas concretas, incorporar las pruebas omitidas y repetir la puerta completa desde un checkout reproducible. No interpretar una suite parcial en verde como aprobación de la versión.

**Si se mantiene.** El procedimiento normal de despliegue puede abortar y la validación habitual deja regresiones fuera.

Fuentes: [integration-delivery.test.ts](../../apps/api/src/integration-delivery.test.ts), [verify.mjs](../../scripts/verify.mjs), [documentación de despliegue](../../deploy/README.md). Son problemas del árbol existente, no cambios introducidos por esta auditoría.

## Debe corregirse para que los flujos prometidos sean fiables

### 7. La revisión de una tienda propia se guarda pero su propietario consultor no puede volver a leerla — media

**Qué ocurre.** El alta de tienda propia crea una membresía owner, sin asignación de consultor. `markClientReviewed` acepta esa tienda y escribe con el servicio privilegiado. La política de lectura de las revisiones solo admite al autor si es administrador o consultor asignado.

**Caso concreto.** Un consultor propietario sin `consultant_assignment` marca su tienda como revisada; al recargar, la lectura filtrada por RLS no devuelve ese evento y no se conserva el corte esperado de «desde mi última revisión».

**Evidencia.** La consulta de los predicados devolvió acceso owner `true` y permiso de la política de revisiones `false` para una membresía real sin asignación. No se creó una tienda de negocio ni un evento para completar una escritura de prueba.

**Cambio mínimo.** Permitir leer sus propios eventos al consultor propietario de esa tienda, conservando el carácter personal de la revisión.

**Si se mantiene.** La revisión parece perderse y la comparación usa un corte distinto del que eligió el consultor.

Fuentes: [consultant-workbench-api.ts](../../apps/api/src/consultant-workbench-api.ts), líneas 510 y 860; [política de revisiones](../../supabase/migrations/20261103100000_consultant_client_review_events.sql), línea 39; [consultant.ts](../../apps/api/src/consultant.ts), función `createOwnStore`.

### 8. Abrir una tienda desde «Tiendas» solo selecciona su cliente — media

**Qué ocurre.** `OpenStoreLink` y `OpenStoreButton` reciben `organizationId` y enlazan a `/dashboard`. No reciben ni fijan `connectionId`, aunque se usan en filas de tiendas concretas. El enlace «Rentabilidad» de esas mismas filas sí incluye ambos identificadores.

**Caso concreto.** En un cliente con tiendas A y B, pulsar «Abrir» en B no transporta la identidad de B. Puede mantenerse A o aplicarse la selección predeterminada.

**Cambio mínimo.** Llevar la conexión de la fila al enlace y a la selección, y comprobar el resultado en el encabezado y las métricas del destino.

**Si se mantiene.** El consultor entra en una tienda diferente de la que eligió.

Fuente: [tiendas/page.tsx](../../apps/web/src/app/tiendas/page.tsx), líneas 85 y 104 y uso desde `ClientStoresCard`. Comprobación por código; el fixture actual tiene una sola tienda activa.

### 9. Un correo mensual fallido consume el mes y no se reintenta — media

**Qué ocurre.** El worker actualiza `last_period_end` incluso cuando `sendReportEmail` devuelve un fallo. Es una decisión explícita para evitar PDFs duplicados, pero también elimina la recuperación de la entrega.

**Caso reproducido.** Con HTTP simulado y SMTP desconfigurado, el primer intento devolvió `sent=0`, `failed=1`, error `email_not_configured`, y guardó `2026-09-30` como periodo completado. La pasada del día siguiente devolvió `due=0`.

**Cambio mínimo.** Separar «PDF generado» y «correo entregado»: reutilizar el PDF guardado para reintentar el envío, registrar el fallo y mostrarlo al usuario. No regenerar el documento en cada reintento.

**Si se mantiene.** El consultor ve una programación activa, pero el destinatario puede no recibir ese mes sin que haya recuperación automática.

Fuente: [reports-api.ts](../../apps/api/src/reports-api.ts), línea 233. La reproducción no contactó con un servidor SMTP.

## Cobertura por función

| Función | Comprobación realizada | Resultado y límite |
|---|---|---|
| Cartera global y detalle de cliente | Sesión consultor; métricas, prioridad, bandeja, filtros y acceso a cliente; pruebas de workbench y atención | Carga funcional observada. Criterios de prioridad distintos entre Mesa y Gestión. |
| Tiendas propias | Formulario real de alta; lectura de alta, plan inicial y permisos; revisión de políticas | Alta preparada en UI. No se creó una tienda real. Hallazgo 7 en la revisión posterior. |
| Cambio de cliente y tienda | Selector real; enlaces y consultas; pruebas de conservación de contexto | Cambio de cliente observado. Hallazgos 3 y 8 en el alcance de tienda. |
| Comparativas y rentabilidad | Lectura de tiendas; pruebas de monedas, devoluciones, ROAS y contratos de rentabilidad | Lógica seleccionada en verde. Falta escenario visual con dos tiendas activas. |
| Informes bajo demanda | Historial y diálogo real; pruebas de datos y renderizado de todas las plantillas PDF | Historial y formulario cargan. No se generó otro informe real. La descarga desde navegador no quedó confirmada. |
| Informes automáticos | Código API/worker/cron, esquema, reproducciones aisladas | Hallazgos 4 y 9. No se realizó un envío real de correo. |
| Marca de consultora | Construcción del PDF y correo, firma y reply-to; pruebas de renderizado | Nombre y firma soportados. No se ha validado una personalización completa de logo y colores. |
| Agentes, alertas y propuestas | Salidas existentes en UI; pruebas de aprobación, contexto, alcance y materialización de tareas | Lecturas y pruebas seleccionadas correctas. No se regeneraron todos los agentes ni se aprobaron propuestas reales. |
| Tareas y responsabilidades | Lista real en ambos roles; pruebas de asignación, visibilidad y guardas | Carga observada. No se modificaron tareas de trabajo reales. Se observó un error puntual en el inicio del consultor, no reproducido como fallo permanente. |
| Permisos y accesos | Dos roles reales, bloqueo de ruta de cartera al cliente, pruebas de guardas, consulta REST y políticas | El cliente queda fuera de la cartera. Hallazgos 1, 2 y 5; no había fixture de acceso limitado a tiendas. |
| Mensajes | Misma conversación en ambas sesiones, autoría, contexto y estado de lectura | Lectura correcta. No se enviaron mensajes ni se subieron adjuntos de prueba. |
| Plantillas y contenido | Biblioteca del cliente y revisión de piezas en UI; pruebas de plantilla/campaña | Biblioteca del cliente carga y muestra un borrador. No se importó ni publicó material real. |
| Marketing de cartera | UI global y lectura directa de `buildCampaignsOverview` con el cliente de prueba | La UI mostró un error; la lectura directa posterior terminó correctamente. Intermitencia sin causa aislada. |
| Llamadas y agenda | Widgets existentes y pruebas de tareas derivadas, responsables y fechas | Cobertura parcial. No se creó reunión, grabación ni transcripción real. |

## Pruebas ejecutadas

Todos los bloques seleccionados siguientes terminaron con código 0. Esto valida los casos que contienen; no sustituye los recorridos con servicios externos ni las pruebas de los hallazgos nuevos.

- **API, primer bloque: 22 archivos.** `consultant-work`, `consultant-workbench`, `consultant-client-overview`, `consultant-attention`, `consultant-partners`, `client-access`, `org-access-guard`, `task-assignment`, `work-split`, `store-triage`, `store-scope`, `store-limit`, `consultora-settings`, `report-data`, `copilot-report-sharing`, `consultant-chat-store-scope`, `consultant-proposal-guidance`, `operations-alert-store-scope`, `campaign-review`, `campaign-quick-actions`, `klaviyo-template-push` y `agent-schedule`.
- **API, segundo bloque: 93 pruebas.** Contexto y caché de autenticación, contexto del consultor y especialistas, capacidad de cartera, códigos y vinculación, notificaciones, tareas de llamadas, guardas de aprobación, alcance de marketing, fechas de campañas, cambios propuestos, resultados y entrega de tareas. Incluye de nuevo `consultant-proposal-guidance`; no debe sumarse como cobertura única adicional.
- **Web: 37 pruebas.** Modelo de cartera, integraciones, triage, asignación a tienda, responsables, tareas de llamadas, contexto de rutas y navegación.
- **Contratos: 44 pruebas.** Cartera, rentabilidad, campañas y notificaciones.
- **Worker: 5 pruebas.** Identificación de programaciones antiguas de integración.
- **Reproducciones aisladas: 3.** Los tres defectos descritos en 1, 4 y 9 quedaron reproducidos.
- **Lectura REST de operaciones:** la selección actual de tareas y sus relaciones devolvió HTTP 200. No se ha atribuido el error puntual del dashboard a una columna o relación inexistente.
- **Lectura REST de permisos:** HTTP 300 / `PGRST201`, reproducido.
- **Lectura de marketing de cartera:** construcción directa de la vista para el cliente de prueba devolvió `ok=true`.
- **Salud local del API:** `/health` devolvió `status=ok`.
- **Controles globales:** chequeo de tipos de API y `npm run verify` fallidos por las causas del hallazgo 6.

## Veredicto y siguiente entrega

**Funcionalidad suficiente para empezar a vender un piloto acompañado; versión actual pendiente de correcciones para un lanzamiento abierto.** El orden de trabajo recomendado es permisos, contexto entre tiendas, informes, políticas de visibilidad y puerta de despliegue. Después, repetir los casos corregidos y un recorrido con dos tiendas activas y varios roles.

Quedan sin comprobar en un recorrido completo: alta y baja de clientes/tiendas, envío y adjuntos, cambio real de permisos entre sesiones, recuperación efectiva de un correo fallido, reconexión OAuth, publicación en proveedores, ejecución completa de los agentes, descarga real del PDF y funcionamiento del cron desplegado. Se han revisado partes de su implementación, pero no se dan por aprobados esos resultados externos.

No se ha hecho una auditoría integral de facturación, aplicación móvil, carga, recuperación de desastres o producción. El informe se centra en las funciones de consultor solicitadas y su preparación para el primer lanzamiento.
