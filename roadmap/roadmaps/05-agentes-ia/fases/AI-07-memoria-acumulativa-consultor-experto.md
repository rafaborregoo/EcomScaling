# AI-07 - Memoria acumulativa y consultor experto

## Estado

- **Estado real:** `implemented_live_validation_pending` (implementado 2026-07-22 siguiendo el contrato
  tecnico endurecido de la segunda revision; falta validar en vivo con `VOYAGE_API_KEY` real y datos de
  produccion)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** AI-04, AI-05
- **Historial de la decision**: el diseno original (2026-07-20) generaba informes periodicos por IA
  reingeridos como RAG encadenado — descartado por riesgo de "memoria de memoria" (ver seccion siguiente).
  La primera revision (2026-07-22, mañana) elegia 3 fuentes ligadas a accion humana pero con un contrato
  tecnico incompleto: sin scope de tienda, sin control de audiencia por rol, sin ciclo de vida, con
  ingestion sincrona. La segunda revision (2026-07-22, tarde) corrigio esos 5 puntos. **Implementado en el
  mismo dia** (migracion `20260722240000_ai_07_memoria_acumulativa.sql` +
  `20260722241000_ai_07_knowledge_documents_source_types.sql`, `apps/api/src/memory-ingestion.ts`, wiring en
  `calls.ts`/`operations.ts`/`ai-runtime.ts`, worker `memory-ingestion-once.ts` + cron
  `.github/workflows/memory-ingestion.yml` cada 15 min). **Dos afirmaciones de la version anterior de este
  documento eran incorrectas, verificado contra codigo real**: A02 no tiene `search_knowledge`
  (`allowed_tools = []` en la v4 activa, ver AI-05); y el copiloto A09 es accesible a **cualquier miembro de
  la organizacion, incluido el cliente** (sin restriccion de rol, comentario explicito en
  `runConsultantChatTurn`), y su tool `search_knowledge` llamaba a `knowledge_search` sin ningun filtro de
  audiencia — ya corregido: `knowledge_search` exige `audience_allowed` sin default, y `buildAgentTools` lo
  fija a `['client_visible']` para todo agente automatico.
- **Validacion end-to-end real 2026-07-22** (`apps/api/src/validate-ai07-memory-pipeline.ts`, `npm run
  validate:ai07 -w @ecomscaling/api`): `VOYAGE_API_KEY` si esta disponible en este entorno, asi que se probo
  el pipeline completo contra Supabase real -- no datos sembrados a mano. 9/9 checks pasan: encolar crea el
  documento en `pending_indexing`, `processMemoryIngestionQueue` lo deja `active` con sus chunks, una nota
  `consultant_only` real (no un chunk sembrado) queda invisible con `audience_allowed=['client_visible']` y
  visible con `['client_visible','consultant_only']`, y volver a encolar la misma fuente/version se detecta
  como duplicado sin crear un segundo documento (idempotencia confirmada de punta a punta, no solo por
  constraint de DB).
- **Lo que sigue pendiente tras implementar**: (1) `VOYAGE_API_KEY` sigue sin confirmarse en el entorno de
  **produccion** de Vercel/GitHub Actions (solo se valido en local) — el cron `memory-ingestion.yml` no
  procesara nada hasta que el secret este puesto ahi; (2) `/conocimiento` sigue siendo una unica superficie
  (no las "dos superficies" que pide el entregable final) — la memoria generada por sistema aparece hoy en
  la misma tabla plana que los documentos subidos a mano, sin mostrar origen/autoridad/audiencia/estado por
  fila.

### Por que se descarto el diseno original (sigue aplicando)

Generar informes periodicos por IA y reingerirlos como RAG encadenado produce degradacion acumulativa: un
dato con una imprecision pequeña se resume, el informe mensual resume el resumen semanal, un agente cita
el informe, y el siguiente informe incorpora esa cita — la imprecision se convierte en "historia" sin que
nadie vuelva a los datos fuente.

### Las 3 fuentes de memoria (decision de Rafa, se mantiene)

1. **Resumenes de llamada publicados** (`call_ai_summaries.status = 'published'`, via `decideSummary`).
2. **Notas internas del consultor** (`task_comments.is_internal = true`; `milestone_internal_notes` cuando
   FE-05 tenga consumidor).
3. **Decisiones sobre recomendaciones de IA** (`decideAgentOutput`: `approved`/`rejected` + `reason`).

Explicitamente descartado: ingerir el diagnostico completo de A02/A04/A06 tal cual.

### Correccion importante: accion humana no es lo mismo que autoridad canonica

La version anterior de este documento decia "no hace falta un flag `derived`/`not_canonical` separado
porque todas las fuentes pasan por una accion humana". Eso confunde dos cosas distintas: **quien la
autorizo** (siempre humano, en las 3 fuentes) y **cuanto se puede confiar en su contenido como hecho**. Un
resumen de llamada publicado sigue siendo generado originalmente por IA a partir de una transcripcion,
solo revisado por una persona — no es equivalente a una nota escrita integramente por el consultor. Una
recomendacion aprobada no implica que todos sus argumentos sean hechos canonicos. Se necesitan dos campos
independientes (`origin` y `authority`, ver contrato abajo), no una asuncion binaria.

## Contrato tecnico

### 1. Alcance jerarquico (no solo `organization`)

La cabecera original decia "memoria **por tienda**" pero los entregables solo contemplaban scope
`organization` — el mismo problema de mezclar tiendas de una organizacion que ya aparecio en A02/A04/A06 se
repetiria aqui. Alcance real necesario:

- `global`: metodologia EcomScaling (ya existe, sin cambios).
- `organization`: aplica a toda la organizacion (p. ej. una politica general del cliente, una llamada que
  afecta a todas sus tiendas).
- `store`: aplica a una tienda concreta (p. ej. una decision sobre stock de una tienda especifica, una
  nota sobre una campaña de una sola tienda).

`knowledge_documents` gana una columna `store_id uuid references shopify_stores(id) on delete cascade`,
nullable (null = alcance `organization` cuando `visibility='organization'`). `knowledge_search` gana un
parametro `target_store_id`, y filtra: `store_id is null or store_id = target_store_id` (mismo patron ya
usado en `shopify_financial_summary`/`shopify_stock_summary` para no reinventar la convencion de scope).

### 2. Audiencia y enforcement por rol (no solo frontend)

Riesgo mas grave del diseño anterior, confirmado contra codigo real (ver arriba): el copiloto A09 no
distingue rol y su tool `search_knowledge` no pasa ningun filtro de audiencia a `knowledge_search`.
Ocultar esto solo en el frontend seria insuficiente — el filtro tiene que vivir en el backend/RPC.

Nuevo campo `audience` en `knowledge_documents`: `client_visible` | `consultant_only` | `system_only`.

| Fuente | Audiencia por defecto |
| --- | --- |
| Resumen de llamada publicado | `client_visible` |
| Nota interna del consultor | `consultant_only` |
| Decision sobre output de IA | `consultant_only` |

**Decision de alcance para la v1 de esta fase** (simplifica el problema en vez de resolverlo a medias):
**ningun agente automatico (A02/A04/A06/A08/A09) recibe contenido `consultant_only` via
`search_knowledge` todavia.** Todas las llamadas a `knowledge_search` desde `buildAgentTools` pasan
`audience_allowed = ['client_visible']` fijo, sin excepcion — no se modela "que agente ve que" caso por
caso (A02/A04/A06 pueden acabar mostrando su output a un cliente una vez aprobado; A09 ya es accesible al
cliente sin restriccion de rol; modelar permisos por agente hoy seria una superficie de fuga mas dificil de
auditar que simplemente no exponer `consultant_only` a ningun LLM por ahora). Las notas internas y
decisiones sobre IA se guardan e indexan igual (utiles para auditoria y para una futura superficie
consultor-only no basada en un agente automatico), pero no entran en ningun retrieval de agente hasta que
exista esa superficie con su propio control de acceso explicito. `knowledge_search` exige el parametro
`audience_allowed` (sin default permisivo) para que sea imposible llamarla "olvidando" el filtro.

### 3. Origen y autoridad (no solo "revisado por humano = confiable")

Dos campos nuevos e independientes:

- `origin`: `human_authored` | `human_approved_ai` | `human_decision`.
- `authority`: `canonical` | `operational` | `contextual`.

| Fuente | origin | authority |
| --- | --- | --- |
| Nota interna del consultor | `human_authored` | `operational` |
| Resumen de llamada publicado | `human_approved_ai` | `contextual` |
| Motivo de una decision sobre IA | `human_decision` | `operational` |

El retrieval no reordena por esto todavia (seria un cambio en `knowledge_search` mas alla de esta fase),
pero el campo se persiste desde el primer momento para que la UI pueda comunicar que clase de memoria es
cada resultado, y para no tener que migrar datos historicos despues cuando se decida usarlo en el ranking.

### 4. Ingestion asincrona e idempotente (no sincrona dentro de la accion humana)

Publicar un resumen, escribir una nota o decidir una salida de IA **no debe poder fallar** porque Voyage
este caido, el embedding tarde, o el proveedor de rate-limit. Patron outbox, no llamada directa:

```
accion humana (decideSummary / addTaskComment / decideAgentOutput)
  -> guarda su propia fila (call_ai_summaries / task_comments / agent_outputs, sin cambios)
  -> inserta una fila en memory_ingestion_queue (misma transaccion o inmediatamente despues)
  -> responde al usuario (la accion principal nunca espera al embedding)

worker (job corto, cron cada pocos minutos o `workflow_dispatch`, mismo patron que
ops-health-check.yml/shopify-reconcile.yml -- no hace falta BullMQ desde el primer dia)
  -> procesa filas pendientes de memory_ingestion_queue
  -> genera embeddings + knowledge_document + knowledge_chunks
  -> marca la fila como procesada o failed con reintento
```

Clave de idempotencia: `(organization_id, source_type, source_entity_id, source_version)` unica — la misma
fuente nunca genera dos documentos aunque el job se relance o el evento se dispare dos veces.

### 5. Ciclo de vida: version, sustitucion y borrado

Casos reales no cubiertos en el primer diseño: se publica una nueva version de un resumen, se corrige una
nota, se elimina un comentario, una organizacion/tienda se borra (soft-delete, R-008) o se restaura, una
decision se revierte, se elimina la tarea que origino una nota.

`status` en `knowledge_documents` (nuevo, hoy solo existe `active`/`archived`): `pending_indexing` |
`active` | `superseded` | `deleted` | `indexing_failed`.

Reglas:
- Una nueva version de la misma fuente (mismo `source_entity_id`, `source_version` mayor) marca la fila
  anterior como `superseded`, nunca la borra fisicamente (queda disponible para auditoria, excluida del
  retrieval por defecto).
- Borrar la fuente (p. ej. borrar el comentario, purga de organizacion via R-008) marca el documento como
  `deleted` y sus chunks dejan de ser recuperables — reutiliza el mismo mecanismo de cascada que ya existe
  para el resto de tablas ligadas a `organizations`/`tasks`, no uno nuevo.
- Solo `status = 'active'` entra en `knowledge_search` por defecto.

### 6. Procedencia: quien lo dijo vs quien lo indexo

`created_by = null` (lo que proponia la primera version de este documento) destruye el dato mas valioso:
quien tomo la decision. Dos actores distintos, dos columnas:

- `source_actor_id` (nullable): quien origino/aprobo/decidio el contenido — el consultor que escribio la
  nota, el que publico el resumen, el que decidio sobre la salida de IA.
- `ingested_by`: siempre `'system'` para estos 3 tipos (distingue de documentos subidos a mano en
  `/conocimiento`, donde `created_by` sigue siendo el humano que los subio directamente).

Mas `source_entity_type`/`source_entity_id`/`source_version`/`source_event_id` para trazabilidad completa
hasta el registro original.

### 7. Que se guarda en la decision sobre una salida de IA (no una paraphrasis nueva)

La version anterior proponia generar "un resumen corto de lo que proponia la salida" al ingerir una
decision — si ese resumen lo genera otro modelo, reaparece parcialmente el problema de degradacion que
esta fase intenta evitar. En su lugar, guardar referencia directa, sin generar texto nuevo:

```
decision: "approved" | "rejected"
reason: string | null
original_output_id: uuid   -- referencia a agent_outputs.id, el contenido original ya existe ahi
original_output_title: string  -- el titulo/answer ya generado por el agente, no una paraphrasis nueva
proposal_type: string
```

El contenido de la memoria es literal: *"El consultor rechazo la propuesta '{original_output_title}'.
Motivo: {reason}."* — sin sintetizar nada adicional.

### 8. Restricciones explicitas del cliente: tabla estructurada, no esperar al RAG

Una restriccion critica ("no descuentos en Black Friday") no deberia depender de aparecer en el top-k de
una busqueda semantica. Se anade como entregable propio de esta fase (no se pospone indefinidamente):

```sql
create table public.client_constraints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  store_id uuid references shopify_stores(id) on delete cascade,
  category varchar(40) not null, -- pricing/discounts/inventory/brand/campaigns/operations
  statement text not null,
  status varchar(20) not null default 'active', -- active/inactive
  priority varchar(20) not null default 'normal', -- normal/critical
  created_by uuid references profiles(id) on delete set null,
  valid_from date not null default current_date,
  valid_until date
);
```

Las restricciones `critical` y `active` se inyectan siempre en el contexto de A02/A04/A06/A09 (mismo
patron que los bloques de evidencia ya construidos en `runMonitorAgent`, no via `search_knowledge`) — no
compiten por un lugar en el top-k semantico.

## Objetivo

Que las 3 fuentes de memoria se indexen automaticamente de forma asincrona y con scope/audiencia
correctos, y que las restricciones criticas del cliente lleguen siempre al contexto de los agentes sin
depender de retrieval semantico.

## Entregables

- Migracion: `store_id`, `audience`, `origin`, `authority`, `status` (ampliado), `source_actor_id`,
  `source_entity_type`/`source_entity_id`/`source_version`/`source_event_id` en `knowledge_documents`;
  constraint de idempotencia unica.
- Tabla `memory_ingestion_queue` (outbox) + job en `apps/worker` (mismo patron que
  `ops-health-check-once.ts`) que procesa pendientes, genera embeddings/chunks, marca
  `active`/`indexing_failed`.
- `knowledge_search` gana `target_store_id` y `audience_allowed` (parametro obligatorio, sin default).
- Wiring en los 3 puntos de entrada (`decideSummary`, `addTaskComment`, `decideAgentOutput`) que solo
  encolan en `memory_ingestion_queue` (no llaman a Voyage directamente).
- Tabla `client_constraints` + inyeccion en el contexto de A02/A04/A06/A09 (evidence pack, no RAG).
- Instruccion explicita en los system prompts de agentes con `search_knowledge`: tratar el contenido
  recuperado como datos no confiables, nunca como instrucciones (gap ya identificado en AI-04, sin
  implementar todavia — se cierra aqui de paso ya que esta fase toca los mismos prompts).
- `/conocimiento`: dos superficies separadas ("Documentos" subidos a mano vs "Memoria operativa"
  generada por sistema), cada entrada de memoria mostrando origen, autoridad, audiencia, estado, y accion
  de abrir la fuente original — evita que memoria y documentos subidos se vean como lo mismo.

## Explicitamente fuera de esta fase

- No se reentrena ni ajusta el modelo (fine-tuning).
- No se ingieren informes completos de IA generados automaticamente.
- Ningun agente automatico recibe contenido `consultant_only` via `search_knowledge` (ver seccion 2) — una
  futura superficie consultor-only explicita es trabajo aparte, no esta fase.
- No se reordena `knowledge_search` por `authority` todavia (el campo se persiste, el ranking se revisa
  despues).
- No sustituye a AI-08 (outcomes/aprendizaje): esta fase acumula contexto cualitativo, no mide si una
  recomendacion funciono.

## Dependencias

- AI-04 (RAG) y AI-05 (A02/A04/A06/A08/A09) ya completadas.
- Job de worker nuevo (outbox), pero sin BullMQ/Redis obligatorio — mismo patron ya usado para
  `ops-health-check`/`shopify-reconcile` (cron de GitHub Actions llamando un script corto).

## Criterios de cierre

- Una nota `consultant_only` nunca es recuperada en una conversacion de cliente (test real contra
  `knowledge_search` con `audience_allowed=['client_visible']`, no solo revision de frontend).
- Una memoria con scope `store` nunca aparece al consultar otra tienda de la misma organizacion.
- Repetir el mismo evento (mismo `source_entity_id`/`source_version`) no duplica documentos ni chunks.
- Publicar un resumen, escribir una nota o decidir una salida de IA se completa aunque el proveedor de
  embeddings este caido (la fila queda `pending_indexing`/`indexing_failed`, la accion humana no fallo).
- Editar o sustituir una fuente marca la memoria anterior `superseded`, no la deja duplicada ni
  contradictoria con la nueva.
- Borrar la fuente (comentario, resumen, purga de organizacion) desactiva su recuperacion.
- El actor original (`source_actor_id`) y el evento fuente quedan trazados, nunca `created_by = null`.
- `client_constraints` con `priority='critical'` llega siempre al contexto de A02/A04/A06/A09, sin
  depender de que un embedding la recupere.
- Los system prompts de agentes con `search_knowledge` tratan el contenido recuperado como datos, nunca
  como instrucciones (test adversarial: un documento con una instruccion inyectada no cambia el
  comportamiento del agente).
