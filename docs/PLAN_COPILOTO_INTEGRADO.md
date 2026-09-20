# Plan de copiloto integrado

**Estado:** en curso.  
**Objetivo:** que el Consultor IA acompañe el trabajo en cada pantalla sin
ocultarlo, y que evolucione de conversación a sistema de decisión verificable.

## Principios no negociables

- En escritorio, el copiloto comparte el espacio de trabajo como panel derecho;
  no es un modal ni bloquea la aplicación.
- En móvil conserva un drawer accesible, porque dos columnas no son utilizables
  a ese ancho.
- Toda cifra debe declarar fuente, periodo y frescura. Una recomendación debe
  indicar incertidumbre y siguiente paso.
- La IA nunca escribe de forma silenciosa: propuesta, vista previa, aprobación,
  ejecución y rastro auditable son pasos separados.

## Entregas

| Fase                      | Resultado                                                                 | Estado       |
| ------------------------- | ------------------------------------------------------------------------- | ------------ |
| 1. Rail dockeado          | Columna derecha desktop, cierre no destructivo y drawer móvil.            | Implementado |
| 2. Historial              | Conversaciones recientes, búsqueda, nueva conversación y restauración.    | Implementado |
| 3. Respuesta estructurada | Resumen, hallazgos, evidencia, riesgo, recomendación y siguiente acción.  | Implementado |
| 4. Actividad visible      | Etapas del turno, herramientas, latencia, coste y errores accionables. | Implementado |
| 5. Acciones seguras       | Propuesta, aprobación, ejecución y resultado auditable.                   | Implementado |
| 6. Contexto de pantalla   | Ruta, cliente, tienda, periodo, resumen visible y foco de la pregunta. | Implementado |
| 7. Mejora continua        | Feedback por turno, evaluaciones y métricas de utilidad.                  | Implementado |
| 8. Auditoria transversal | Peticiones, cache, errores conocidos y ciclos de carga en todas las rutas. | En curso     |

## Iconografía

Se reutiliza el sistema de iconos existente. Los iconos son señales de acción,
no decoración: conversación (`MessageIcon`), cerrar (`CloseIcon`), redimensionar
(`GripVerticalIcon`), nueva conversación (`PlusIcon`), actividad (`SparklesIcon`),
evidencia (`CheckIcon`) y reintento (`RetryIcon`).

## Flujo de acciones seguras

El Consultor IA puede devolver `proposed_writes` con el motivo y la evidencia
que los justifican. El API los guarda como `pending_approval`; el panel muestra
la propuesta y solo el botón humano de aprobar llama al endpoint de decisión.
Al aprobar, el runtime materializa únicamente las propuestas de tipo tarea y
deja el rastro en `agent_outputs` y `agent_approvals`. Rechazar no modifica el
dominio.

## Mejora continua

Cada respuesta del copiloto ofrece un voto `Útil` / `No útil`, limitado a un
voto editable por usuario y mensaje. Se guarda junto al turno y se audita sin
guardar una encuesta adicional; al recargar la conversación el voto se
recupera para que la señal de calidad no dependa del estado local del panel.

## Gate final: auditoria transversal de datos y peticiones

Antes de cerrar el copiloto se auditara cada pantalla, no solo el dashboard:

- inventario de GET y porcentaje que pasa por cache stale-while-revalidate;
- deduplicacion de peticiones en vuelo y comportamiento con React Strict Mode;
- efectos que dependan de objetos inestables (`router`, bootstrap completo o props recreadas) y puedan formar ciclos de recarga;
- abort/cancelacion al desmontar, polling con intervalo explicito y ausencia de bucles de reintento para estados permanentes como `409`;
- lotes (`Promise.all`) con resultados parciales, errores por dominio y una sola solicitud por recurso cuando exista una alternativa agregada;
- preflight CORS y `maxAge`, ademas del presupuesto de peticiones por montaje.

El criterio de salida es que cada ruta tenga un presupuesto medido, cero ciclos de recarga espontaneos y una experiencia stale-while-revalidate al volver a una pantalla. La validacion se hara primero en `/shopify/diagnostico`, y despues en `/marketing`, `/consultor`, `/tareas`, `/llamadas`, `/configuracion`, `/camino` y `/dashboard`.

### Progreso de la auditoria

- `/shopify/diagnostico`: paneles y lotes principales migrados a la cache
  compartida; se conserva el resultado parcial cuando falla un dominio.
- `/marketing`: borradores, estado del runtime IA, integraciones y el espejo
  de marketing de la cartera usan cache stale-while-revalidate y
  deduplicacion en vuelo.
- `/consultor`: la cartera de clientes usa la misma cache; las acciones de
  alta, edicion y borrado fuerzan una recarga explicita.
- `/llamadas`: la vista de cartera deduplica y cachea su carga inicial; el
  registro y las decisiones de una llamada siguen siendo acciones explícitas.
- `/tareas`: operaciones, comentarios y cambios de estado reutilizan la
  carga cacheada; las mutaciones limpian el error de acción y fuerzan la
  revalidación.
- `/configuracion`: los contadores de cartera dejan de lanzar un `Promise.all`
  nuevo en cada montaje y cachean clientes y tiendas por separado.
- `/camino`: el estado agregado de planes de la cartera también queda en
  stale-while-revalidate, sin cambiar los enlaces de trabajo por cliente.
- `/tiendas`: tiendas propias y cartera reutilizan las respuestas cacheadas;
  crear, editar y borrar siguen invalidando mediante una recarga explícita.
- `/conocimiento`: la vista agregada y la lista de documentos del cliente
  reutilizan respuestas cacheadas; ingesta, edición y búsqueda siguen siendo
  acciones explicitas.
- `/integraciones`: el hub y las fichas de conectores comparten en cache el
  estado de integraciones y la asignacion de cuentas por tienda; OAuth,
  sincronizaciones y guardados siguen siendo mutaciones explicitas.
- `/shopify`: las métricas quedan cacheadas por organización, conexión y
  periodo; guardar costes y cargar un fichero fuerzan la revalidación.
- `/consultor`: acceso, tiendas conectadas y catálogo de tipos de objetivo
  reutilizan lecturas cacheadas; las altas, bajas, restauraciones y cambios de
  permisos fuerzan una recarga.
- `/configuracion`: cobertura Shopify y configuración financiera reutilizan
  lecturas cacheadas; guardar ajustes, gastos, objetivos y reglas revalida la
  respuesta.
- `/llamadas`: el plan estratégico usado para asignar hitos a tareas se
  reutiliza con caché y solo se consulta cuando hay un resumen pendiente de
  aprobación.
- `/tareas`: la cartera de operaciones y el plan usado al crear una tarea
  reutilizan lecturas cacheadas; comentarios, estados, alertas y creación de
  tareas siguen invalidando explícitamente.
- `/camino`: los objetivos del cliente reutilizan la lectura cacheada; las
  operaciones de edición del plan siguen con su refresco controlado porque
  mantienen actualizaciones optimistas y reordenación.
- Bootstrap global: el efecto de carga ya no depende de la identidad mutable
  de `router`; los indicadores derivados usan `bootstrapUserId` estable.
- API: CORS anuncia `maxAge` de 24 horas para evitar preflights repetidos; el
  panel de agentes no abre el `Promise.all` cuando `agent_autorun` está apagado.
- Verificación de navegador: el dev server carga la página de login con
  formulario e interacciones visibles, sin overlay ni errores de consola; la
  captura confirma contenido y `/dashboard` redirige a `/login` sin bucle.
- Pendiente: medir en navegador los presupuestos por montaje y revisar las
  pocas cargas interactivas que no deben entrar en cache (formularios y
  acciones de conectores). Las consultas de agentes IA
  quedan fuera mientras `AI_AUTORUN_ENABLED` siga apagado y no exista API key.

### Cierre administrativo y externo

- Los paneles de clientes, consultores, facturacion y observabilidad ya
  reutilizan sus lecturas con stale-while-revalidate. Las mutaciones, OAuth,
  sincronizaciones y trazas siguen siendo explicitas por seguridad y frescura.
- La unica comprobacion pendiente fuera del repositorio es medir presupuestos
  en un navegador autenticado y ejecutar agentes reales cuando exista una API
  key. Con `AI_AUTORUN_ENABLED=false` no se abren llamadas IA innecesarias.
- El build de produccion compila y pasa TypeScript, pero el prerender de
  `/nueva-contrasena` necesita `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; sin esas variables el entorno local
  no puede completar la exportacion estatica.

### Matriz de cierre por ruta

| Zona | Estado | Criterio aplicado |
| --- | --- | --- |
| Dashboard, marketing, consultor, tareas, llamadas, configuración, camino | Cacheado en lecturas principales | Las mutaciones fuerzan revalidación; las cargas optimistas se mantienen donde aportan UX. |
| Tiendas, conocimiento, integraciones | Cacheado | Listas y agregados comparten clave por tenant; ingesta, OAuth y borrados son explícitos. |
| Shopify y diagnóstico Shopify | Cacheado por conexión/periodo | Las métricas y paneles no repiten GET dentro de la ventana; costes y sincronización revalidan. |
| Detalles Meta/Klaviyo/Instagram | Parcial y condicionado | El estado común está cacheado; activos, reporting y acciones dependen de conexión elegida y se revisan como lecturas interactivas. |
| Agentes IA | Aislado | No se cachean ejecuciones, trazas ni decisiones; autorun apagado y sin API key. |
| Paneles admin | Auditoría separada | Tienen filtros y mutaciones operativas propias; no se mezclan con la caché de tenant del portal. |

La caché de frontend reduce montajes repetidos y peticiones duplicadas; no se
considera una caché SQL compartida. Los endpoints que sigan siendo costosos se
deben medir en servidor antes de añadir agregaciones o índices.
## Criterio de cierre de la fase 1

- A partir de `lg`, abrir el copiloto añade un rail de 26rem al grid del portal.
- El contenido principal conserva su propio espacio y sigue siendo operable.
- No existe backdrop en escritorio.
- En móvil se mantiene foco gestionado y cierre de drawer.
- Cerrar el rail no modifica conversación, cliente ni contexto activo.
