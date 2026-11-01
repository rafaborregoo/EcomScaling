# Latencia intermitente en Supabase TEST (21-oct-2026)

**Estado:** diagnosticado, **sin arreglar**. Decisión de Rafa (21-oct): no se paga por una instancia mayor ahora mismo.
**Alcance:** proyecto TEST ES IA (el que usa el desarrollo local). **Producción no está medida.**

## Síntoma

En local, pantallas que piden métricas (p. ej. el antiguo Resumen de Planificación) se quedaban en
"Cargando…" y acababan con "No se pudo cargar" y todas las cifras en "—". Las peticiones
`shopify/metrics`, `meta/metrics` y `metric-analysis` quedaban *pending* hasta superar el límite de 30 s
(`La peticion al API supero el limite de 30s`).

## Qué se midió (todo contra TEST)

| Capa | Resultado |
|---|---|
| Postgres directo (`SELECT 1`, 40 pruebas) | mediana 55 ms, máx. 166 ms, 0 por encima de 2 s |
| Funciones SQL con rol `authenticated` (RLS activa) | `shopify_sales_summary` 150–1000 ms, `shopify_top_products` ~200–260 ms |
| `curl` a `/rest/v1/` (40 pruebas) | conexión 47 ms, TLS 86 ms, **primer byte hasta 5,5 s**; 4/40 por encima de 2 s |
| RPC `shopify_stock_summary` vía REST (40 pruebas) | mediana 108 ms, **máx. 30,5 s**; 2/40 por encima de 2 s |
| Bucle de 150 s, 258 llamadas RPC seguidas | 8 llamadas por encima de 1,5 s: 9,4 s, 10,8 s, 3,0 s, 2,2 s, 2,1 s, 2,1 s, 1,6 s y **35,2 s** |
| 16 RPC en paralelo × 1, 2, 4, 8 peticiones | 40,8 s, 0,7 s, 29,0 s, 2,1 s (128 consultas en 2 s; no escala con la concurrencia) |

Horas (UTC) de los parones del bucle, por si hay que cruzarlos con los logs de Supabase:
08:40:02 (9,4 s), 08:40:18 (10,8 s), 08:40:30 (3,0 s), 08:41:34 (**35,2 s**).

## Conclusiones

- **El retraso está en la capa REST de Supabase (PostgREST/pasarela), no en Postgres ni en la app.**
  Postgres directo es estable; `curl` con conexión y TLS rápidos tarda segundos en el primer byte.
- **No es CPU de la API** (0 % mientras esperaba) **ni las funciones SQL** (rápidas con RLS).
- **No es la concurrencia propia**: 128 consultas simultáneas terminaron en 2 s, y los parones
  aparecen también con llamadas secuenciales y espaciadas.
- Son **parones aleatorios de decenas de segundos** sobre una llamada concreta. Una petición de
  métricas lanza ~16 RPC; si una se atasca, toda la respuesta supera los 30 s. Los bloques
  `Promise.all` del frontend (antiguo Resumen) lo hacían fallar entero.

## Estado del proyecto en el panel (revisado por Rafa)

- Región `eu-west-1` (Irlanda): la distancia no explica los 0,6 s de mediana.
- Instancia **Micro** (~1 GB de RAM, `max_connections = 60`). RAM usada 427 MB; CPU 6 %;
  11–25 conexiones abiertas de 60 y 1 activa; disco 0,18 GB de 2 GB; IOPS bajas; caché ~100 %.
- Ahora mismo **no está saturada**.

## Hipótesis abiertas (no confirmadas)

1. **Conexiones de PostgREST/pooler agotadas en picos** (Micro, 60 conexiones). Comprobar la gráfica
   *Database Connections* en la hora exacta de un parón.
2. **Consultas lentas o bloqueos** (p. ej. búsqueda vectorial en `knowledge_chunks`). Mirar *Query Performance*.
3. **Ráfagas de CPU/IO de Micro** (se acaba el crédito de ráfaga). Mirar una ventana que incluya un parón,
   no solo la última hora.
4. Otros procesos del desarrollo local usando el mismo proyecto a la vez (API, worker, procesos
   autónomos que escriben en el repo). Sin medir.

Pasar de Micro a Small (~15 $/mes más) descartaría la 3. **Decisión: no se hace por ahora.**

## Factores de entorno que empeoran la sensación en local

- La API de desarrollo corre con `tsx watch`: **cada fichero que se guarda en `apps/api` la reinicia** y
  mata las peticiones en curso (visto: el PID cambió durante las pruebas). Otros procesos escriben en
  `apps/api/src`, así que ocurre a menudo. Evitar dejar ficheros temporales en `apps/api`.
- La primera llamada tras un rato inactivo puede tardar mucho más (17 s en `shopify_sales_summary`).

## Qué haríamos cuando se decida arreglar

1. **Mitigación en código (barata, sin coste de infraestructura, pendiente de hacer):** un `fetch`
   común para el cliente de Supabase de la API con tiempo máximo de ~6–8 s y **un reintento solo en
   lecturas** (GET y una lista de RPC de solo lectura). Por las mediciones, el segundo intento casi
   siempre responde en menos de 1 s. No reintentar escrituras.
2. Revisar los logs/gráficas de Supabase con las horas de arriba (hipótesis 1–3).
3. Si persiste: subir a Small, o montar Supabase en local con Docker (requiere seed; los datos de
   prueba actuales, ~10k pedidos, no se migran solos).
4. Medir producción antes de dar esto por un problema solo de TEST. El comentario de
   `apps/api/src/shopify-metrics.ts` habla de 87 ms con 789 pedidos "medido en producción".

## Cómo reproducirlo

Con `.env.local` cargado (apunta a TEST), desde `apps/worker` (no desde `apps/api`, por el `watch`):
bucle de llamadas `supabase.rpc("shopify_stock_summary", …)` con service role cada 300 ms durante
150 s, registrando hora y duración de las que pasen de 1,5 s; y `curl -w "%{time_connect} %{time_appconnect}
%{time_starttransfer}"` contra `$SUPABASE_URL/rest/v1/` 40 veces. Si Postgres directo (`pg`, `SELECT 1`)
sigue por debajo de 200 ms mientras REST se atasca, el problema sigue siendo la capa REST.

## Relacionado

- El resumen de Planificación se retiró el 21-oct (la Agenda es la entrada); el tracking semanal pasó
  a job (`apps/worker/src/kpi-snapshots-once.ts`, lunes 06:30), que usa service role y no depende de esto.

## Cruce con los logs de Supabase (21-oct, 08:38–08:43 UTC)

Hecho a partir de los logs de edge, PostgREST y Postgres que pasó Rafa. **Confirma las hipótesis 1 y 2:
el límite no son las 60 conexiones de Postgres, sino el pool de PostgREST (10 conexiones).**

- 08:41:34 (35,2 s): una petición a `rpc/shopify_stock_summary` tardó 35.122 ms **en el servidor**. El parón es de la base, no de la red ni de la API.
- 08:41:17 → 08:42:17: una llamada a `rpc/meta_creative_performance` tuvo una conexión ocupada 60 s.
- Desde 08:42:25: unas 20 llamadas `shopify_*` a la vez (sales, financial, margin, top_products, funnel…), de 25 a 40 s cada una; muchas devolvieron 500 por `statement_timeout`.
- 08:42:35–08:42:45: `PGRST003: Timed out acquiring connection from connection pool` (504). El pool se quedó sin conexiones.
- 08:39:03: se aplicó una migración y PostgREST recargó el caché de esquema (2,2 s) y reinició el pool: el parón pequeño tras migrar o desplegar.
- 08:40:02 y 08:40:18 (9–11 s): sin errores en los logs; encajan con espera en la cola del pool (sin certeza).

**Cadena:** el dashboard lanza ~15 RPC en paralelo con un pool de 10 → el resto espera, incluido `GET /rest/v1/`; si una RPC lenta retiene una conexión, la cola crece y las demás chocan con `statement_timeout`. La CPU queda baja porque el tiempo se va esperando, no calculando.

## Comprobación posterior: las RPC no son lentas por falta de índices

Medido con `pg` directo contra TEST, solo lectura, org y tienda de prueba:

| Llamada | 1.ª vez (frío) | Siguientes |
|---|---|---|
| `shopify_sales_summary` 30 d | 1.141 ms | 55–57 ms |
| `shopify_sales_summary` histórico completo | 57 ms | 56–60 ms |
| `shopify_stock_summary` | 258 ms | 45–48 ms |
| `meta_creative_performance` 30 d | 337 ms | 83–194 ms |

`EXPLAIN ANALYZE` de la consulta interna de `shopify_sales_summary`: *Index Scan*, 4,3 ms de ejecución,
2 buffers. `shopify_order_facts` ya tiene índices que cubren el predicado de fechas
(`shopify_order_facts_org_processed_idx` y `_mix_idx`, parciales sobre `COALESCE(processed_at, external_created_at)`).
**Los 25–60 s de los logs no se reproducen con la consulta sola**: son espera de pool/bloqueo, no coste de la consulta.
Cautela: la tienda de prueba tiene 0 pedidos en 30 días (el org tiene ~10.4k en total); con una tienda grande el
coste real sí podría pesar. Probar con una cuenta con volumen antes de descartar la optimización de SQL.

## Plan corregido

1. **Limitar el fan-out** (gratis, el cambio con más efecto): que una petición de métricas no lance ~16 RPC a la vez
   (3–4 como máximo, o agrupar en una sola RPC), y que el dashboard no pida métricas por duplicado
   (con y sin `connectionId`).
2. **Mitigación en código** (tiempo máximo ~6–8 s, **un solo reintento solo en lecturas, con espera previa**).
   Reintentar sin espera con el pool saturado empeora la cola.
3. **Subir de Micro a Small no lo arregla por sí solo** (el pool de PostgREST sigue siendo pequeño). Sigue sin hacerse.
4. Averiguar quién retuvo una conexión 60 s con `meta_creative_performance` (08:41:17), que no se reproduce con
   la org de prueba. Mirar *Query Performance* de esa hora: otra org, otro proceso, o un bloqueo.
5. Tras aplicar una migración, esperar unos segundos antes de medir o de probar pantallas.

## Aplicado (21-oct)

1. **Tope de peticiones simultáneas de la API a Supabase** — `apps/api/src/request-gate.ts`, enganchado en
   `createUserScopedClient` (`auth-context.ts`). Como mucho 8 en vuelo por proceso (`SUPABASE_REST_CONCURRENCY`
   para cambiarlo; 8 de las 10 conexiones del pool de PostgREST en Micro). La cola se hace en la API y no en el pool.
   Test: `src/request-gate.test.ts`. **Límite conocido:** solo cuenta los clientes con token de usuario (no el
   service role, ni el worker, ni otros procesos), y una consulta atascada 30 s retiene su hueco; si hay 8
   atascadas a la vez, el resto espera aunque sea ligero. Por eso conviene también el timeout + un reintento con
   espera (pendiente).
2. **Fin de las peticiones duplicadas con/sin tienda** — `portal-shell.tsx`. La tienda activa empezaba en "" y
   saltaba a la guardada al llegar `shopify/connections`, y cada pantalla pedía sus métricas dos veces. Ahora,
   hasta que llega la lista, la tienda vigente es la de la URL o la guardada para ese cliente
   (`currentConnectionId`).
   Comprobado en el navegador: ya no se ve la pareja (`?days=30` y luego `&connectionId=`).
   **No validado a fondo:** en la prueba el entorno seguía con parones (`shopify/connections` tardó 15,8 s y
   algunos bloques del dashboard salieron en error), así que no se pudo medir la mejora de tiempo limpia.

3. **Timeout y un único reintento en lecturas** — mismo fichero (`request-gate.ts`). Una lectura (GET/HEAD y las RPC de solo lectura de Shopify, Meta y Klaviyo, lista cerrada en `READ_RPC`) se corta a los 12 s (`SUPABASE_REST_TIMEOUT_MS`) y se reintenta una vez tras 500 ms; también ante 502/503/504. **No** se reintenta un 500 (suele ser `statement_timeout` y empeoraría la cola), ni lo cancelado por quien llama, ni ninguna escritura (sin timeout). El timeout no cuenta la espera en cola y libera el hueco, lo que acota el bloqueo por cabeza de cola. Tests: 6 en `request-gate.test.ts`. **Al añadir una RPC de lectura nueva a las métricas hay que añadirla a `READ_RPC`**, o no tendrá timeout ni reintento.

Pendiente: medir en TEST con el entorno estable cuánto mejora la carga del dashboard.

## Seguimiento (21-oct, tarde): "No hemos podido cargar los datos de la tienda"

En la portada del consultor (ClientPulse) salía "Revisa que Shopify esté conectado" aunque la tienda estaba bien
conectada (el cliente la veía correcta). Era un mensaje comodín: se pintaba con **cualquier** error de
`shopify/metrics`, incluidos el timeout de 30 s y los 500. Ahora solo dice "conectado en Integraciones" ante
`shopify_connection_not_found`, `shopify_currency_unavailable` o `store_access_denied`; en el resto avisa de que
tarda más de lo normal y ofrece "Reintentar".

Lo medido ese día, para no repetir pistas falsas:
- Los pasos de la petición de métricas (tienda, moneda, costes, cuentas Meta, objetivos, RPC) tardan 50–500 ms
  por separado con el rol `authenticated`. No hay una consulta que cuelgue.
- **Rendimiento del REST con concurrencia: ~10 peticiones/s.** 80 llamadas por el limitador de 8 tardaron 8,7 s
  (~0,8 s cada una, frente a ~0,1 s una sola). Una pantalla de métricas hace ~100–150 llamadas REST
  (16 RPC por petición de métricas × varias peticiones + el resto), es decir 10–15 s en el mejor caso.
- La API **no cancela el trabajo cuando el navegador aborta** (límite de 30 s): las peticiones abandonadas siguen
  encolando llamadas y el atasco dura minutos tras recargar varias veces. Cada recarga o sonda manual empeora
  el siguiente intento.
- La API de desarrollo se reinicia (`tsx watch`) cada vez que otro proceso guarda `apps/api/src/ai-runtime.ts`
  u otro fichero; las peticiones en curso mueren con un "Failed to fetch".

Siguiente palanca real: menos llamadas REST por pantalla (agrupar las RPC de métricas en una sola, o cachear la
respuesta de `shopify/metrics` en Redis unos minutos para todos los consumidores) y propagar la cancelación de la
petición HTTP a las consultas de Supabase.

## Aplicado: caché "sirve y refresca detrás" en `shopify/metrics`

`apps/api/src/swr-cache.ts` + envoltorio en `shopify-metrics.ts` (`getShopifyMetrics` ahora llama a
`computeShopifyMetrics`). Redis ya cacheaba la respuesta 60 s, pero tras ~10 consultas previas y sin compartir
el cálculo entre peticiones idénticas; al caducar, todo el mundo recalculaba a la vez (~100 llamadas REST).

- Fresca (< 60 s): se devuelve sin tocar la base. Caducada pero < 10 min: se devuelve **al instante** la última
  copia buena y se refresca en segundo plano. Sin copia: se calcula y las peticiones idénticas simultáneas
  comparten el cálculo (también las de `metric-analysis` y `strategic-plans`, que llaman a la misma función).
- Solo se guardan resultados correctos; un fallo nunca pisa una copia buena.
- **La clave es por usuario + organización + tienda + periodo.** Una copia compartida entre usuarios saltaría
  RLS y la comprobación de acceso a la tienda.
- Contrapartida: un cambio de ajustes (moneda, costes) puede tardar hasta unos minutos en notarse en estas
  cifras (antes ≤ 60 s). Ajustable con `METRICS_STALE_SECONDS`.
- Tests: `src/swr-cache.test.ts` (4: fresca, caducada, fuera de ventana + single-flight, fallo no guardado).
- Visto en vivo: la primera carga de `shopify/metrics` del consultor terminó en 14 s (antes superaba los 30 s y
  fallaba). **No se llegó a ver en vivo el acierto de caché** (el entorno seguía con parones y las pruebas
  posteriores no respondieron en 30 s), y la primera carga sigue siendo lenta.
- Nota: la portada espera a `shopify/connections` antes de pedir las métricas de tienda; con el REST atascado
  esa petición ligera (7 s) retrasa todo lo demás. Es la siguiente cosa a mirar.

## Corrección y renovación del contexto de auth en segundo plano

- **Corrección:** la nota anterior ("la portada espera a `shopify/connections` antes de pedir las métricas") era
  una lectura errónea. `performance.getEntriesByType('resource')` solo lista las peticiones **ya terminadas**:
  `shopify/metrics` estaba en vuelo, no sin pedir. Nada bloquea la petición de métricas; solo son lentas.
- **Qué sí cuesta en cada petición:** cuando caduca el contexto de auth (30 s), la primera petición paga ~4 viajes
  seguidos a Supabase (getUser → perfil + membresías → organizaciones del consultor → organizaciones +
  suscripciones). Con el REST atascado son segundos por petición, también en `shopify/connections`.
- **Aplicado** (`auth-context.ts`): pasados 15 s el contexto cacheado se sirve igual y se **renueva detrás**
  (single-flight); quien está activo ya no paga el fallo de caché. **La cota de revocación no cambia**: la entrada
  sigue caducando a los 30 s, y una renovación fallida no cacheó nada ni alarga la validez. Test nuevo en
  `auth-context-cache.test.ts` (4 pasan).
- **No se alargó el TTL de 30 s a propósito:** las escrituras con service role dependen de ese contexto para la
  comprobación de membresía (ADR-0006 #7), y subirlo retrasaría el efecto de revocar a alguien.

## Ajuste del limitador (21-oct, noche)

- **Timeout 8 s → 12 s** (`request-gate.ts`): una lectura legítima pesada (`shopify_orders_sample`, `/operations`)
  tardaba más de 8 s y el timeout la mataba, devolviendo `shopify_overview_load_failed` donde antes terminaba
  lenta pero bien. Con 12 s + 1 reintento el peor caso (~25 s) sigue por debajo de los 30 s del navegador.
- **Concurrencia 8 → 5**: con 8 RPC pesadas a la vez en Micro (2 vCPU compartidas) se veían `canceling statement
  due to statement timeout` en consultas que solas tardan 50 ms. En `pg_stat_activity` había 8 RPC activas a la vez.
- Si siguen apareciendo `statement timeout`, bajar `SUPABASE_REST_CONCURRENCY` a 3; si la pantalla va lenta pero
  sin errores, subirla.
- La API de desarrollo se arrancó a mano (`dotenv … tsx src/server.ts`, log en `/tmp/api-dev.log`), **sin `watch`**:
  los cambios en `apps/api` no se recargan solos; hay que reiniciarla.
