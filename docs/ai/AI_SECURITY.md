# AI Security — EcomScaling / NORA

**Estado:** implementado lo que se describe aquí, salvo lo marcado como pendiente.
Ver [AI_INFRASTRUCTURE_AUDIT.md](AI_INFRASTRUCTURE_AUDIT.md) (fichas 08, 26, 27) y
[AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

---

## 1. Modelo de amenaza

Todo lo que no escribimos nosotros es **entrada no confiable**: resultados de RAG, filas de
la base de datos del cliente, documentos subidos, respuestas de conectores (Shopify, Meta,
Klaviyo), descripciones de herramientas y metadatos de terceros.

La consecuencia práctica es una regla y no una aspiración: **ningún control de seguridad se
delega en el modelo**. Todos los controles corren en el backend, son deterministas y no
consultan a un LLM para decidir.

## 2. Defensa en profundidad

### 2.1 Separación instrucción / dato

Todo contexto se envuelve antes de llegar al modelo
([`untrusted-context.ts`](../../packages/ai/src/untrusted-context.ts)):

```text
FUENTE_NO_CONFIABLE: <etiqueta>
<datos_recuperados>
  …
</datos_recuperados>
```

Los resultados de herramienta van en `<tool_result_no_confiable>`.

### 2.2 Neutralización

Siete patrones de inyección (español e inglés) se sustituyen por
`[CONTENIDO_INSTRUCCIONAL_BLOQUEADO]`, y se eliminan los caracteres de control. Hay límites
duros de tamaño: 12.000 caracteres por bloque y 48.000 por contexto.

### 2.3 Herramientas

- Catálogo **cerrado** (`TOOL_CATALOG`): el modelo solo ve lo que se le declara.
- Filtrado adicional por conector conectado: una organización sin Meta no ve las
  herramientas de Meta.
- Contratos Zod de entrada y salida por herramienta
  ([`tool-layer.ts`](../../packages/ai/src/tool-layer.ts)).
- `authorizeTool` con rangos de permiso.
- Toda escritura al dominio es **propuesta**, nunca ejecutada: queda en `agent_outputs`
  pendiente de decisión humana según `approval_mode`.

### 2.4 SQL Gateway

[`sql-gateway.ts`](../../apps/api/src/sql-gateway.ts): validación por **AST** (no por regex),
allowlist de tablas, lista negra de tipos de nodo y de funciones, tenant forzado por el
backend, timeout de 12 s y tope de 200 filas. Con guarda propia en CI
(`scripts/assert-sql-gateway-hardening.mjs`).

### 2.5 Validación de salida

Antes de persistir nada: JSON Schema del proveedor → Zod → `checkOutputSanity` (rechaza
respuestas vacías o con texto corrupto) → decisión de aprobación.

## 3. Eventos de seguridad

Hasta AI-30 las defensas funcionaban pero **no dejaban rastro**: los patrones neutralizados
se contaban y se descartaban. Ahora todo lo detectado se registra en
`public.ai_security_events`.

| Evento                          | Severidad   | Cuándo                                                        |
| ------------------------------- | ----------- | ------------------------------------------------------------- |
| `prompt_injection_detected`     | medium      | Contenido instruccional dentro de un bloque de contexto       |
| `tool_poisoning_suspected`      | high        | El resultado de una herramienta traía instrucciones           |
| `unauthorized_tool_attempt`     | high        | El modelo pidió una herramienta fuera de su catálogo          |
| `permission_denied`             | info/high   | `authorizeTool` deniega una tool al declararla o al invocarla |
| `sensitive_data_access_attempt` | —           | Reservado                                                     |
| `policy_violation`              | info/medium | Contexto truncado; desbordamiento del colector                |

### Reglas del registro

1. **Solo metadatos.** Un evento guarda cuántos patrones, qué herramienta, qué bloques.
   **Nunca el texto que lo provocó**: ese texto es contenido no confiable y puede traer datos
   personales del cliente; guardarlo en una tabla de auditoría movería el problema en vez de
   resolverlo. Hay un test que lo verifica.
2. **Una sola inserción por turno.** La detección corre en el camino caliente; la
   persistencia se acumula y se escribe una vez.
3. **Se persiste también cuando el turno falla** (`finally`). Un run que muere por
   presupuesto puede haber detectado una inyección antes, y ese es el caso que más interesa.
4. **Escribir telemetría nunca tumba una ejecución.** Un fallo al insertar se registra en el
   log y no propaga.
5. **El colector tiene tope** (100 eventos/turno). Un contexto hostil no puede convertir la
   telemetría en una asignación de memoria sin límite. Los descartes se declaran: "no hubo
   más eventos" y "dejamos de contarlos" son distinguibles.

### Acceso

RLS: solo `platform_admin` y consultor asignado. Un evento de seguridad revela cómo se ataca
al sistema y qué herramientas existen, así que **no lo ve un cliente final** aunque sea de su
organización. Escritura solo por service role.

## 4. Secretos

- Las claves de proveedor viven **solo** en variables de entorno validadas por Zod.
- Las credenciales de integraciones de cliente están en el esquema `private`, fuera del
  alcance de RLS de `authenticated`.
- CI ejecuta Gitleaks, auditoría de dependencias, SBOM y Trivy sobre las imágenes.
- **Nunca** se registra el valor de un secreto: ni en logs, ni en trazas, ni en errores, ni
  en eventos de seguridad.

## 5. Privacidad de la telemetría

`sanitizeForTelemetry()`
([`packages/observability/src/index.ts`](../../packages/observability/src/index.ts)) es la
**única** puerta por la que un payload llega a una tabla de telemetría. Hace tres cosas:

1. Acota profundidad (rompe ciclos y estructuras absurdas).
2. Recorta cadenas largas y arrays largos, declarando cuánto quitó.
3. Redacta claves con forma de credencial, reutilizando `redactSensitive` — la misma lógica
   que protege los logs, no una segunda implementación.

El orden importa: se acota **antes** de redactar, porque `redactSensitive` no tiene límite de
profundidad y la entrada aquí es la salida de una herramienta, que no controlamos.

Se aplica hoy en `agent_tool_calls.input` / `.output`, que antes se guardaban en crudo — la
vía más probable de que un dato personal acabara en telemetría.

**Lo que no hace:** detectar PII por contenido. Eso requiere clasificadores y da falsos
negativos. La política real es **minimizar** (guardar poco), no confiar en detectar.

**LangSmith** nunca recibe payloads: `capturePayloads` está fijado a `false` y
`processInputs` devuelve `{ captured: false }`.

## 6. Aislamiento entre inquilinos

El `organization_id` **lo resuelve siempre el backend** a partir de la sesión; el modelo no
elige tenant nunca. Es el primer principio declarado en la cabecera de
[`packages/ai/src/index.ts`](../../packages/ai/src/index.ts) y está aplicado en
`requireMembership`.

Todas las tablas de IA llevan `organization_id` con FK y RLS. Cobertura verificada en CI
(`scripts/assert-rls-coverage.mjs`, 135/135 tablas) y con suites dedicadas
(`rls-tenant-isolation.test.ts`, `db-02-metrics-rpc-tenant-isolation.test.ts`).

## 7. Reglas para agentes de codificación

No son opcionales y no dependen de que el modelo las respete: se revisan en el diff.

1. **Ningún agente elimina asserts, marca tests como `skip` ni cambia valores esperados.** Si
   un test estorba, el cambio de especificación se argumenta explícitamente en el PR. Ejemplo
   de cómo se hace bien: el cambio de `estimateCostUsd` a `null`, documentado en
   [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).
2. **Ningún proceso automático modifica el conjunto reservado de evaluación.** Un sistema que
   puede editar su propio examen no está siendo evaluado.
3. **El sistema no se modifica a sí mismo.** No existe ninguna ruta por la que un agente
   escriba en `prompt_versions` o `agent_versions`; activar una versión es una migración
   revisada por una persona.
4. **No se introduce auto-reparación de tests.** No hay E2E que la justifiquen (ficha 27).

## 8. Pendiente

Nada bloqueante conocido en esta capa. Lo que queda de AI-30 es de arquitectura y está en
[AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

### Resuelto en esta fase

- **`authorizeTool` estaba desconectado.** Era código muerto en producción:
  `buildAgentTools` filtraba las tools a mano replicando dos de sus seis reglas. La ruta de
  producción ya lo llama, así que la lógica que se prueba es la que corre.
- **`permission_denied` tiene productor.** Toda denegación al declarar una tool queda
  registrada, con severidad `info` para lo que es configuración normal (tool planificada,
  conector sin conectar) y `high` para lo que es un incidente (tool inexistente, o tool que
  exige aprobación en un agente con `approval_mode: 'none'`).
- **Retención propia**: `private.purge_expired_ai_security_events`, 400 días frente a los 180
  del contexto, con una guarda que impide configurarla por debajo del horizonte del contexto.
- **Segunda puerta, en la invocación.** `buildAgentTools` envuelve cada executor con
  `authorizeTool(name, context, definition.permission)` — el permiso que la tool va a ejercer
  de verdad, no el `read` con el que se declara. Una denegación devuelve el `ToolError` al
  modelo y deja fila en `agent_tool_calls` y en `ai_security_events` (`tool_invocation`).

  Para toda tool que pasó la primera puerta el veredicto es hoy idéntico — mismas entradas
  estáticas — y hay un test sobre el registro real que lo fija, porque una segunda puerta
  que denegase lo que la primera declaró le daría al modelo un catálogo que revienta al
  usarlo. Su valor está en lo que la primera puerta no cubre: un `tools.push` añadido sin el
  guard de `allowedToolNames`. Ése fue exactamente el fallo del audit, y ahora no depende de
  que nadie recuerde el guard: no hay camino al executor que no pase por el envoltorio.

- **El panel pinta los eventos.** El detalle de traza los muestra antes de la cronología.
- **Tope por organización.** El colector acotaba un turno (100 eventos); nada acotaba el
  acumulado. `capSecurityEvents` corta en 1.000 por organización y ventana de 24 h.

  Dos decisiones que el test fija: por encima del tope se escribe **una** fila por ejecución
  declarando cuántos eventos se descartaron y de qué tipos — nunca cero, porque "hubo eventos
  y dejamos de detallarlos" y "no hubo eventos" tienen que seguir siendo distinguibles en el
  panel. Y si el conteo falla, **se escribe todo**: el tope existe para que la tabla no crezca
  sin freno, no para descartar evidencia cuando dudamos.

  El conteo sólo se paga en turnos que ya detectaron algo, y lo cubre el índice
  `(organization_id, created_at desc)` que la tabla ya tenía.
