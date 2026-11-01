# Auditoría de Shopify: consultor, cliente y tienda propia

Fecha: 26 de octubre de 2026.

Estado analizado: código actual del workspace y aplicación local en `localhost:3001`, con dos sesiones de navegador: consultor y cliente. Hay otra sesión migrando componentes compartidos; las incidencias de compilación de esta revisión describen este estado de trabajo, no una versión de producción certificada.

## 1. Conclusión y decisión de producto

El módulo tiene una base útil: resumen de negocio, catálogo, detalle de producto, inventario por grupos, promociones y una capa técnica para consultores. **Conviene corregir los problemas de autorización, costes y coherencia de datos antes de ampliar las pantallas.**

**Un consultor ya puede tener tiendas propias.** Existe el alta de una organización con el consultor como propietario, el listado de tiendas propias y su selección en la cabecera. Lo pendiente es resolver bien la experiencia dentro de Shopify.

Recomendación: **reutilizar la vista de negocio que usa el cliente para la tienda propia**, con acceso opcional al análisis profesional. Mantener la cuenta como consultor y decidir las acciones por sus permisos sobre la organización y la tienda. No hace falta mantener una tercera implementación completa de Shopify.

Resultado de la auditoría: **6 incidencias P1 y 9 P2**, descritas con caso concreto, evidencia y solución. Se añaden mejoras de producto y criterios de aceptación para el trabajo posterior. Esta entrega es un informe; no modifica el módulo ni sus permisos.

## 2. Alcance, método y límites

Se asume uso simultáneo por varios consultores, clientes con más de una tienda y catálogos mayores de 24 productos. No se ha realizado una prueba de carga.

Revisión realizada:

- Rutas y componentes de resumen, catálogo, ficha de producto, inventario, grupos, promociones y diagnóstico.
- Navegación, selección de organización y conexión, y diferencias entre los dos roles.
- API de métricas, resumen técnico, catálogo, costes, propuestas de descuento y controles de acceso.
- Caché, moneda, historial de costes y selección de tienda.
- Entrada de webhooks, cliente GraphQL y mecanismos de sincronización, a nivel de código y pruebas disponibles.
- Alta y acceso a tiendas propias y separación entre organización de consultoría y organización de negocio.
- Pruebas locales existentes del módulo y revisión de documentación oficial de Shopify API `2026-07`, la versión configurada en el proyecto.

La revisión de código se concentró en los caminos de entrada, autorización, importes y escritura. No se ha leído línea por línea cada panel del diagnóstico ni se certifica todo el sistema de agentes.

No se han creado tiendas, cambiado costes o permisos, lanzado agentes, sincronizaciones manuales, conectado cuentas, aprobado descuentos, ni ejecutado cambios contra Shopify o la base remota. No se han ejecutado pruebas remotas de aislamiento RLS. Los problemas identificados por código se distinguen de los reproducidos en navegador.

## 3. Funciones que existen realmente

| Área | Función actual | Diferencia por rol o límite |
| --- | --- | --- |
| Resumen | Ventas, evolución, conversión, productos, clientes y lecturas disponibles | Comparte `ClientShopify`; el consultor recibe además información y acciones profesionales |
| Cartera Shopify | Tiendas ordenadas por urgencia, motivos y filtros | Consultor sin organización activa |
| Catálogo | Búsqueda, estado, periodo, ordenación, lista/cuadrícula y paginación | Disponible a ambos roles con acceso; métricas dependientes de cobertura |
| Producto | Medios, demanda/cobertura, ventas, variantes, promociones y descripción | La edición de costes locales aparece sin adaptar todos los permisos |
| Inventario | Agotados, stock bajo, con stock y sin lectura; variantes; reposición y stock parado | Crear tareas se muestra al consultor; no es un editor de cantidades de Shopify |
| Costes | Alta manual local e importación por SKU con previsualización | No modifica el coste remoto de Shopify; hay problemas de permisos, moneda y duplicados |
| Promociones | Consulta y detalle de descuentos, uso y cobertura | La ruta está bloqueada por un error de compilación en esta revisión |
| Nuevos códigos | Borrador y aprobación/aplicación de códigos porcentuales o de importe fijo | Código preparado para propietario/gestor con membership real; el consultor asignado no puede publicar por esta vía |
| Diagnóstico | Estado técnico, permisos de Shopify, sincronizaciones, muestras y paneles de análisis | La interfaz comprueba rol consultor/admin; su comprobación visual quedó bloqueada por compilación |
| Tiendas propias | Alta de organización, propietario real, plan y selector/listado | Existe la base; la presentación de Shopify sigue aplicando el rol global de consultor |

No se ha encontrado aquí una consola completa para editar productos, procesar pedidos, emitir reembolsos, hacer fulfillment o ajustar stock remoto. Las propuestas de nuevos códigos tampoco equivalen a gestionar todos los tipos de descuento de Shopify. No deben anunciarse esas funciones como existentes en este módulo.

### Evidencias principales del diseño actual

- [Router Shopify y pantalla de negocio](../../apps/web/src/app/shopify/page.tsx).
- [Pantalla compartida de negocio](../../apps/web/src/app/dashboard/client-shopify.tsx).
- [Navegación del módulo](../../apps/web/src/components/portal-navigation.ts#L233).
- [Catálogo y sus límites](../../apps/api/src/shopify-catalog.ts#L79).
- [Propuestas de descuentos y autoridad de escritura](../../apps/api/src/shopify-discount-proposals.ts#L106).

## 4. Comprobaciones realizadas

### Navegadores

| Comprobación | Consultor | Cliente |
| --- | --- | --- |
| Resumen de E-NORA Demo | Carga; muestra especialistas y límites del análisis | Carga; no muestra esa sección profesional |
| Catálogo | 23 filas observadas | 23 filas observadas |
| Ficha de producto | Bolso Mini Bruma: detalle y botón de editar coste visibles | Revisión del componente compartido y permisos; no se completó la navegación individual |
| Inventario | 11 filas entre reposición y stock parado; 11 botones «Crear tarea» | Carga; sin botones «Crear tarea» |
| Grupo Agotados | Componente y contrato revisados | Carga con 4 filas en la muestra |
| Promociones | Error de compilación `Export Sheet doesn't exist in target module` | Mismo bloqueo al abrir la ruta |
| Diagnóstico técnico | Intentado; bloqueado por el mismo error de compilación | Intentado; bloqueado. Restricción de rol comprobada en código, no visualmente |
| Consultor propietario de tienda conectada | Modelo y código revisados | No aplica |

Las cifras anteriores son observaciones de la muestra local, no objetivos ni garantías de cobertura.

### Pruebas automáticas existentes

- **API Shopify: 28 archivos, 127 pruebas, 127 correctas, 0 fallidas.** Se ejecutaron los archivos `apps/api/src/shopify*.test.ts` con `node --import tsx --test --test-reporter=tap --test-force-exit`.
- **Web Shopify: 39 archivos, 166 pruebas, 166 correctas, 0 fallidas.** Se ejecutaron todos los `.test.ts` dentro de `apps/web/src/app/shopify`, incluido diagnóstico.
- Además se ejecutó una selección de 44 pruebas con costes, descuentos, métricas, permisos, organización propia y guarda de acceso: todas correctas. Esta selección se solapa con la anterior y **no se suma** al total de 293 pruebas específicas de Shopify.
- Estas pruebas validan principalmente lógica, contratos y funciones con dobles de prueba. No prueban por sí solas la navegación completa, la base desplegada ni la creación real de descuentos.
- El chequeo global de tipos de web (`tsc --noEmit --pretty false --incremental false`) termina con **20 errores** en el estado actual: uno es el import de `Sheet` en Shopify descrito en SH-02 y los otros 19 están fuera del módulo. No equivale a una compilación global correcta.

## 5. Incidencias que corregir antes de ampliar el módulo — P1

### SH-01. La caché de métricas puede prolongar un acceso revocado

**Estado:** confirmado por recorrido de código; no se revocaron permisos reales para explotarlo.

**Caso:** un consultor consulta una tienda, se retira su asignación y conserva una sesión válida con acceso a otras organizaciones. La ruta resuelve su identidad, pero `getShopifyMetrics` puede devolver una respuesta ya cacheada antes de comprobar otra vez su acceso a esa tienda.

**Evidencia:** [wrapper de métricas](../../apps/api/src/shopify-metrics.ts#L1058), [retorno de caché](../../apps/api/src/swr-cache.ts#L44), [guarda que delega si no encuentra membership](../../apps/api/src/organization-settings.ts#L474). Las comprobaciones de pertenencia y tienda están dentro del cálculo que solo se ejecuta al cargar/refrescar. La clave incluye usuario, pero eso no invalida un permiso que acaba de cambiar. La ventana configurada es 60 segundos de frescura y 600 de copia anterior.

**Corrección mínima:** comprobar autorización vigente de organización/tienda antes de entrar en la caché, también al servir una copia anterior. Revisar las condiciones financieras que deben comprobarse en vivo. La invalidación complementa ese control; no lo sustituye.

**Aceptación:** calentar caché, retirar acceso o limitar las tiendas y repetir la misma URL: debe denegarse aunque exista respuesta en Redis. Hacerlo con un consultor que siga teniendo otra organización accesible.

### SH-02. Promociones no compila en el estado actual

**Estado:** reproducido en ambos navegadores.

**Problema:** [discount-proposal-workspace.tsx:6](../../apps/web/src/app/shopify/promociones/discount-proposal-workspace.tsx#L6) importa `Sheet` desde la biblioteca común, que ya no lo exporta. El error impide abrir Promociones y contaminó las comprobaciones posteriores de diagnóstico en el servidor de desarrollo.

**Corrección mínima:** coordinar con la migración de componentes y adaptar este workspace al componente y contrato vigentes. No añadir un segundo sistema de paneles para ocultar el problema.

**Aceptación:** listado, detalle, apertura/cierre del borrador y permisos funcionan para ambos roles. Probar la aprobación real solo en una tienda de prueba y con autorización para esa escritura.

### SH-03. El permiso de editar configuración no permite al consultor gestionar costes

**Estado:** confirmado en código; botón de editar coste observado en la ficha del consultor.

**Caso:** un consultor asignado tiene `edit_config=true`. La guarda admite la familia `shopify/product-costs`, pero el servicio exige `owner` o `manager`; la membership virtual del consultor usa `role: "consultant"`. El botón de la ficha y el formulario general no explican esa denegación. También se ofrecen controles de coste a usuarios sin autoridad suficiente.

**Evidencia:** [reglas de permisos](../../apps/api/src/org-access-guard.ts#L61), [membership virtual](../../apps/api/src/auth-context.ts#L532), [assertCanManage](../../apps/api/src/shopify-product-costs.ts#L24), [CostForm](../../apps/web/src/app/shopify/trust-strip.tsx#L104), [CostCell](../../apps/web/src/app/shopify/productos/%5BproductId%5D/page.tsx#L70).

**Corrección mínima:** una decisión coherente entre servicio, guarda y UI. Si `edit_config` incluye costes, reconocer expresamente al consultor asignado autorizado; si se reserva al propietario, cambiar el permiso y el mensaje. Los perfiles de solo lectura deben ver el coste sin un editor utilizable.

**Aceptación:** propietario y gestor; consultor con permiso concedido/retirado; miembro y solo lectura. Comprobar UI y petición directa, no solo ocultar el botón.

### SH-04. El formulario rápido y el importador pueden guardar costes en EUR para una tienda de otra moneda

**Estado:** confirmado en los payloads y valores por defecto; no se escribió un coste real.

**Caso:** en una tienda USD se introduce un coste de 10 desde el resumen o el pegado. Esas pantallas no envían moneda y el servicio usa `EUR`. La ficha individual sí envía la moneda del producto: las rutas no se comportan igual.

**Evidencia:** [formulario rápido](../../apps/web/src/app/shopify/trust-strip.tsx#L113), [importador](../../apps/web/src/app/shopify/product-cost-import.tsx#L73), [alta manual](../../apps/api/src/shopify-product-costs.ts#L177), [importación](../../apps/api/src/shopify-product-costs.ts#L462).

**Impacto:** se guarda una divisa incorrecta. La protección de monedas puede bloquear después los cálculos financieros; no se debe asumir que todos los consumidores corregirán ese dato.

**Corrección mínima:** resolver la moneda de la tienda del artículo en servidor y mostrarla en el formulario/previsualización. El importador debe recibir un alcance de tienda explícito y no adivinar por SKU entre varias tiendas. Con moneda desconocida, pedir confirmación o bloquear; no asumir EUR.

**Aceptación:** misma prueba en EUR y USD; dos tiendas con el mismo SKU; moneda desconocida. El coste guardado conserva la moneda y el artículo correctos.

### SH-05. Editar manualmente un coste puede crear dos costes vigentes para el mismo día

**Estado:** confirmado en código y migraciones del repositorio; no contrastado contra restricciones añadidas manualmente en la base remota.

**Caso:** guardar dos veces el coste de una variante el mismo día. El supuesto `upsertProductCost` hace `insert` y usa la fecha actual. La definición revisada no impone unicidad por artículo/fecha; el cálculo financiero escoge un coste ordenando solo por `valid_from DESC`.

**Evidencia:** [escritura manual](../../apps/api/src/shopify-product-costs.ts#L168), [tabla de costes](../../supabase/migrations/20260715173726_db_05_shopify_vertical_slice.sql#L199), [selección financiera](../../supabase/migrations/20261116000000_shopify_order_item_net_metrics.sql#L298). El importador intenta actualizar el coste del día, pero mediante comprobación y escritura separadas, sin una garantía equivalente frente a concurrencia.

**Impacto:** puede haber dos valores igualmente elegibles y un margen que use un coste distinto del último que el usuario cree haber guardado.

**Corrección mínima:** definir una única regla de vigencia, limpiar duplicados existentes tras revisarlos y hacer la escritura atómica con la restricción adecuada. Conservar costes históricos de otros días.

**Aceptación:** dos guardados consecutivos y dos simultáneos producen una única versión aplicable; los pedidos de fechas anteriores mantienen su coste histórico.

### SH-06. Un fallo al cambiar periodo puede dejar cifras anteriores con la etiqueta del periodo nuevo

**Estado:** confirmado por código; no se provocó un fallo de red para modificar la sesión del usuario.

**Caso:** cargar 30 días, cambiar a 90 y que falle la petición nueva. `useKeepPrevious` conserva los datos anteriores para la misma organización/tienda, mientras el texto usa el selector `days`. El bloque de error general solo cubre ausencia de datos; con datos retenidos no aparece una recuperación clara.

**Evidencia:** [retención de datos](../../apps/web/src/app/dashboard/client-shopify.tsx#L151), [estado visual de actualización](../../apps/web/src/app/dashboard/client-shopify.tsx#L291), [etiqueta de periodo](../../apps/web/src/app/dashboard/client-shopify.tsx#L311).

**Corrección mínima:** etiquetar las cifras con el periodo realmente recibido, mostrar que se conserva una copia anterior y ofrecer reintento si falla la actualización. Atenuar la vista no basta para explicar qué periodo representan los importes.

**Aceptación:** con una respuesta fallida para 90 días, no presentar los importes de 30 como si fueran de 90; tampoco enviar ese periodo incorrecto al copiloto.

## 6. Incidencias importantes — P2

### SH-07. El resumen técnico mezcla el estado de sincronización de varias conexiones

**Caso:** la tienda A se sincronizó hoy y B lleva días sin actualizarse. Al seleccionar B, `loadLatestSync` y `loadSyncBlocks` filtran por organización/proveedor, no por conexión; la cabecera y el diagnóstico pueden atribuirle el trabajo de A. Además, una conexión explícita no encontrada cae por defecto en otra conexión.

**Evidencia:** [sync general](../../apps/api/src/shopify-overview.ts#L381), [bloques](../../apps/api/src/shopify-overview.ts#L413), [selección con fallback](../../apps/api/src/shopify-overview.ts#L631).

**Solución:** filtrar estado y bloques por la conexión seleccionada; si se pidió una conexión inválida, devolver estado no encontrado. **Aceptación:** dos tiendas con fechas/errores diferentes muestran solo su propio estado.

### SH-08. «Cifras fiables» usa una comprobación más débil que las cifras financieras

**Caso:** existen costes, pero algunos son estimados con el coste actual, o la moneda de los costes es incompatible. El resumen puede mostrar una advertencia financiera mientras la tira de confianza afirma que las cifras son fiables.

**Evidencia:** [TrustMetrics y checks](../../apps/web/src/app/shopify/trust-strip.tsx#L11), [metricsAllOk](../../apps/web/src/app/shopify/trust-strip.tsx#L158), [guardas financieras más completas](../../apps/web/src/app/dashboard/client-shopify.tsx#L154).

**Solución:** compartir la decisión de cobertura y distinguir «completo», «estimado» e «incompatible». **Aceptación:** no mostrar un estado global verde cuando el margen está bloqueado o es estimado; conservar el detalle explicativo.

### SH-09. El acceso limitado a una tienda no está resuelto de forma uniforme

**Caso:** un usuario con membership limitada a una tienda aparece en bootstrap y puede ser autorizado por métricas, pero overview y catálogo exigen una membership a nivel de organización. El resumen puede fallar antes de llegar a mostrar las métricas permitidas.

**Evidencia:** [separación deliberada de memberships](../../apps/api/src/auth-context.ts#L625), [bootstrap](../../apps/api/src/server.ts#L1251), [métricas con comprobación de tienda](../../apps/api/src/shopify-metrics.ts#L435), [catalogScope](../../apps/api/src/shopify-catalog.ts#L362), [getShopifyOverview](../../apps/api/src/shopify-overview.ts#L609).

**Solución:** completar las rutas necesarias con una guarda por tienda, manteniendo denegación para el resto. **Aceptación:** el usuario puede usar su tienda autorizada y recibe denegación para cualquier otra; no ampliar su membership a toda la organización para hacer funcionar la interfaz.

### SH-10. Las recomendaciones de inventario solo examinan la primera página de productos

**Caso:** un catálogo tiene más de 24 productos. Reposición examina la primera página ordenada por stock; stock parado examina la primera página sin ventas ordenada por nombre y solo después ordena sus unidades. Un producto fuera de esos 24 puede ser el más importante y no entrar en el resultado.

**Evidencia:** [consultas y ranking local](../../apps/web/src/app/shopify/inventario/page.tsx#L82), [tamaño de página](../../apps/api/src/shopify-catalog.ts#L79).

**Solución:** seleccionar y ordenar candidatos en servidor antes del límite de resultados, con el mismo alcance de tienda. **Aceptación:** un producto relevante en la página 2 puede entrar entre los seis primeros; no afirmar «nada urgente» por haber examinado una muestra insuficiente.

### SH-11. Una consulta secundaria de inventario puede quedar en carga indefinida o desaparecer sin explicación

**Caso:** carga el resumen, pero falla `lowest` o `idle`. Para reposición, `!lowest.data` sigue mostrando «Calculando…» sin mirar el error; stock parado se omite si no hay datos.

**Evidencia:** [estado de reposición](../../apps/web/src/app/shopify/inventario/page.tsx#L130), [stock parado](../../apps/web/src/app/shopify/inventario/page.tsx#L175).

**Solución:** estados independientes de carga, error, vacío y reintento. **Aceptación:** un fallo de la consulta no se presenta como ausencia de problemas ni como cálculo permanente.

### SH-12. Las tareas manuales de Shopify pierden la referencia estructurada a la tienda

**Caso:** dos tiendas del mismo cliente venden «Camiseta básica». La tarea de reposición transmite organización, título y descripción, pero no la conexión, el producto/variante ni un enlace a su origen. Después cuesta distinguir qué tienda requiere el trabajo.

**Evidencia:** [TaskButton](../../apps/web/src/app/shopify/task-button.tsx), [payload de createLeverTask](../../apps/web/src/app/panel/panel-data.ts#L169), [llamada desde inventario](../../apps/web/src/app/shopify/inventario/page.tsx#L151).

**Solución:** conservar la referencia de origen mediante el contrato de tareas, incluyendo alcance de tienda y recurso; como mínimo, nombre de tienda y enlace con organización/conexión. **Aceptación:** abrir la tarea permite volver al recurso exacto sin depender del selector global actual.

### SH-13. El peso económico de la cartera se etiqueta siempre en euros

**Caso:** una tienda factura en USD. El mapa de atención toma su `revenue` y lo formatea con `€`, sin conversión ni separación por moneda. El ranking de urgencia no depende de ese importe, pero la etiqueta y la comparación visual pueden ser engañosas.

**Evidencia:** [formatWeight y revenueByConnection](../../apps/web/src/app/shopify/page.tsx#L670).

**Solución:** conservar divisa por tienda y separar o desactivar la comparación monetaria entre divisas. **Aceptación:** nunca renombrar USD como EUR ni comparar áreas como si representaran importes equivalentes.

### SH-14. Catálogo y detalle no conservan todos los filtros al navegar

**Caso:** buscar, cambiar periodo, página o cuadrícula, abrir una ficha y volver. Varios estados solo viven en `useState`; el enlace de regreso no conserva esos filtros y el detalle comienza con su propio periodo de 90 días.

**Evidencia:** [estado del catálogo](../../apps/web/src/app/shopify/productos/page.tsx#L190), [estado y regreso de ficha](../../apps/web/src/app/shopify/productos/%5BproductId%5D/page.tsx#L153).

**Solución:** serializar los filtros relevantes en URL y conservar un destino de regreso validado. **Aceptación:** volver, recargar y compartir enlace mantiene búsqueda, periodo y alcance; no aceptar destinos externos arbitrarios.

### SH-15. «Todas las tiendas» promete una suma que el contrato actual ya rechaza

**Caso:** hay varias tiendas y no se selecciona una. La banda de página dice que las cifras inferiores son la suma de todas, mientras métricas devuelve `shopify_store_selection_required` y el componente pide elegir tienda.

**Evidencia:** [banda de agregado](../../apps/web/src/app/shopify/page.tsx#L385), [API de alcance monetario](../../apps/api/src/shopify-store-scope.ts), [estado correcto del componente](../../apps/web/src/app/dashboard/client-shopify.tsx#L221).

**Solución:** mostrar una portada de selección/comparación, sin promesa de suma ni ficha de una conexión escogida por defecto. **Aceptación:** el encabezado, el selector y el contenido describen el mismo alcance. La protección que impide mezclar importes debe mantenerse.

## 7. Qué conservar y qué mejorar en el producto

### Conservar

- Las cuatro entradas actuales: Resumen, Productos, Inventario y Promociones. Ya separan trabajos útiles.
- La pantalla compartida de negocio; evitar dos versiones de las mismas fórmulas para consultor y cliente.
- Guardas de moneda/cobertura, distinción entre cero y dato no disponible, y petición de tienda explícita cuando hay varias.
- Paginación, previsualización de importaciones y rechazo de SKU ambiguos.
- En descuentos, el control de propietario/gestor, scopes, idempotencia, estados de aplicación y reconciliación de respuestas ambiguas. Las pruebas locales de esas reglas pasan; falta validar la operación real.
- Verificación HMAC en webhooks, cola duradera y reintentos del cliente Shopify. Su existencia no equivale a haber probado una entrega remota en esta auditoría.

### Mejoras después de P1

1. **Acciones según capacidad.** Mostrar «Puedes consultar», «Puedes editar costes» y «Puedes aprobar códigos» desde la autoridad real. Distinguir proponer de publicar. El consultor asignado no debería obtener publicación remota por activar una vista profesional.
2. **Una señal de frescura por tienda.** Fecha de último dato válido, bloque pendiente, histórico importado y botón de recuperación adecuado al permiso. Para periodos largos, explicar cobertura; no solo al elegir «Todo».
3. **Resumen con siguientes pasos concretos.** Tres a cinco prioridades enlazadas al producto, variante o promoción correspondiente. Distinguir consejo, tarea interna y cambio remoto.
4. **Inventario útil para actuar.** Cantidad sugerida y cobertura con su método/limitaciones; separar sin seguimiento de agotado. Enlaces al recurso en Shopify cuando la ejecución deba hacerse allí. No presentar tareas de reposición como cambios de stock realizados.
5. **Costes con contexto.** Moneda, fecha de vigencia, artículo/variante y procedencia antes de guardar. Importar dentro de una tienda seleccionada y conservar el historial.
6. **Promociones con alcance visible.** Antes de aplicar: tienda, moneda, porcentaje/importe, productos afectados, fechas y límites. Mantener una confirmación clara de quién aprueba la escritura.
7. **Análisis profesional como detalle.** Evitar que el diagnóstico técnico sea el flujo principal del propietario. En las lecturas almacenadas observadas aparecía un aviso de herramienta `shopify_customer_health` no disponible; comprobar compatibilidad/frescura antes de tratar esa lectura como actual. No se relanzó el agente para verificar su configuración presente.
8. **Rendimiento medido.** El resumen carga métricas, insights, varias lecturas y un overview que incluye muestras/conteos técnicos. Medir solicitudes y latencia sin caché y separar lo que necesita la portada de lo que solo necesita diagnóstico. No crear otra caché que eluda autorización para resolver la latencia.

## 8. Consultor con tienda propia: solución propuesta para la cola

### Lo que ya existe

- [createOwnStore](../../apps/api/src/consultant.ts#L6506) crea la organización de negocio y una membership real `owner` del consultor, sin asignarse a sí mismo como consultor del cliente.
- El alta crea además una suscripción propia; actualmente el código utiliza plan `consultant`, estado `active` y límite de dos tiendas Shopify. Es configuración encontrada en código, no una validación del contrato comercial.
- [Tiendas](../../apps/web/src/app/tiendas/page.tsx) consulta `GET /v1/consultant/own-stores` y permite el alta por `POST`.
- [La cabecera](../../apps/web/src/components/portal-shell.tsx#L924) reconoce memberships reales y ofrece «Mis tiendas» junto a los clientes asignados.
- `organizations.kind = consulting` identifica la empresa de consultoría, que no debe confundirse con una tienda de negocio. [Auth context](../../apps/api/src/auth-context.ts#L610) la convierte en `consulting_organization`.

### Matriz de experiencia deseada

| Contexto activo | Vista por defecto | Acciones | Información profesional |
| --- | --- | --- | --- |
| Consultor sin organización | Cartera Shopify | Abrir cliente/tienda | Ranking y motivos |
| Consultor en cliente asignado | Consultor | Según permisos delegados; publicación remota requiere autoridad específica | Disponible |
| Consultor en tienda propia como owner | Negocio, igual que cliente propietario | Según membership real y scopes de esa conexión | Disponible mediante cambio de vista |
| Cliente owner/manager | Negocio | Según su rol y scopes | Sin diagnóstico técnico general |
| Cliente miembro/solo lectura | Negocio | Solo capacidades permitidas | Sin botones de escritura engañosos |
| Usuario limitado a una tienda | Negocio de esa tienda | Según su rol y alcance | Nunca datos de otras tiendas |
| Organización de consultoría | Gestión de consultora | Sus propios ajustes | No un Shopify ficticio de la empresa de consultoría |

### Implementación mínima recomendada

1. Resolver el contexto activo usando organización, conexión, `kind`, `accessSource`, rol de la membership y alcance de tiendas. El rol global `consultant` no responde por sí solo a «qué puedo hacer aquí».
2. En tienda propia, usar el mismo resumen de negocio y las mismas subpáginas del cliente. Indicar «Tu tienda» y su nombre; conservar visibles organización/conexión cuando haya varias.
3. Añadir «Vista negocio / Análisis del consultor» para quien realmente puede usar ambas. Guardar esa preferencia por contexto o en URL; no hacerla una preferencia global que cambie todos los clientes.
4. Reutilizar `ClientShopify` y sus componentes. Hoy `ShopifyBusinessView` pasa `asConsultant={isConsultant}`: cambiar esa decisión de presentación por el contexto elegido, sin rebajar los controles del servidor.
5. Mantener separado **modo de presentación** y **autorización**. Un parámetro de URL no concede ownership, edición de costes, publicación o acceso técnico. Tampoco convertir al consultor en usuario cliente globalmente.
6. En tienda propia sin consultor asignado, no mostrar «espera a tu consultor» ni crear una asignación a sí mismo para que aparezcan funciones. Usar su condición de propietario y la asistencia IA correspondiente.
7. Al cambiar de tienda, cancelar/descartar respuestas tardías y cerrar borradores ligados a otra conexión. Conservar únicamente preferencias que sigan teniendo sentido en el nuevo contexto.
8. Revisar los permisos de la operación concreta: editar costes locales, crear tarea, conectar Shopify y aplicar descuentos son capacidades diferentes.

Esto requiere una experiencia contextual y unas reglas compartidas, no clonar `/shopify` en una nueva aplicación para propietarios consultores. Si se desea un acceso nuevo en el menú, «Mi Shopify» puede ser un enlace al mismo módulo con su tienda seleccionada.

### Criterios de aceptación de la tienda propia

- El consultor sigue entrando a su cartera y clientes después de abrir su tienda propia.
- Elige su organización de negocio y la conexión correcta; no se conecta Shopify a la organización de consultoría.
- Ve por defecto la misma información de negocio que un cliente propietario, con el mismo periodo, moneda y reglas de cobertura.
- Puede abrir análisis profesional sin que eso cambie sus permisos ni los de otros clientes.
- Como owner real puede gestionar costes y, con scopes válidos y confirmación, aprobar códigos de su tienda; no hereda ese poder en tiendas asignadas.
- Un consultor asignado con permisos reducidos sigue recibiendo denegación en peticiones directas aunque fuerce el modo de presentación.
- Dos tiendas propias o una propia y un cliente con el mismo SKU no mezclan costes, tareas, cachés, borradores ni resultados.
- Un cambio de permisos o propiedad se respeta antes de servir una respuesta cacheada.
- Se prueba el ciclo de alta, plan/límite, conexión, desconexión y recuperación en TEST. **Ese ciclo no se ha ejecutado en esta auditoría.**

## 9. Orden recomendado de trabajo

| Fase | Trabajo | Condición para terminar |
| --- | --- | --- |
| 1. Coherencia y acceso | SH-01 a SH-06, coordinando SH-02 con la migración de UI | Permisos, costes y periodo correctos; Promociones compila |
| 2. Varias tiendas y datos | SH-07 a SH-13 y SH-15 | Alcance consistente, ranking completo y estados de error claros |
| 3. Navegación | SH-14 y presentación de prioridades/cobertura | Volver y compartir conserva el contexto |
| 4. Tienda propia | Experiencia contextual del apartado 8 | Matriz de roles y recorrido de propietario validados en TEST |
| 5. Cierre | Pruebas de navegador y aislamiento contra base de TEST, más operación Shopify autorizada | Verificados los caminos reales, no solo funciones puras |

No recomiendo empezar por una nueva página de propietario mientras existan los bloqueos de permisos y costes. La base de datos y la pantalla compartida ya permiten abordar esa experiencia con un cambio más pequeño.

## 10. Validaciones que faltan para declarar el módulo listo

- Revocación de asignación y limitación de tiendas con cachés calientes.
- Matriz HTTP de lectura/escritura: owner, manager, miembro, readonly, consultor delegado y consultor propietario.
- Costes consecutivos/concurrentes, fechas históricas y dos divisas, con la versión real de las migraciones en TEST.
- Organizaciones con varias conexiones: selección inválida, sincronizaciones independientes y copia anterior de métricas.
- Catálogo mayor de 24 productos y grupos de inventario con varias páginas.
- Códigos reales en una tienda de prueba: creación, confirmación, conflicto, expiración y respuesta ambigua, sin duplicar escrituras.
- OAuth, renovación, desconexión, entrega/reintento de webhooks y reconciliación contra Shopify real de TEST.
- Vista propia con tienda conectada, cambio de contexto y regresión en cliente normal.
- Repetir diagnóstico y promociones cuando termine la migración compartida; comprobar también móvil, teclado y lectores de pantalla. No se hizo una auditoría WCAG completa.

## 11. Referencias externas contrastadas

- Shopify restringe por defecto la lectura de pedidos a los últimos 60 días; el histórico anterior requiere acceso adicional. Esto debe reflejarse como cobertura, no confundirse con ventas cero: [Order, API 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Order).
- Los campos de códigos básicos, contexto, límites y tags usados por la implementación se contrastaron con [DiscountCodeBasicInput](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DiscountCodeBasicInput) y [DiscountCodeBasic](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/DiscountCodeBasic). No se ejecutó una mutación remota.
- Las consultas con credenciales de servicio necesitan controles explícitos, porque ese rol puede eludir RLS: [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). Esta revisión no certifica las políticas desplegadas.

**Veredicto:** conservar la estructura y la base compartida; corregir primero P1 y comprobar varias tiendas. Para el consultor propietario, usar una vista de negocio contextual sobre el módulo existente, con acceso profesional opcional y autorización independiente.
