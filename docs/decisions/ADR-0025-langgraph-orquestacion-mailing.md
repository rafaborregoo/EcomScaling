# ADR-0025 — LangGraph para orquestar la campaña de mailing (A27 → A11 → revisión automática → aprobación → programar)

**Estado:** aceptado (2026-10-08), actualizado por la implementación A27 del 23-oct-2026. Implementado detrás de `MAILING_GRAPH_ENABLED`, apagado por defecto. Las garantías nuevas requieren `20270109191233_a27_mailing_execution_integrity.sql`; su validación local no acredita despliegue.

## Contexto: cómo funcionaba antes (leído, no supuesto)

- **El orquestador era el navegador.** `weekly-mailing-planner.tsx` recorría las fechas **en serie**:
  `POST /marketing/drafts` (A11, `runMarketingContentDraft`, `idempotency_key = ${sequence_id}:${n}`) y
  `PATCH /drafts/:id/schedule` (solo `scheduled_for`, **antes** de cualquier aprobación). Si se cerraba la
  pestaña, la secuencia quedaba a medias.
- **A27** (`runWeeklyMailingPlanner`) ya era idempotente y persistente (`marketing_mailing_sequences`,
  lease de 15 min); una persona revisa la estrategia antes de crear borradores.
- **Aprobación:** `decideMarketingContentDraft` — transición condicional `pending_approval → approved|rejected`,
  actualiza `agent_outputs` e inserta `agent_approvals`. `pushDraftToKlaviyoTemplate` rechaza lo no aprobado.
- **Klaviyo** (`scheduleMarketingKlaviyoCampaign`) es otro paso manual que pide audiencias y remitente.
- **A26** audita emails **ya enviados** (`klaviyo_email_inventory`); no recibe borradores ni da veredicto.
- `@langchain/langgraph` no estaba en ningún `package.json`; AI-30 había retirado un grafo de un nodo en
  `runAgentTurnWithFallback`.

## Decisiones del propietario (2026-10-08)

1. **Auditor = revisión automática en código** (`mailing-campaign-review.ts`): enlaces con destino útil y
   absolutos, campos de Klaviyo cerrados y con `|default:`, marcadores sin rellenar, textos literales pedidos y
   asunto ≤ 60 caracteres. Un fallo devuelve el email a A11 con el motivo, **máximo 2 reintentos**; después pasa
   a revisión humana marcado. El rechazo humano está siempre disponible y también vuelve a A11 (mismo tope).
   **A26 no entra en el grafo y no se toca.** Un auditor con modelo queda como mejora futura solo si los datos
   muestran que el humano rechaza mucho lo que la revisión automática deja pasar.
2. **Programar = opción (i):** el nodo `programar(email)` fija `scheduled_for` con `setMarketingDraftSchedule`,
   como hacía el navegador, pero **después** de la aprobación. Ninguna escritura en Klaviyo. La opción (ii)
   (programar en Klaviyo) se implementará detrás de la misma dependencia tras validar con una cuenta real.
3. **Aprueban los mismos que hoy** (consultor, owner, manager) por la ruta de borradores existente. Se registra
   actor (`decided_by`) y rol (`decided_role`: consultant/platform/client). La política vigente permite al cliente
   aprobar el borrador y preparar su envío manual. La revisión del consultor se conserva como opinión y auditoría;
   no bloquea la fecha prevista, no revoca la aprobación y no dispara otra generación. El envío en Klaviyo conserva
   sus validaciones y su acción manual separada. A26 sigue siendo auditoría de contenido enviado.

## Diseño

```text
preparar ──Send×N──▶ email (subgrafo, ≤3 en paralelo) ──▶ cerrar   (unión: cierra cuando todos terminan)

email:  redactar (A11) → revisar (código) ─┬─ falla y quedan reintentos → redactar (+motivo)
                                           └─ pasa, o tope → esperar_aprobacion  [pausa]
        esperar_aprobacion ─┬─ rechazo → redactar (si quedan) | rechazado
                            └─ aprueba → guardar fecha prevista local → fin
```

| Paso | ¿Nodo? | Qué llama |
|---|---|---|
| A27 | **no** | sigue igual; su revisión humana en la UI es la puerta de entrada. El grafo arranca desde una secuencia `planned`. |
| Redactar | nodo | `runMarketingContentDraft` sin cambios (presupuesto, breaker, validación, aprobación). Clave `${seq}:${n}` o `${seq}:${n}:rK`. |
| Revisión automática | nodo | `reviewMailingDraft` (puro). |
| Esperar aprobación / revisión | nodos con `interrupt()` | ninguno; al reanudar **releen la decisión de su tabla**. |
| Programar | nodo | `setMarketingDraftSchedule`; sin reintento automático (ADR-0019). |
| Brief, autorización, proyección, rol del aprobador | funciones | `buildWeeklyMailingEmailBrief` (contracts, compartido con el navegador), `authorizeMailingCampaign`, `project`, `approverRole`. |

El grafo (`buildMailingCampaignGraph(deps, checkpointer)`) recibe todas sus dependencias; los tests usan dobles.

### Dónde corre

En el proceso de la API, en segundo plano, con el `AuthContext` de quien dispara el avance (quien arranca la
campaña o quien decide). Se descartó el worker de la fase 0: obligaba a reconstruir un `AuthContext` sin
petición y el coste no compensaba con una sola réplica de API. Las ejecuciones de un mismo hilo se serializan
en memoria (`ponytail:` en `mailing-campaign.ts`; con varias réplicas, advisory lock por `sequence_id`). Si el
proceso muere, el checkpoint conserva lo hecho y **Reanudar** (o la siguiente decisión) continúa.

### Checkpoint: checkpointer propio sobre Supabase (opción a)

| Exigencia | (a) propio — elegido | (b) `langgraph-checkpoint-postgres` |
|---|---|---|
| Tenant/tienda | `organization_id`, `store_id`, `sequence_id` en cada fila; el saver está atado a una campaña y rechaza cualquier otro `thread_id` | solo `thread_id` |
| RLS | ninguna lectura para `authenticated` (probado en TEST: 42501); escritura solo service role | sin RLS |
| Migraciones | `db:push`, idempotentes, en el historial | `setup()` migra en runtime, fuera de `schema_migrations` |
| Conexión | `supabase-js` service role | pool `pg` directo en la API |
| Borrar por organización | `on delete cascade` (probado en TEST: 0 filas tras borrar la secuencia) | a mano por prefijo |

Tablas: `mailing_campaign_checkpoints`, `mailing_campaign_checkpoint_writes` (serialización del serde de
LangGraph en base64) y `marketing_mailing_campaign_emails` (proyección legible por email, lo que lee la
pantalla; RLS `select` vía `can_access_org`). `marketing_mailing_sequences.orchestrator` (`browser|graph`).

### Pausa y reanudación sin segundo sistema de aprobación

1. `esperar_aprobacion` hace `interrupt({kind, sequence_number, draft_id})`; el borrador sigue en
   `pending_approval` como siempre.
2. La decisión entra por `POST /marketing/drafts/:id/decision` (`decideMarketingContentDraft`, sin cambios);
   la ruta, tras guardar, llama a `advanceMailingCampaignForDraft`, que reanuda **solo** las pausas cuya
   decisión ya está en la tabla.
3. La opinión del consultor tiene su ruta (`.../emails/:n/review`, solo staff); registra la opinión sobre la
   versión actual y deja rastro de auditoría. Los checkpoints antiguos en espera de consultor continúan hacia
   la fecha prevista respetando la decisión del cliente.
4. Mientras el superpaso no termina, `getState` sigue listando la pausa de un email ya terminado;
   `listMailingInterrupts` las descarta mirando las escrituras del checkpoint (bug encontrado en TEST).

### Fallos e idempotencia

- **Proceso muerto a mitad:** el nodo se repite con la misma clave de idempotencia y A11 devuelve el borrador ya
  creado sin llamar al modelo; los emails ya terminados no se repiten (test con dobles).
- **Doble aprobación / dos usuarios a la vez:** la transición condicional de `decideMarketingContentDraft` deja
  ganar a uno (409 al otro); un aviso duplicado o sin decisión no mueve el email (test).
- **Fallo de un email (A11 caído, presupuesto, fallo al programar):** el email queda `failed` con `last_error` y su
  rama **espera a una persona** (pausa `retry`): `POST …/emails/:n/retry` con `retry` o `discard`. Reintentar
  repite A11 (o solo `programar`, si el fallo fue al programar: el borrador ya estaba aprobado); descartar lo da por
  `rejected`. Mientras haya un fallido sin decidir la campaña no se cierra. Los demás emails siguen. El breaker por
  organización puede tumbar varias ramas a la vez: se rehacen una a una desde la pantalla.
- **Cierre:** `completed` cuando todos los emails guardaron la fecha prevista; `partial` cuando algunos terminaron
  y otros se rechazaron; `abandoned` cuando ninguno se produjo o se canceló. Ninguno acredita envío en Klaviyo.
- **Reintentos:** presupuesto separado. El rechazo automático gasta 2 (`MAILING_GRAPH_MAX_AUTO_RETRIES`) y el de una
  persona otros 2 (`MAILING_GRAPH_MAX_HUMAN_RETRIES`): un email que llegó "con avisos" todavía puede rehacerse si el
  aprobador lo pide. Versiones 0..4 (claves `:r1`..`:r4`). Cada reintento queda en `agent_run_steps`
  (`step_type = 'graph_retry'`, motivo y origen) del run de A11 rechazado y en `audit_logs`
  (`ai.mailing_email_redraft`, con el actor que movió el grafo); el borrador superado por la revisión automática
  sale de la cola (`rejected`).
- **Quién paga:** el presupuesto diario de IA se carga a la organización, no a quien pulsa. Arrancar, reanudar,
  reintentar y rehacer dejan su fila de auditoría con el actor y su rol; la proyección guarda además el rol de
  membresía (`owner`, `manager`…) de quien aprobó.
- **Aprobación y opinión:** la aprobación del cliente permite seguir el recorrido manual de exportación/envío;
  la opinión del consultor no constituye un veto. La revisión automática del grafo sigue siendo determinista.
- **Textos literales:** el planificador los guarda en `client_state.verbatim_texts` (uno por línea); se pasan a A11
  como `verbatim_texts` y la revisión automática comprueba que aparecen. También los envía el flujo del navegador.
- **Revisión automática:** además de enlaces, campos, literales y asunto, exige al menos un enlace que no sea el de
  baja y un preheader (≤ 140). Los marcadores son `XXX`, `€XX`, `XX%`…, no "siglo XX".

### Reanudación sin nadie delante

- **Lease** `marketing_mailing_sequences.graph_lease_until` (15 min): solo un proceso mueve el hilo. Sustituye a la
  cola en memoria como garantía entre réplicas (la cola sigue ordenando las ejecuciones de un mismo proceso).
- **Job `mailing-campaign-resume`** (worker, cada 10 min): recoge decisiones que no llegaron al grafo, emails
  detenidos > 15 min y campañas con todos los emails terminados sin cerrar. Corre con el contexto de plataforma
  (`buildPlatformAdminContext`). Sin trabajo, o con el flag apagado, sale al instante.
- **Checkpoints:** al cerrar la campaña se borran todos salvo el último de la raíz.

### Rollout

- `MAILING_GRAPH_ENABLED=true` (+ `MAILING_GRAPH_ORGS` opcional para piloto) en la API. Apagado: el navegador
  sigue con su bucle, idéntico (el brief se comparte desde `@e-nora/contracts` y un test fija que el texto es
  el mismo).
- Una secuencia empezada en un modo termina en ese modo (`orchestrator`).
- Orden de despliegue: migraciones `20261209100000` y `20261210100000` → código → crontab y `run-worker-job.sh` en el VPS. Las migraciones solo añaden (y relajan el tope de `attempt` a 4); con el flag apagado nada las usa.

### Integridad y recibos A27 (23-oct-2026)

- Aplicar también `20270109191233` antes del código nuevo, siguiendo el mecanismo `db:push` del proyecto. Las rutas
  del navegador también usan sus RPC; apagar el flag del grafo no elimina esa dependencia.
- La estrategia guarda revisión, zona IANA, instantes, recursos y contexto de Mi Camino/calendario/guía de marca.
  Aprobar la secuencia aprueba su output exacto en la misma transacción. A11 reconstruye el paquete desde el servidor.
- Generación y grafo tienen propietario y renovación. Checkpoints, proyección, rechazo automático, finalización A11,
  programación y cierre comprueban la reserva; un propietario antiguo no puede escribir ni liberar la nueva.
- El arranque conserva un bootstrap antes del primer checkpoint. El barrido incluye campañas sin proyección y usa
  orden estable. Las secuencias antiguas sin el paquete/contexto nuevo requieren revisión y una nueva planificación.
- El vínculo manual con un mensaje importado de Klaviyo conserva cuenta/campaña/mensaje y revisión exacta del borrador.
  Su contenido permanece `unverified`: no acredita HTML idéntico ni incrementalidad. A12/A27 y los peers de A05/A28
  reciben las identidades y el estado observado, sin deducir ejecución de la mera aprobación.
- Las imágenes se seleccionan por ID/revisión, se comprueban por tienda y archivo, y exigen autorización de uso.
  Al producir se publica una copia con hash en `marketing-assets`, sin sobrescritura; el HTML no usa una URL privada
  temporal. No se publican imágenes por leer la bandeja o el estado de una secuencia.
