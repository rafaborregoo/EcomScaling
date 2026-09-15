# Tareas pendientes — conocimiento a software

Lo que queda abierto de `docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md`, separado
por **quien puede cerrarlo**. Se actualiza en el mismo turno en que aparece la
tarea, no despues: una deuda que solo vive en una conversacion esta perdida.

Los bloqueadores de proveedor (Meta, Klaviyo, Shopify App Store) siguen en
[`roadmap/roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`](../roadmap/roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md),
que es el checklist canonico del piloto. Aqui solo lo de esta linea de trabajo.

---

## Para Rafa — nadie mas puede hacerlo

- [ ] **Reautorizar Shopify en `ecomscaling-dev.myshopify.com`.** La credencial
      caduco el 2026-09-14 y la conexion esta en `syncing` sin traer dato. El
      motor de `D01` ya lo detecta solo y lo marca como
      `credential_expired` / `blocked`, asi que mientras no se reconecte
      **ninguna senal de esa tienda sostiene un diagnostico** — que es el
      comportamiento correcto, pero deja la tienda a ciegas.
- [ ] **Decidir que pasa con las cuatro conexiones de Meta Ads en `pending`.**
      Nunca han sincronizado. El motor no las marca como rotas a proposito
      (`pending` es "recien creada", no "averiada"), asi que se quedan
      invisibles: ni dan dato ni dan aviso. O se completan o se descartan.
- [ ] **Activar los `schedule` de los workflows de motores**, si procede.
      `Data Quality Engine`, `Signal Engine`, `Context Engine` y `Symptom
      Engine` estan sin
      disparador automatico por decision tuya del 2026-08-03: hoy solo corren a
      mano desde Actions. Mientras sigan asi, **las pantallas de fase 3 muestran
      la ultima pasada manual**, no el estado de hoy. Si se activan, el orden de
      la cadena importa: calidad (06:07), senales (06:17), contexto (06:27) y
      sintomas (06:37).
- [ ] **Commits.** Hay ~100 ficheros sin commitear y la instruccion es no hacer
      commits ni push. Cuando quieras, dime y los preparo.
- [ ] **Destilar los 5 bloques que siguen sin capas** (`6.04`, `7.15`, `7.17`,
      `7.18`, `8.12`): solo tienen corpus maestro, hay que pasarlos por el
      prompt maestro. Tres de ellos bloquean la ola 1.

---

## Deuda anotada — la cierro yo cuando toque

Cada una lleva **por que se dejo**, que es lo que permite decidir si sigue
siendo buena idea dejarla.

### De `D01` (calidad de datos)

- [ ] **Vista de platform_admin: que fuentes fallan en toda la cartera.**
      Un `permission_gap` en doce clientes es un problema de producto, no de
      doce clientes. *Por que se dejo:* es observabilidad entre organizaciones y
      vive en `/admin/observabilidad`; tiene mas sentido hacerla una vez para
      varios bloques de la fase que bloque a bloque.
- [ ] **Reconciliacion entre fuentes** (`data_source_reconciliations`, pasos 4,
      5, 6 y 17 del runtime). *Por que se dejo:* hace falta una **segunda fuente
      comparable** sobre el mismo fenomeno, y hoy solo Shopify tiene serie
      diaria. La tabla y el contrato existen desde el primer dia esperando a
      Meta y Klaviyo.
- [ ] **Pasos 7, 8, 12, 13, 14 y 18 del runtime** (schema drift, checks
      matematicos, lineage, atribucion, limpieza de no representativos,
      ponderacion). *Por que se dejaron:* necesitan el evento crudo o piezas que
      todavia no existen.

### De `D02` (contextualizacion)

- [x] ~~**Mover la apertura de casos diagnosticos a `D06`.**~~ **Descartada el
      2026-09-28, al construir `D06`: era una mala idea.** El paso 7 del runtime
      de `D06` obliga a leer la lectura contextual de `D02`, y esa lectura
      cuelga de un caso. Si `D06` abriera el caso, `D02` no podria escribir
      antes y `D06` no tendria contexto que leer: es un ciclo. El caso lo abre
      quien lo necesita primero, que es `D02`, y se queda ahi.
- [ ] **Dejar que el cliente escriba su contexto declarado**
      (`tenant_context_facts`, en onboarding y en su perfil). El motor ya lo lee
      si existe; sin eso, los pasos 9 y 13 del runtime --cambios internos y
      contradicciones declarado/observado-- no tienen materia prima.
- [ ] **Dimensiones `device`, `market` y `product` en el mix.**
      *Por que se dejo:* `shopify_order_facts` no las sostiene. No se simulan:
      el motor las declara en `missing_context`.
- [ ] **Calibrar `DOMINANCIA_MINIMA`** (0.75). Es el umbral a partir del cual se
      dice que el cambio fue de rendimiento o de composicion, y **el numero es
      nuestro, no del artefacto**. Con casos reales delante se vera si es el
      correcto.

### De `D06` (motor de sintomas)

- [ ] **Ampliar la libreria de patrones** (`SYMPTOM_TEMPLATES`). Tiene cuatro
      entradas: las dos metricas que `D05` sabe emitir, en sus dos direcciones.
      *Por que se dejo:* una libreria con entradas para metricas que nadie
      calcula solo sirve para aparentar cobertura. Crece con `D05`.
- [ ] **Declarar mas relaciones entre metricas** en `metric_dependencies`. Hoy
      solo esta la aritmetica de ventas y pedidos, asi que la unica jerarquia
      posible es esa. Cada relacion nueva --embudo, economica, operacional--
      amplia lo que el motor puede relacionar **sin tocar codigo**, que es el
      punto del diseno.
- [ ] **Evidencia cualitativa** (paso 18): resenas, tickets, llamadas. El
      esquema y el guardrail de representatividad estan desde el primer dia;
      falta ingerir la materia prima.
- [ ] **Composicion de sintomas superiores** (paso 16). *Por que se dejo:*
      agrupar familias distintas bajo un mismo padre exige declarar que las
      relaciona, y hoy la unica relacion declarada es aritmetica.
- [ ] **`D07` no recorre el grafo de relaciones candidatas.** El motor las
      escribe (`often_cooccurs`) y nadie las lee todavia.

### De la fase 3 entera

- [ ] **5 flujos escritos y sin implementar**: `d03`, `d07`, `d09`, `d10`,
      `d11`. No hay que inventarlos — estan escritos en
      `conocimiento/fase-03/03-runtime/`.
- [ ] **5 bloques que necesitan motor y no tienen flujo escrito**: `D04`, `D08`,
      `D12`, `D13`, `D14`. Ahi si hay diseno que hacer.
- [ ] **Pantalla en 12 de los 15 bloques.** La matriz de audiencia de
      [`fase-03/IMPLEMENTACION.md`](fase-03/IMPLEMENTACION.md) ya dice que lleva
      cada una.
- [ ] **Ningun agente lee todavia una tabla de fase 3.** Conectarlos es anadir
      una tool y subir una version de `agent_versions`, no tocar el runtime
      (apartado 10 del plan).

### Anteriores, aun abiertas

- [ ] **No existe drenaje de reintentos de webhooks.** Un webhook fallido se
      queda ahi; `D01` ahora lo detecta y lo reporta, pero nadie lo reprocesa.
- [ ] **`fase-06/02-contratos-IA` tiene 17 ficheros legacy** a granel, sin el
      renombrado que tienen las demas capas.
- [ ] **El bypass del guardrail de `pending_deletion` sigue sin explicacion.**
