# A02 en la interfaz

Los identificadores señalan ubicaciones permanentes. El contenido procede de la última lectura guardada del agente para la organización, tienda, ventana y vista correspondientes. Abrir una pantalla o pulsar «Volver a cargar» consulta la API; no ejecuta el agente.

| Marca | Ubicación | Contenido |
|---|---|---|
| A02 · 01 | Pulso web, antes de Prioridades; cliente y consultor | Titular y hallazgos generales |
| A02 · 02 | Resumen de Shopify | Ventas, finanzas, stock y operativa |
| A02 · 03 | Resumen de Meta Ads | Área Meta, con atribución y evidencia conservadas |
| A02 · 04 | Resumen de Klaviyo | Área Klaviyo |
| A02 · 05 | Rentabilidad del consultor | Vista privada `panel`, 30 o 90 días; lectura general recortada si aún no existe la específica |
| A02 · 06 | Integraciones | Hallazgos de `integraciones` para todas las tiendas de la organización mostrada |
| A02 · 07 | Mi Camino, cliente y consultor | Contexto de ventas y finanzas para revisar el plan; no evalúa por sí solo su cumplimiento |
| A02 · 08 | Tareas de una organización/tienda | Contexto del negocio para priorizar; no crea tareas |
| A02 · 09 | Pulso móvil | Resumen de 30 días para la tienda seleccionada o el agregado, con detalle desplegable |

## Contrato de presentación

`packages/contracts/src/a02-reading.ts` contiene el registro y la proyección compartida por web y móvil. Los destinos seleccionan secciones por su clave estable; no dependen de palabras del título. Los hallazgos históricos agregados se deduplican con los de las secciones. Las cifras y recomendaciones se muestran tal como las entrega el agente. Las valoraciones individuales de KPI siguen perteneciendo a A29.

Las ventanas del agente pueden diferir del selector de métricas de la página. La interfaz muestra explícitamente «Ventana de 30 días» y avisa si la vista presenta otro periodo. La ubicación permanece; su contenido y estado cambian con cada lectura válida. Se conserva el contexto de organización y tienda en los enlaces.

## Estados

- Cargando: la consulta inicial sigue en curso.
- Pendiente: aún no existe lectura; la genera el ciclo automático.
- No disponible: error de carga, output inválido o falta de datos sincronizados. Nunca equivale a buena salud.
- De prueba: resultado de laboratorio identificado por sus advertencias; se ocultan su titular, cifras y recomendaciones. La API de A02 devuelve `agent_diagnostic_test_only` sin ese contenido. El control de cliente también protege cachés anteriores.
- Lectura anterior: el backend indica caducidad o venció la validez declarada. El contenido queda accesible bajo «Consultar lectura anterior».
- Sin actividad nueva: se respeta la decisión de frescura del servidor; una lectura conservada por falta de actividad no se declara caducada solo por su fecha.
- Evidencia insuficiente: sin hallazgos y con confianza baja o cobertura parcial/insuficiente; se explica la limitación.
- Área ausente: la lectura no incluye la sección solicitada. No implica que la sección esté bien.
- Área vacía: existe una sección válida, con suficiente evidencia, y no se señalaron hallazgos. El texto evita declarar buena salud.
- Con hallazgos: frase compacta y detalle bajo demanda, con evidencia, cifras y recomendaciones de revisión.

Las recomendaciones de A02 son de solo lectura. Su contrato entrega `proposed_writes: []`. Crear tareas, revisar planes y ejecutar cambios sigue pasando por las acciones existentes y sus permisos. La lectura privada `panel` no se reutiliza en ubicaciones del cliente.

## Comprobaciones

Las pruebas del proyector cubren ausencia frente a error, área ausente frente a vacía, datos de laboratorio, aislamiento de la lectura privada, caducidad, ausencia de actividad, evidencia insuficiente y procedencia de la lectura general usada en un canal.
