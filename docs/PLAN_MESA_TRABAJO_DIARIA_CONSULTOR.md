# Plan: mesa de trabajo diaria del consultor

Estado: propuesta de ejecución.

## Decisión

`/consultor` deja de ser una página cuyo trabajo principal es administrar una lista de clientes. Pasa a ser la mesa desde la que un consultor decide dónde intervenir, ejecuta o delega la siguiente acción y deja el contexto preparado para la siguiente revisión.

El producto tendrá dos niveles deliberadamente distintos:

| Nivel | Pregunta que resuelve | Resultado esperado |
| --- | --- | --- |
| Cartera: `/consultor` | “¿A qué cliente dedico mi próxima hora y qué debo desbloquear?” | Una acción priorizada y un cliente abierto con contexto. |
| Cliente: `/consultor?organizationId=<id>` | “¿Qué cambió, qué decisión toca y cómo la ejecuto?” | Una decisión humana, una tarea/seguimiento creado o un bloqueo resuelto. |

`/dashboard` conserva su cometido de lectura analítica. No se replica aquí una pared de métricas. La mesa de trabajo ordena decisiones y enlaza al módulo que las ejecuta.

## Problema actual

La pantalla actual ya dispone de una cola de prioridad, buscador, ficha de cliente, tiendas, alertas, tareas y acciones administrativas. Pero el orden de la página favorece el alta y mantenimiento de la cartera antes que el trabajo semanal.

Cuando el consultor abre un cliente, la expansión actual está centrada en tiendas, última sincronización y acciones administrativas. Para gestionar el negocio debe saltar manualmente a Dashboard, Tareas, Llamadas, Camino, Marketing o Integraciones y reconstruir el contexto.

La mesa diaria debe reducir esos saltos y hacer explícito por qué una acción está arriba. No puede ocultar la frescura, cobertura ni procedencia de los datos.

## Principios de producto

1. La primera pantalla responde con acciones, no con una colección de KPIs.
2. Una fila de trabajo siempre identifica cliente, motivo, evidencia, urgencia, responsable y destino.
3. La IA propone y explica; una persona aprueba, descarta, edita o ejecuta.
4. Un dato incompleto no se presenta como cero ni como una conclusión fiable.
5. La ficha de cliente debe permitir actuar sin convertir la mesa en un duplicado de todos los módulos.
6. Crear clientes, editar organizaciones, pausar, desvincular o borrar son herramientas de gestión secundaria, no el foco diario.
7. La vista se limita a la cartera asignada por el modelo de acceso actual; nunca mezcla organizaciones por una agregación de frontend.

## Fuentes reales que reutilizaremos

No se inventarán métricas. La mesa compone datos y acciones ya presentes en el producto.

| Fuente | Información que aporta | Acción de destino |
| --- | --- | --- |
| Cartera y atención (`listConsultantOrganizations`) | Alertas abiertas/críticas, antigüedad, tareas vencidas, tiendas, estado y suscripción. | Abrir cliente, Tareas, Integraciones. |
| Resumen de cartera (`getConsultantOverview`) | Ventas, pedidos, inversión Meta, ROAS, pedidos recientes, datos financieros configurados y reautorizaciones. | Dashboard, Panel financiero, Integraciones. |
| Operaciones (`listConsultantOperations`) | Tareas, alertas, responsable, vencimiento, comentarios y vínculo con hitos. | Tareas. |
| Agenda (`listConsultantAgenda`) | Tareas fechadas, calendario de campañas e hitos de Mi Camino. | Agenda, Planificación, Camino. |
| Llamadas (`listConsultantCalls`) | Llamadas de la cartera y resúmenes pendientes de aprobar. | Llamadas. |
| Mensajes consultor-cliente | Hilos sin leer, interlocutor y última conversación. | Chats. |
| Propuestas IA (`/v1/consultant/proposed-tasks`) | Propuesta, canal, rationale, evidencia y fase de Camino. | Tareas, donde se aprueba o descarta. |
| Meta y Klaviyo de cartera | Rendimiento por cliente y estado de disponibilidad del canal. | Meta Ads, Klaviyo, Marketing. |
| Camino y planificación | Fase activa, hitos, tareas vinculadas y fechas. | Camino y Planificación. |

La cifra de beneficio o margen solo aparece cuando la configuración financiera y sus costes permiten interpretarla. La UI indicará la cobertura; nunca agregará como exacto lo que no lo es.

## Fase 0 — Contrato de la mesa diaria

### 0.1 Endpoint de lectura único

Crear `GET /v1/consultant/daily-workbench` para reunir, en el backend y bajo el mismo control de acceso, las señales que hoy obligan a varios saltos de pantalla.

Parámetros:

- `days`: `7 | 30 | 90`, por defecto `30`.
- `organizationId`: opcional. Si existe, debe pertenecer a la cartera accesible del consultor; de lo contrario devuelve `403`.

Respuesta de cartera:

```ts
type DailyWorkbench = {
  window_days: 7 | 30 | 90;
  generated_at: string;
  summary: {
    clients: number;
    urgent_clients: number;
    critical_alerts: number;
    overdue_tasks: number;
    pending_call_summaries: number;
    pending_ai_proposals: number;
    unread_threads: number;
    data_issues: number;
  };
  actions: WorkbenchAction[];
  portfolio: PortfolioHealthRow[];
  upcoming: UpcomingItem[];
};

type WorkbenchAction = {
  id: string;
  kind:
    | "critical_alert"
    | "overdue_task"
    | "call_approval"
    | "ai_proposal"
    | "unread_message"
    | "integration_reauth"
    | "financial_coverage"
    | "milestone_due";
  organization_id: string;
  organization_name: string;
  priority: "urgent" | "high" | "normal";
  title: string;
  reason: string;
  evidence: Array<{ label: string; value: string; source?: string }>;
  due_at: string | null;
  assignee_name: string | null;
  href: string;
  action_label: string;
};
```

Reglas del agregador:

- Reutilizar `listConsultantOrganizations` para el conjunto de organizaciones autorizadas y el mapa de nombres.
- Consultar con cliente user-scoped donde la RLS sea la frontera final.
- Aplicar límites a cada fuente y desduplicar por entidad: una alerta que ya creó una tarea no debe ocupar dos posiciones sin explicar la relación.
- Orden estable: crítico, fecha vencida, impacto de negocio, antigüedad, fecha próxima y nombre como desempate.
- Devolver un estado de fuente por bloque. Si falla Meta, Klaviyo o la serie secundaria, el resto de la mesa sigue siendo útil y declara la limitación.
- No ejecutar agentes ni mutaciones al cargar. Las propuestas se leen de la última salida cacheada.

### 0.2 Enlace profundo y contexto

La ficha de cliente se abrirá con `?organizationId=<id>` y sincronizará el contexto activo existente. Así se podrá compartir o recargar una ficha concreta sin crear otro sistema de selección ni romper el resto de módulos.

La URL no contendrá datos sensibles, solo el identificador de organización ya protegido por autorización en el servidor.

## Fase 1 — Cartera como mesa diaria

### Orden de la pantalla

1. Cabecera: saludo corto, fecha, selector de periodo y resumen de la jornada.
2. `Para resolver hoy`: cola única de acciones, máximo 8 inicialmente y enlace a “ver todo”.
3. `Cartera en salud`: todos los clientes por estado, no solo los que tienen problemas.
4. `Próximos siete días`: agenda, hitos y campañas que requieren preparación.
5. `Movimiento reciente`: pedidos, inversión y cambios del periodo, como contexto secundario.
6. Gestión de cartera: buscar cliente, crear cliente, añadir tienda propia, objetivos y acciones administrativas.

La creación de cliente no desaparece; se mantiene visible como acción secundaria, sin desplazar la siguiente decisión de la jornada.

### Componentes

#### `DailyActionInbox`

Lista de trabajo unificada. Cada fila muestra:

- Avatar y nombre del cliente.
- Título directo de la acción: “Aprueba el resumen de la llamada”, “Reconecta Shopify” o “Revisa la tarea vencida”.
- Motivo en lenguaje operativo, no un código interno.
- Una o dos evidencias reales: fecha vencida, severidad, canal, importe o fase afectada.
- Responsable y fecha cuando existan.
- Un único CTA que abre el módulo correcto con el cliente seleccionado.

Filtros: `Todo`, `Urgente`, `Esperando mi decisión`, `Datos e integraciones`, `Esta semana`. No se filtra por color únicamente.

#### `PortfolioHealthBoard`

Tabla o lista compacta con todos los clientes y estas columnas:

- Estado: urgente, revisar, vigilar o al día.
- Siguiente acción, no solo la puntuación.
- Alertas y tareas abiertas/vencidas.
- Salud del dato: sincronización, reautorización y configuración financiera incompleta.
- Próxima cita o hito, si existe.
- Acceso a `Abrir mesa`.

La venta, inversión o ROAS se pueden mostrar como contexto opcional, con periodo y comparación. No deben desplazar la columna “siguiente acción”.

#### `UpcomingWork`

Reutiliza agenda y planificación para señalar lo que vence o se publica en siete días. Agrupa por día y cliente, y enlaza a Tareas, Camino o Planificación.

#### `PortfolioPulse`

Bloque secundario y plegable con pedidos recientes, ventas, inversión Meta y ROAS cuando haya cobertura. Debe mostrar “sin datos” o “canal sin conectar” en vez de ceros inventados.

### Acciones disponibles desde cartera

- Abrir la mesa de un cliente.
- Ir a una tarea o alerta concreta.
- Aprobar o revisar un resumen de llamada desde Llamadas.
- Abrir una propuesta IA en Tareas para editarla, aprobarla o descartarla.
- Abrir el hilo de mensajes correcto.
- Reconectar un canal desde Integraciones.
- Abrir una fase o hito de Mi Camino.
- Crear cliente o añadir tienda desde Gestión de cartera.

Las acciones irreversibles —pausar, desvincular, borrar cliente o borrar tienda— permanecen en los menús de gestión y mantienen su confirmación reforzada.

## Fase 2 — Mesa de un cliente

La expansión actual de tiendas se transforma en una ficha profunda al abrir `?organizationId=<id>`. La gestión de tiendas se conserva en una sección secundaria “Administrar conexión y tienda”.

### Cabecera contextual

- Nombre de cliente, estado y tienda seleccionada.
- Selector de tienda si hay más de una.
- Frescura de Shopify, Meta y Klaviyo; el canal que no existe o falla se dice explícitamente.
- Enlace de vuelta a la cartera, no un breadcrumb ambiguo.
- CTA principal según la primera acción pendiente; por ejemplo, `Revisar 2 tareas vencidas`.

### Bloques de la ficha

#### 1. `Estado del negocio`

Cuatro a seis lecturas, adaptadas a las fuentes disponibles:

- Ventas netas e ingresos sin IVA.
- Pedidos y ticket medio.
- Inversión publicitaria y ROAS frente a break-even cuando la cobertura lo permita.
- Stock agotado o bajo.
- Beneficio y margen únicamente con configuración financiera válida; si falta, se sustituye por el bloqueo para completar costes.

Cada lectura muestra periodo, comparación y enlace de detalle. No se muestran gráficos por decoración.

#### 2. `Qué cambió desde la última revisión`

Resume variaciones materiales, no una cronología exhaustiva:

- Cambio de ventas, pedidos, inversión, ROAS o stock.
- Alertas nuevas, resueltas o envejecidas.
- Tareas cerradas, bloqueadas o vencidas.
- Cambios de sincronización o cobertura.
- Propuestas o decisiones IA nuevas.

Primera entrega: compara periodo actual con el anterior y la actividad reciente disponible.

Segunda entrega: añade el hito explícito “revisado por mí” con `consultant_client_review_events` para que “desde la última revisión” sea personal y verificable, no una aproximación temporal.

#### 3. `Decidir ahora`

Lista de hasta tres acciones priorizadas. Cada una debe tener:

- Qué se debe decidir o ejecutar.
- Por qué ahora, con evidencia.
- Responsable y vencimiento cuando correspondan.
- Destino de la acción.

Ejemplos de destinos: Tareas, Llamadas, Camino, Marketing, Integraciones y Mensajes. La mesa no aprueba silenciosamente salidas de IA ni publica contenido.

#### 4. `Camino y compromisos`

- Fase activa y siguiente hito.
- Progreso real de hitos y tareas.
- Bloqueo principal.
- Propuestas IA vinculadas a una fase o etiquetadas como tarea libre.
- Enlace a Camino para editar la estructura estratégica.

#### 5. `Relación y próxima conversación`

- Próxima llamada.
- Último resumen, estado de aprobación y puntos por confirmar.
- Mensajes sin leer o hilo pendiente.
- Borradores de marketing esperando revisión o respuesta.

El objetivo es que el consultor llegue a una llamada con contexto, sin duplicar el módulo completo de Llamadas o Chats.

#### 6. `Datos y administración`

Sección final, plegable por defecto:

- Tiendas, último sync y estado de conexión.
- Reautorización y acceso a Integraciones.
- Configuración financiera pendiente.
- Editar organización, pausar, restaurar o desvincular según permiso.
- Acceso de miembros y asignaciones solo para platform admin.

## Fase 3 — Seguimiento de revisiones

Crear una tabla de eventos mínima si se valida la necesidad de recordar revisiones humanas:

```sql
consultant_client_review_events (
  id uuid primary key,
  organization_id uuid not null,
  consultant_user_id uuid not null,
  reviewed_at timestamptz not null,
  note text null,
  created_at timestamptz not null
)
```

Reglas:

- Solo el consultor asignado o platform admin puede crear y leer sus eventos de la organización.
- La acción `Marcar como revisado` es explícita; visitar la ficha no altera el historial.
- El historial no sustituye tareas, llamadas ni comentarios. Solo delimita la comparación contextual.
- La nota es opcional y corta; no se usa como canal de mensajería.

## Estados que deben existir desde el primer release

| Situación | Comportamiento esperado |
| --- | --- |
| Sin clientes | Mantener alta de cliente y explicar que aún no hay cartera. |
| Cartera sin acciones | Declarar “Todo al día” y mostrar próximos hitos o agenda, no una página vacía. |
| Sin datos de un canal | Mostrar el motivo y CTA de conexión; no mostrar `0` como métrica real. |
| Sin configuración financiera | No calcular beneficio/margen como fiable; mostrar el bloqueo y enlazar a Configuración. |
| Fuente secundaria caída | La cola y el resto de fuentes siguen funcionando; el bloque afectado permite reintentar. |
| Muchos clientes | Filtros, búsqueda y paginación/límites server-side; no cargar detalle de todos en paralelo. |
| Sin permiso para un cliente | No filtrar en frontend: el endpoint devuelve `403` y la UI vuelve a cartera. |
| Propuesta IA pendiente | Mostrar evidencia y abrir Tareas para decisión humana. |
| Acción destructiva | Mantener diálogo de confirmación y el texto de impacto actual. |

## Diseño y accesibilidad

- Construir sobre `apps/web/src/components/ui` y HeroUI v3; no crear otro catálogo.
- Títulos semánticos, etiquetas de formulario reales y foco visible.
- Un estado debe explicarse con texto además de color, icono o badge.
- La cola se navega por teclado y las filas tienen un objetivo de acción inequívoco.
- En móvil, la bandeja y el contexto de cliente se leen verticalmente; las métricas nunca fuerzan scroll horizontal.
- Periodos, zonas horarias, moneda y tienda activa se conservan visibles donde afectan a una decisión.
- El tono es directo: “Reconecta Shopify para recuperar datos” es preferible a “Atención requerida”.

## Orden de implementación

### F1 — Cartera accionable

1. Contrato `daily-workbench` y tests de orden, deduplicación, autorización y degradación por fuentes.
2. `DailyActionInbox` y `PortfolioHealthBoard` con datos ya existentes.
3. Reordenar `/consultor`: trabajo arriba; gestión de cartera abajo.
4. Enlaces profundos a cliente y a cada módulo ejecutor.

### F2 — Ficha de cliente orientada a decisión

1. Contrato `daily-workbench?organizationId` o endpoint específico de ficha, según resulte más claro al tipar y cachear.
2. Cabecera, estado de negocio, cambios recientes y tres siguientes acciones.
3. Camino, relación, propuestas IA y administración secundaria.
4. Selector de tienda y estados de datos incompletos.

### F3 — Revisión y aprendizaje

1. Migración y API de `consultant_client_review_events` si se confirma el valor de revisión personal.
2. Bloque “desde mi última revisión”.
3. Instrumentación de eventos de producto: acción abierta, acción completada, cliente revisado y tiempo hasta primera acción. No guardar contenido de mensajes ni evidencia sensible.

#### F3.3 — descartado por ahora (2026-09-21)

No se construye, y se descarta a propósito, no por olvido. La instrumentación de
producto sirve para saber qué hacen usuarios a los que no puedes preguntar; con
uno o cuatro consultores se aprende más usando la mesa dos semanas. En el repo no
hay subsistema de telemetría de uso en el que apoyarse (las tablas `*_events`
existentes son datos de dominio: Klaviyo, Shopify, seguridad de IA, diagnóstico),
así que serían tabla, endpoint y mantenimiento nuevos para una señal con N=1.

Lo que **no** se pierde: el ritmo real de trabajo ya es consultable con
`tasks.completed_at`, `alerts.resolved_at` y `consultant_client_review_events.reviewed_at`.
Lo que **sí** se pierde y no se reconstruye después: la atribución — si una tarea
se cerró *porque* se vio en la mesa o porque iba a cerrarse igual.

Se retoma cuando se cumpla uno de los dos:

- Varios consultores usándola a diario y ya no se les puede preguntar uno a uno.
- Hay que cambiar el orden de la cola y hace falta evidencia de que el actual
  falla, en vez de la intuición de quien la diseñó.

Coste estimado entonces: una tabla y un `POST` desde el CTA. No es deuda grande;
por eso no se planifica con más detalle ahora — un diseño escrito hoy envejecería
peor que volver a pensarlo con los datos de ese momento.

## Verificación y criterio de terminado

Una fase no se considera terminada por renderizar cards. Debe cumplir contrato, API, UI y pruebas.

- Typecheck de API y web en verde.
- Tests unitarios del orden de la cola, deduplicación, enlaces de destino y degradación de fuentes.
- Tests de autorización para cartera asignada, organización no asignada y platform admin.
- Prueba manual con cartera vacía, 1 cliente, 10+ clientes, varias tiendas y una mezcla de canales conectados/no conectados.
- Prueba de teclado, foco, zoom al 200 % y móvil.
- Confirmar que abrir la ficha nunca dispara IA, cambia estados o crea tareas.
- Confirmar que toda cifra financiera declara cobertura y no mezcla datos incompletos.
- Confirmar que una propuesta IA solo se decide desde el flujo de aprobación de Tareas.
- Revisión visual final con los estados loading, vacío, error y datos reales.

## Fuera de alcance inicial

- Un nuevo CRM completo, pipeline comercial o sistema de tickets separado.
- Ejecutar, publicar o aprobar de forma automática acciones de IA.
- Inventar una puntuación opaca adicional a la atención existente.
- Mezclar ingresos atribuidos entre plataformas en una sola métrica sin declararlo.
- Sustituir Dashboard, Tareas, Llamadas, Marketing, Camino o Integraciones: la mesa coordina y enlaza; esos módulos siguen siendo la fuente de edición.
