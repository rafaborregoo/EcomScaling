# IMP-03 — Contratos, ámbito, aprobaciones y trazabilidad

Fecha: 2 de noviembre de 2026, Europe/Madrid. Entrega de ingeniería local; la publicación se reserva para el final del plan. Continúa [IMP-02](IMP02_ECONOMIA_COMPARABLE_2026-11-02.md).

## Resultado y encaje

Se refuerza el flujo existente de propuestas de IA, decisiones y materialización. No se crea otro agente, herramienta del modelo, cola ni sistema de aprobaciones. Se reutilizan `agent_outputs`, `agent_output_decision_claims`, `agent_approvals`, notas, tareas, auditoría y las rutinas especializadas existentes.

El cliente owner/manager conserva la capacidad de decidir sobre sus propuestas autorizadas, tenga o no consultor. Un miembro sin ese rol no adquiere permiso de decisión. El consultor sigue operando en las organizaciones asignadas o a las que tiene acceso real. La aprobación humana permite materializar trabajo interno; no publica anuncios ni cambia presupuestos en Meta.

## Carencias encontradas y correcciones

| Carencia contrastada | Corrección |
|---|---|
| La decisión comprobaba la tienda expresamente para A26, pero no para los demás agentes | Política compartida por tienda y audiencia para todos los agentes en la decisión, el detalle y el listado de ejecuciones |
| El detalle usaba credenciales de servidor con autorización solo de organización | Antes de leer recibos, tareas o perfiles se comprueban organización, tienda y audiencia de la ejecución |
| Un ID de tarea guardado en una salida podía apuntar a otra tienda de la organización | Las tareas enlazadas se filtran por la tienda de la ejecución; un ID no recuperado no genera un enlace de reserva |
| Los avisos de tareas del flujo enviaban los mismos títulos a todos los miembros | Se filtran por perfil activo, visibilidad para el cliente y tiendas permitidas de cada destinatario |
| A08 y las lecturas del panel del consultor podían llegar al detalle general por ID | A08 y el objetivo `[dashboard_scope=panel]` conservan su audiencia interna; A08 continúa sin materialización de tareas |
| El cuerpo de la petición podía incluir ediciones ambiguas o campos adicionales | Contrato Zod estricto, compartido y acotado; solo índice, título, descripción, prioridad y descarte son editables |
| El descarte individual hacía una lectura y actualización separadas | RPC con bloqueo de fila: mezcla descartes sin perder los anteriores, conserva otras ediciones y rechaza una decisión ya iniciada |
| Un reintento podía cambiar las ediciones de una decisión parcialmente ejecutada | Se fija contenido, organización, tienda, ejecución, versión del agente, actor, decisión y ediciones; un reintento debe conservarlos |
| Una segunda consulta del código de agente podía fallar y dejar actuar al escritor genérico | Se reutiliza el ejecutor identificado antes de reservar y se contrasta su versión con la reserva; un ejecutor desconocido bloquea la aprobación |
| El recibo y el estado final se escribían en dos peticiones | Una transacción confirma ambos y libera la reserva. La respuesta incluye el ID del recibo |
| Una comprobación en la API podía caducar antes de insertar la tarea | El trigger de inserción valida el token de la reserva y los permisos actuales. Consume el token y lo elimina del metadata persistido |
| Las notas y las sustituciones/retiradas A18 requerían la misma protección | Rutinas verificadas con bloqueo, reserva vigente, origen y actor; A18 reutiliza su operación canónica y conserva referencia de recuperación |
| El plan diario interpretaba «no pendiente» como «revisado por el consultor» | Se conserva el estado real y se declara que la revisión humana no está verificada y que no hay autorización de ejecución heredada |

La asignación de tareas conserva el reparto existente entre consultores asignados. Los campos de ámbito y los ejecutores no se aceptan desde el cuerpo de la petición ni se toman de instrucciones incluidas en una fuente.

## Contrato de una decisión

1. La API valida el rol, la pertenencia y el alcance de la salida recuperada por organización e ID. Las cuentas limitadas a una tienda no acceden a un agregado organizativo ni a otra tienda.
2. Valida el cuerpo con [agent-approval.ts](../../packages/contracts/src/agent-approval.ts). Rechaza índices repetidos/fuera de rango, prioridades desconocidas, textos excesivos y campos de ámbito o ejecución.
3. PostgreSQL bloquea la salida y compara su contenido con el snapshot leído por el servidor. Comprueba otra vez autoridad vigente, audiencia y pertenencia de la tienda.
4. Guarda en `decision_context` un hash SHA-256 del origen y sus referencias de ámbito/versión, actor y ediciones aprobadas. No duplica todo el contenido en el recibo. Una salida modificada requiere otra salida y otra revisión.
5. Una reserva dura 30 minutos. El ejecutor anterior no puede usar un token sustituido. Al reintentar se puede recuperar una reserva caducada, manteniendo el actor, contenido, decisión y ediciones originales.
6. Antes de cada propuesta se revalida la reserva. Las inserciones de tareas y las rutinas de notas/A18 repiten la comprobación dentro de su escritura. Se conservan las claves de idempotencia por salida e índice. Un reintento recupera la tarea ya creada y su ID para el recibo; no la convierte en una propuesta descartada por título repetido.
7. Si hay fallos parciales, la salida sigue pendiente y conserva progreso. El guardado del progreso tampoco puede sobrescribir un origen cambiado o una reserva ajena.
8. Si termina, recibo y estado final se confirman juntos. La auditoría enlaza `receipt_id` y `source_hash`; el aviso de decisión del cliente se envía después de confirmar.

Un descarte previo es persistente: una petición antigua de aprobación no lo reactiva. Las decisiones históricas no reciben una verificación retroactiva. Un intento legado ya parcialmente iniciado sin contexto verificable se bloquea para revisión; no se inventa su aprobación original. El recibo registra una decisión y sus resultados internos, no acredita que una persona haya completado la tarea.

## Cliente y consultor en la interfaz

Se amplía la página existente `/propuestas/[outputId]`, compartida por los roles autorizados:

- Referencia del recibo para reconstruir una decisión desde soporte o consultoría.
- Distinción entre contenido/ámbito vinculados al recibo y registro histórico sin esa verificación.
- Una nota guardada se identifica como nota; una iniciativa retirada se identifica como retirada.
- Se conserva quién decidió y se usa el lado cliente/consultor registrado al decidir, aunque sus membresías cambien después.
- No se muestra un enlace a una tarea de otra tienda o no recuperada.

Los permisos se aplican en backend. Ocultar un botón no es la barrera de seguridad. La página no expone tokens de reserva, el payload interno de la decisión ni el hash técnico como contenido del cliente.

## Análisis pendientes, herramientas y fuentes

Los planificadores pueden seguir leyendo resúmenes acotados de análisis pendientes como indicios; esos resúmenes no contienen autorización heredada. El estado `approved` tampoco acredita por sí mismo una revisión del consultor, porque existen aprobación automática y decisiones del cliente. Cada propuesta nueva tiene su propia revisión y validación del ejecutor.

Se mantienen los controles existentes de `authorizeTool`, argumentos estrictos, audiencia del conocimiento y neutralización/detección de instrucciones en fuentes y resultados de herramientas. Se ejecuta su regresión del paquete IA. Esta fase no añade permisos de herramienta ni ingiere documentos de V1–V3; la curación corresponde a IMP-04.

## Migración y despliegue final

[20270115130000_imp03_approval_integrity.sql](../../supabase/migrations/20270115130000_imp03_approval_integrity.sql) añade `decision_context` a las dos tablas existentes, las RPC de decisión y dos triggers. Las funciones nuevas son `SECURITY INVOKER`, con `search_path` vacío y ejecución limitada al servidor. Se reutiliza la función existente que deriva el rol de consultor del plan vigente; no se crea una segunda definición comercial de ese rol.

El archivo se generó mediante Supabase CLI y se ordenó después de IMP-02 por las dependencias futuras que ya contiene el repositorio. No se ha aplicado en Supabase remoto. El patrón de funciones y privilegios se contrastó con la [documentación de Supabase](https://supabase.com/docs/guides/database/functions).

La entrega requiere coordinar base de datos y API/worker. Se revoca la RPC antigua de reserva sin vínculo de contenido: una versión antigua de la API falla de forma explícita al intentar aprobar. No se añade una ruta de compatibilidad que omita los nuevos controles. Las lecturas de recibos también requieren la nueva columna.

En el entorno completo de validación habrá que revisar las decisiones pendientes/legadas, aplicar la migración y desplegar API, worker y web compatibles. Verificar un ciclo con cliente owner/manager, un consultor asignado, un usuario limitado a tienda y una cuenta ajena. Para revertir, detener primero las decisiones; no retirar las comprobaciones mientras una versión nueva siga materializando trabajo. Conservar recibos y origen.

## Pruebas y límites de la evidencia

Los logs se conservan en `tmp/imp03-2026-11-02/`. Las pruebas SQL crean una base de datos efímera de nombre acotado dentro del Docker local, utilizan datos sintéticos y la eliminan al terminar. Aplican esta migración dos veces. No modifican la base local compartida ni datos remotos.

Se prueban las rutinas nuevas reales y la operación canónica A18. El esquema mínimo representa permisos y relaciones necesarios; la derivación comercial del rol de consultor se sustituye por un fixture. Esto no sustituye un reset de todas las migraciones ni sesiones autenticadas reales.

| Comprobación | Resultado de cierre |
|---|---|
| PostgreSQL: ámbito, audiencia, origen, caducidad, reintentos, tareas, notas y A18 | 21 pruebas superadas; migración aplicada dos veces |
| Dos sesiones PostgreSQL concurrentes | Solo una puede reservar la decisión |
| API real con transporte sintético, contratos y regresiones de planificación | 61 pruebas superadas |
| Entrega de tareas, reparto y avisos | 24 pruebas superadas |
| Paquete IA: herramientas, ámbito e instrucciones maliciosas | 292 pruebas superadas |
| Regresión de IMP-02 | 35 pruebas superadas |
| Tipos de API/web y lint de la página modificada | Superados; lint sin advertencias |
| Verificación general del repositorio | 19 guardas superadas |

Las pruebas de la API invocan las funciones reales y sustituyen el transporte HTTP; no llaman a modelos ni a Supabase remoto. No se ha comprobado visualmente la página con cuentas reales en navegador ni certificado el software completo. La batería acredita los casos enumerados y conserva esos límites.

Durante la verificación apareció una suite de modelo A12 creada por trabajo concurrente sin registro en los scripts. Se registró y pasó su prueba; ese cambio de modelo pertenece a ese trabajo y no se atribuye a IMP-03.

El siguiente bloque es **IMP-04: curación e ingestión incremental del conocimiento**. El despliegue y el piloto se mantienen para la entrega final, conforme al plan.
