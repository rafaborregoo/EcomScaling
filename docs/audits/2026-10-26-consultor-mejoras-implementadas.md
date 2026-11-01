# Consultor: mejoras implementadas

26 de octubre de 2026. Entrega sobre el árbol de trabajo existente. Código actualizado en local; ambas migraciones aplicadas a **TEST ES IA**. Producción pendiente de despliegue.

## Cambios

| Hallazgo de la auditoría | Corrección |
| --- | --- |
| Permisos que se habilitaban al fallar una lectura | La lectura falla de forma explícita y la guarda responde 503 antes de escribir. Una fila inexistente conserva los valores por defecto del producto. |
| Pantalla «Tus permisos» rota | Relación del cliente identificada por su clave foránea. Los errores de lectura se muestran como errores, con reintento. Comprobado en la sesión real del consultor. |
| Mezcla de contexto entre tiendas | Meta, Klaviyo y operaciones reciben la conexión seleccionada. Una conexión desconocida falla sin ampliar al agregado. El plan del escritorio consulta fases e hitos del plan activo de esa tienda. La relación y las revisiones se identifican como datos del cliente. |
| Informes mensuales sin tienda | Selector visible, validación de pertenencia y tienda activa, persistencia del alcance y unicidad por cliente, plantilla y tienda. Los formularios toman inicialmente la tienda activa. |
| Visibilidad de borradores | Política restrictiva que mantiene la condición de publicación aunque existan políticas permisivas de acceso a la tienda. La lectura de las tablas hijas conserva la protección del padre. |
| Comprobaciones de preparación fallidas | Corregidos fixture de tipos, enlaces locales, registro de pruebas, reemplazos de funciones SQL y seis activaciones de agentes. Las activaciones usan la RPC de promoción serializada existente. Se mantiene la política de evaluación vigente del proyecto. |
| Revisiones de tiendas propias invisibles | La política admite las revisiones del propio consultor cuando es propietario activo de una organización cliente. No concede acceso a notas de otros autores. |
| «Abrir tienda» perdía la selección | Enlaces con cliente y conexión. Los destinos de trabajo y analítica conservan ese contexto. |
| Un correo fallido consumía el mes | PDF pendiente persistido, reintento del mismo documento, error e intento registrados, concesión temporal para evitar trabajadores simultáneos y avance del mes solo tras aceptación SMTP. Se conserva la aceptación por destinatario para reintentar únicamente los pendientes. Las organizaciones suspendidas no envían. |

## Mejoras para el piloto

- **Puesta en marcha por cliente:** cuatro pasos derivados de evidencia guardada: vinculación, sincronización reciente de Shopify, costes configurados con revisión explícita y próxima acción con responsable y fecha. Una fuente fallida aparece como «Sin comprobar».
- **Prioridad compartida:** Gestión usa el mismo resultado de la mesa diaria. Si no se puede comprobar, no muestra «Al día».
- **Contexto visible:** cliente y tienda en el inicio, tienda en el historial de informes y diferenciación de la relación general del cliente. Con varios planes activos se solicita seleccionar una tienda.
- **Entrega de informes visible:** PDF generado, entrega pendiente, último mes enviado e intento fallido. El criterio de cierre de las tareas ya existente se recuerda en la incorporación.
- **Tiendas propias:** siguen disponibles desde Gestión y Tiendas, separadas de la cartera de clientes; sus revisiones personales quedan accesibles.
- **Procedimientos reutilizables:** alta de cliente, revisión semanal y cierre mensual disponibles al crear una tarea. Precargan pasos, fecha sugerida y criterio de cierre, conservan la tienda y asignan inicialmente al consultor. El formulario sigue siendo editable y conserva la aprobación del cliente cuando corresponde.
- **Marca visual:** logo PNG/JPG y color oscuro de la consultora en los nuevos PDF, incluidos cartera y tiendas propias. El color se valida para texto legible; el logo se descarga desde Storage, con límites de tamaño y dimensiones. Un logo ilegible conserva la firma de texto. Los PDF ya generados permanecen iguales durante un reintento.

También se corrigió la apertura de Gestión cuando el enlace incluye un cliente y dos escrituras de referencias de React durante el renderizado que impedían pasar el lint global.

## Validación

- **163 pruebas de API:** cartera, prioridades, accesos, asignación, tiendas, informes, marca, integraciones y regresiones nuevas. HTTP y SMTP simulados para los casos de error, recuperación y aceptación parcial; sin mensajes reales.
- **571 pruebas de web:** suite completa, incluidos los procedimientos nuevos.
- **19 guardas de `npm run verify`:** todas pasan.
- **Tipos de API y worker:** pasan. Web pasó antes de una migración concurrente del componente compartido de tablas. La última ejecución global de web falla por esa migración (`TableColumnDef` y consumidores de la API anterior de `Table`). El usuario confirmó que otra sesión está trabajando en las tablas; no se modificó ese trabajo. Es necesario repetir este control cuando termine.
- **Lint global de web:** pasa.
- **15 aserciones de base de datos en TEST:** borradores, fases e hitos ocultos para `member` y `readonly`; lectura de planes publicados; aislamiento de una segunda tienda; acceso del consultor asignado; revisión de tienda propia y aislamiento entre autores; dos programaciones de la misma plantilla en tiendas distintas. Fixtures transaccionales con `rollback`, sin organizaciones residuales.
- **Navegador de consultor:** permisos reales, incorporación con progreso y prioridad compartida, historial y selector de tienda del envío mensual. Comprobado el formulario de tareas: los tres procedimientos están disponibles y «Alta de cliente» precarga título, pasos, criterio de cierre, fecha sugerida y tienda; se canceló sin crear una tarea. Comprobados los controles de logo, color, nombre comercial y correo de respuesta, sin guardar cambios.
- **Navegador de cliente:** comprobación del inicio y del contexto de tienda. Durante la revisión se detectó una conexión de PostgREST en estado `idle in transaction (aborted)`: sus nuevas lecturas fallaban con `25P02`. El registro previo de ese proceso mostraba una cancelación `57014` a las 17:15:04 UTC. Se recicló únicamente esa conexión abortada de TEST para recuperar el servicio. Esto es una recuperación operativa; no demuestra que la incidencia del pool no pueda repetirse.
- **Móvil a 390 px:** comprobados ancho y límites de los controles de incorporación mediante el DOM; la captura por CDP falló, por lo que la revisión visual móvil queda parcial.
- **PDF de muestra:** renderizado con logo y acento verde; primera y última página inspeccionadas sin solapamientos. Prueba de dos renderizados simultáneos con colores distintos para comprobar que la marca no se comparte entre documentos.

## Operación y límites

Migraciones: [consultant_launch_readiness.sql](../../supabase/migrations/20270113100001_consultant_launch_readiness.sql) y [consultant_report_branding.sql](../../supabase/migrations/20270113100002_consultant_report_branding.sql). Creadas con la CLI y ordenadas después de las migraciones existentes, cuyo historial contiene fechas posteriores. Las versiones registradas en TEST coinciden con los archivos. Prueba repetible: [consultant_launch_readiness.sql](../../supabase/tests/consultant_launch_readiness.sql).

Aplicar ambas migraciones antes de desplegar la API y el worker en producción: las nuevas lecturas necesitan sus columnas. Reiniciar después los procesos que ejecuten código compilado. La API local se reinició para cargar las correcciones.

No se ejecutó el cron desplegado, un envío real de correo, OAuth ni publicación en proveedores. La aceptación SMTP confirma que el servidor aceptó el destinatario; no acredita entrega en bandeja de entrada. Si el proceso cae después de la aceptación SMTP y antes de guardar el recibo, un reintento puede duplicar ese correo: SMTP y PostgreSQL no comparten una transacción.

La prueba de varias tiendas utiliza fixtures de SQL y HTTP; no se activó una segunda tienda real del cliente. No se reconstruyó desde cero toda la base de datos ni se ejecutó una compilación de producción. Los procedimientos incluidos son tres modelos editables: no constituyen un editor de procedimientos personalizados ni ejecutan campañas automáticamente.

El asesor de Supabase mantiene avisos generales. El helper nuevo de RLS requiere ejecución por `authenticated`, vive en `private`, fija `search_path`, comprueba al usuario y solo devuelve sus organizaciones propias autorizadas. Se revisó el [aviso sobre funciones SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) con las pruebas de aislamiento indicadas.

Impeccable detectó que el índice derivado de diseño está desactualizado respecto a `DESIGN.md`; se puede sincronizar con `document` cuando se solicite.
