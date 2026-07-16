# EcomScaling IA — Contexto maestro de base de datos para Codex

> **Archivo obligatorio de lectura antes de generar o modificar SQL**
>
> Estado del modelo: **v0.2 conceptual congelado provisionalmente**  
> Motor: **PostgreSQL + Supabase**  
> Fecha de contexto: **15 de julio de 2026**  
> DBML incluido: **90 tablas, 34 enums y 228 relaciones**  
> SHA-256 del DBML incorporado: `3a670bb865fe9e7f47391517b9c860062b350bb4bfc772366a06e5d41eb0de18`

---

## 1. Propósito de este archivo

Este documento proporciona a Codex el contexto completo para:

- crear migraciones SQL de Supabase;
- entender las relaciones y responsabilidades de cada tabla;
- respetar el aislamiento multi-tenant;
- no inventar columnas, tablas o reglas de negocio;
- separar datos importados, datos calculados, operaciones humanas y credenciales;
- implementar RLS, constraints, índices, triggers y funciones de forma coherente;
- construir la base de datos por fases y no desplegar las aproximadamente noventa tablas de una sola vez.

Este documento **no sustituye las migraciones SQL**. El DBML describe el modelo conceptual y las migraciones implementan el contrato real de PostgreSQL.

---

## 2. Instrucciones obligatorias para Codex

Antes de escribir SQL:

1. Leer este archivo completo.
2. Localizar la fase que se está implementando.
3. Consultar el DBML incluido en el anexo.
4. Revisar las tablas ya existentes en `supabase/migrations`.
5. No volver a crear enums, tablas, índices o funciones que ya existan.
6. No inventar columnas para resolver una necesidad sin documentar primero el cambio.
7. No generar todo el esquema en una única migración.
8. Incluir tests de integridad y RLS para cada bloque multi-tenant.
9. Actualizar este documento y el DBML cuando una decisión aprobada cambie el contrato.
10. Explicar cualquier desviación antes de implementarla.

### Prohibiciones

Codex no debe:

- crear manualmente `auth.users`;
- exponer `service_role` al frontend;
- almacenar tokens externos en `public`;
- almacenar emails, teléfonos o direcciones de compradores de Shopify salvo aprobación expresa;
- permitir consultas cross-tenant;
- usar `organization_id` proporcionado libremente por el modelo de IA o por el navegador;
- crear policies permisivas con `using (true)` en tablas de negocio;
- añadir `ON DELETE CASCADE` de forma indiscriminada;
- ejecutar automáticamente el paquete RLS completo antes de que existan las tablas correspondientes;
- utilizar Growth o Scale para reducir la calidad de las respuestas de los agentes.

---

## 3. Fuentes de verdad del repositorio

Cuando estos archivos estén dentro del repositorio, la jerarquía recomendada será:

1. `docs/database/ECOMSCALING_DATABASE_CONTEXT_FOR_CODEX.md`  
   Contexto, reglas, decisiones y DBML completo.

2. `docs/database/ecomscaling_database_v0_2.dbml`  
   Diagrama conceptual y relaciones.

3. `supabase/migrations/*.sql`  
   **Fuente ejecutable de verdad** del estado real de PostgreSQL.

4. `docs/security/ACCESS_MATRIX_RLS.md`  
   Matriz rol → organización → operación.

5. `supabase/tests/database/*.sql`  
   Tests de constraints, aislamiento y policies.

6. `packages/database/src/database.types.ts`  
   Tipos generados desde la base de datos; no editar manualmente.

Cuando exista conflicto:

```text
Migraciones aplicadas + tests
        ↓
DBML aprobado
        ↓
Este documento
        ↓
Código de aplicación
```

Codex debe avisar si detecta divergencias.

---

## 4. Decisiones arquitectónicas no negociables

### 4.1 Multi-tenant

- Cada cliente de EcomScaling se representa mediante `public.organizations`.
- Toda tabla de negocio perteneciente a una tienda debe incluir `organization_id`.
- Los usuarios pertenecen a organizaciones mediante `organization_members`.
- Los consultores acceden mediante `consultant_assignments`.
- Los administradores globales se identifican mediante `profiles.platform_role = 'platform_admin'`.
- Tener una FK a una entidad no basta: las relaciones deben impedir enlaces entre organizaciones distintas.

### 4.2 Separación de schemas

| Schema | Uso |
|---|---|
| `auth` | Supabase Auth. Gestionado por Supabase. |
| `public` | Datos que pueden exponerse de forma controlada mediante RLS o backend. |
| `private` | Credenciales, webhooks y funciones auxiliares. Sin acceso directo desde el navegador. |

### 4.3 Escritura de integraciones

- Shopify, Meta, Klaviyo y futuros conectores escriben mediante backend/worker con `service_role`.
- Los usuarios pueden leer los datos importados que les correspondan.
- Los usuarios no modifican manualmente facts o métricas importadas.
- Los webhooks no sustituyen la reconciliación periódica.
- Toda sincronización debe ser idempotente y auditable.

### 4.4 Agentes de IA y SQL

Los agentes necesitan contexto empresarial profundo y adaptable. Pueden realizar análisis SQL dinámico, pero bajo estas reglas:

- consultas `SELECT` y `WITH` sobre tablas o vistas autorizadas;
- `organization_id` resuelto y forzado por backend;
- acceso bloqueado a `private`, credenciales y PII innecesaria;
- límites de tiempo, filas y coste;
- auditoría de consultas;
- escrituras mediante RPCs o tools tipadas;
- ninguna capacidad libre de `INSERT`, `UPDATE`, `DELETE`, DDL o cambio de RLS.

La amplitud del contexto puede crecer según la consulta:

```text
consulta puntual
→ métricas relacionadas
→ histórico comparable
→ plan, tareas y alertas
→ llamadas y conocimiento
→ contexto empresarial ampliado autorizado
```

### 4.5 Growth y Scale

Actualmente Growth y Scale se diferencian únicamente por:

- precio;
- rango de facturación de la tienda.

Por ahora:

- mismos agentes;
- misma profundidad;
- misma calidad;
- mismas respuestas;
- mismas métricas y herramientas.

Las futuras diferencias de contenido deben modelarse como capacidades configurables, no mediante prompts degradados.

### 4.6 GoHighLevel

GoHighLevel será el CRM comercial de EcomScaling y Supabase el núcleo operativo de EcomScaling IA.

Todavía no existe un mapeo validado de GoHighLevel. Por tanto:

- no inventar ahora tablas específicas de contacts, opportunities o locations;
- no asumir qué campo significa “cliente activo”;
- no asumir dónde está Growth/Scale;
- preparar la arquitectura para una integración futura;
- importar clientes activos cuando el modelo de GoHighLevel haya sido auditado.

El modelo v0.2 no incorpora aún HighLevel como proveedor congelado. Cualquier cambio deberá aprobarse como v0.3 o migración posterior documentada.

---

## 5. Fuente de verdad por tipo de dato

| Dato | Fuente de verdad |
|---|---|
| Usuario autenticado | Supabase Auth |
| Perfil y rol de plataforma | Supabase |
| Organización y miembros | Supabase |
| Plan comercial reflejado en la app | Supabase, sincronizable desde GoHighLevel |
| Estado comercial futuro | GoHighLevel o facturación, tras auditoría |
| Pedidos, productos e inventario | Shopify |
| Datos publicitarios | Meta |
| Campañas, flows y reporting de email | Klaviyo |
| Plan estratégico | Supabase |
| Alertas y tareas | Supabase |
| Llamadas y resúmenes | Supabase |
| Base de conocimiento y agentes | Supabase |
| Credenciales externas | `private` |
| Métricas derivadas | Motores deterministas de EcomScaling IA |

---

## 6. Inventario funcional del modelo v0.2

### SUPABASE AUTH

- `auth.users`

### CORE MULTI-TENANT

- `public.profiles`
- `public.organizations`
- `public.organization_members`
- `public.consultant_assignments`
- `public.service_subscriptions`

### CONFIGURACIÓN FINANCIERA Y OBJETIVOS

- `public.organization_financial_settings`
- `public.fixed_expenses`
- `public.shipping_cost_rules`
- `public.organization_metric_targets`

### INTEGRACIONES

- `public.integration_connections`
- `private.integration_credentials`
- `public.integration_sync_runs`
- `private.webhook_events`

### SHOPIFY

- `public.shopify_stores`
- `public.shopify_products`
- `public.shopify_variants`
- `public.product_costs`
- `public.shopify_order_facts`
- `public.shopify_order_items`
- `public.shopify_refunds`
- `public.shopify_refund_items`
- `public.shopify_inventory_items`
- `public.shopify_inventory_level_snapshots`
- `public.shopify_daily_store_metrics`
- `public.shopify_daily_product_metrics`
- `public.shopify_daily_product_traffic_metrics`
- `public.shopify_locations`

### PROVEEDORES Y PLANIFICACIÓN DE STOCK

- `public.suppliers`
- `public.product_supply_settings`
- `public.stock_forecasts`

### META ADS

- `public.meta_ad_accounts`
- `public.meta_campaigns`
- `public.meta_ad_sets`
- `public.meta_creatives`
- `public.meta_creative_assets`
- `public.meta_ads`
- `public.meta_ad_creative_assignments`
- `public.meta_insight_rows_daily`
- `public.meta_insight_action_metrics`
- `public.meta_calculated_metrics_daily`
- `public.meta_insight_report_runs`
- `public.meta_business_accounts`
- `public.meta_pages`
- `private.meta_asset_tokens`

### KLAVIYO

- `public.klaviyo_accounts`
- `public.klaviyo_lists`
- `public.klaviyo_list_daily_snapshots`
- `public.klaviyo_segments`
- `public.klaviyo_segment_daily_snapshots`
- `public.klaviyo_flows`
- `public.klaviyo_flow_actions`
- `public.klaviyo_flow_messages`
- `public.klaviyo_campaigns`
- `public.klaviyo_campaign_messages`
- `public.klaviyo_campaign_audiences`
- `public.klaviyo_forms`
- `public.klaviyo_report_runs`
- `public.klaviyo_report_values`
- `public.klaviyo_metrics`
- `public.klaviyo_daily_account_metrics`

### PLANIFICACIÓN DE CAMPAÑAS

- `public.marketing_campaigns`
- `public.marketing_campaign_products`

### ALERTAS Y TAREAS

- `public.alert_rule_templates`
- `public.organization_alert_rules`
- `public.alerts`
- `public.tasks`
- `public.task_status_history`
- `public.task_comments`

### PLAN ESTRATÉGICO: MI CAMINO

- `public.strategic_plans`
- `public.strategic_plan_phases`
- `public.strategic_plan_milestones`
- `public.milestone_task_links`
- `public.milestone_internal_notes`

### LLAMADAS, TRANSCRIPCIONES Y RESÚMENES

- `public.consulting_calls`
- `public.call_transcripts`
- `public.call_ai_summaries`
- `public.call_task_links`

### INSTAGRAM Y ANÁLISIS DE CONTENIDO

- `public.instagram_accounts`
- `public.instagram_account_snapshots`
- `public.instagram_account_insight_values`
- `public.instagram_media`
- `public.instagram_follower_winners`
- `public.instagram_media_insight_values`

### CONSULTOR IA Y BASE DE CONOCIMIENTO

- `public.knowledge_documents`
- `public.knowledge_chunks`
- `public.ai_conversations`
- `public.ai_messages`

### NOTIFICACIONES Y AUDITORÍA

- `public.notifications`
- `public.audit_logs`


---

## 7. Estrategia de migraciones

No crear todas las tablas a la vez. La secuencia recomendada es:

### Fase DB-00 — Infraestructura

- crear schema `private`;
- habilitar `pgcrypto`;
- habilitar `vector` cuando se implemente RAG;
- función común `set_updated_at`;
- configuración de permisos de schemas;
- base de tests SQL.

Archivos orientativos:

```text
0001_create_private_schema.sql
0002_enable_pgcrypto.sql
0003_create_updated_at_trigger_function.sql
```

### Fase DB-01 — Enums del núcleo

Crear solo enums necesarios para el primer vertical slice. Los enums de fases posteriores pueden esperar.

### Fase DB-02 — Auth y multi-tenant

- `profiles`;
- `organizations`;
- `organization_members`;
- `consultant_assignments`;
- `service_subscriptions`;
- `notifications`;
- `audit_logs`.

Añadir:

- trigger de creación de profile;
- helpers RLS;
- policies;
- seeds de dos organizaciones para pruebas cross-tenant.

### Fase DB-03 — Configuración financiera

- `organization_financial_settings`;
- `fixed_expenses`;
- `shipping_cost_rules`;
- `organization_metric_targets`.

### Fase DB-04 — Integraciones comunes

- `integration_connections`;
- `private.integration_credentials`;
- `integration_sync_runs`;
- `private.webhook_events`.

### Fase DB-05 — Shopify vertical slice

Primero:

- `shopify_stores`;
- `shopify_products`;
- `shopify_variants`;
- `shopify_inventory_items`;
- `shopify_locations`;
- `shopify_order_facts`;
- `shopify_order_items`;
- `shopify_refunds`;
- `shopify_refund_items`;
- `product_costs`;
- `shopify_daily_store_metrics`.

Después:

- snapshots de inventario;
- métricas diarias por producto;
- tráfico por producto;
- proveedores y forecasts.

### Fase DB-06 — Meta vertical slice

- autorización y activos;
- cuentas;
- campañas;
- ad sets;
- anuncios;
- creatividades;
- insights;
- action metrics;
- métricas calculadas;
- report runs.

### Fase DB-07 — Alertas, tareas y plan

- reglas;
- alertas;
- tareas;
- historial;
- comentarios;
- plan, fases, hitos y enlaces.

### Fase DB-08 — Llamadas y primer agente

- `consulting_calls`;
- `call_transcripts`;
- `call_ai_summaries`;
- `call_task_links`;
- tablas de runtime de agentes cuando su contrato esté aprobado.

### Fase DB-09 — Klaviyo y campañas

- cuentas;
- listas;
- segmentos;
- flows, acciones y mensajes;
- campañas y audiencias;
- forms;
- metrics;
- reporting;
- métricas derivadas;
- planificación de campañas.

### Fase DB-10 — Instagram

- cuentas;
- snapshots;
- media;
- insights;
- ganadores manuales.

### Fase DB-11 — RAG y Consultor IA

- documentos;
- chunks;
- conversaciones;
- mensajes;
- runtime y auditoría de agentes;
- índices vectoriales.

---

## 8. Reglas de generación SQL

### 8.1 Convenciones

- nombres `snake_case`;
- PK UUID con `gen_random_uuid()`;
- fechas de sistema en `timestamptz`;
- fechas de negocio sin hora en `date`;
- dinero en `numeric`, nunca `float`;
- IDs externos en `varchar`, aunque parezcan numéricos;
- JSON externo en `jsonb`;
- índices orientados a filtros reales, no a cada columna;
- comentarios SQL para invariantes relevantes.

### 8.2 `updated_at`

Toda tabla con `updated_at` debe utilizar un trigger común. No repetir una función diferente por tabla.

### 8.3 Foreign keys y borrado

Codex debe decidir y declarar explícitamente el comportamiento:

- `CASCADE`: solo hijos puros que no tienen sentido sin el padre;
- `RESTRICT` o `NO ACTION`: facts, métricas e históricos;
- `SET NULL`: actores opcionales o referencias históricas a entidades eliminables.

No dejar la decisión implícita sin justificarla.

### 8.4 Integridad multi-tenant

Cuando sea necesario, usar:

- claves únicas compuestas `(organization_id, id)`;
- foreign keys compuestas;
- triggers de validación;
- RPCs de escritura;
- tests que intenten enlazar datos de organizaciones distintas.

RLS no sustituye constraints de integridad.

### 8.5 Idempotencia

Las importaciones deben usar claves externas únicas por cuenta o tienda. El patrón preferido es:

```sql
insert ...
on conflict (...) do update
set ...
```

No basar la idempotencia únicamente en timestamps.

### 8.6 Raw data

`raw_data` es una copia auxiliar para depuración y evolución del conector:

- no debe ser la fuente principal del dashboard;
- no debe contener secretos;
- debe respetar minimización de datos;
- puede limpiarse o versionarse mediante políticas de retención.

---

## 9. Constraints que el DBML no expresa completamente

Estas reglas deben añadirse en SQL cuando se creen las tablas correspondientes.

### 9.1 Klaviyo campaign audiences

`klaviyo_campaign_audiences` debe cumplir:

- `audience_type = 'list'` → `list_id` no nulo y `segment_id` nulo;
- `audience_type = 'segment'` → `segment_id` no nulo y `list_id` nulo.

Implementar `CHECK`.

### 9.2 Klaviyo report values

`klaviyo_report_values` debe tener exactamente la FK interna correspondiente a `entity_type`.

Ejemplos:

- `campaign` → `campaign_id`;
- `campaign_message` → `campaign_message_id`;
- `flow` → `flow_id`;
- `flow_message` → `flow_message_id`;
- `form` → `form_id`;
- `segment` → `segment_id`.

Implementar `CHECK`, o separar en tablas cuando el uso real lo justifique.

### 9.3 Métrica primaria de conversión

Solo una `klaviyo_metric` por cuenta debe ser primaria:

```sql
create unique index ...
on public.klaviyo_metrics(account_id)
where is_primary_conversion_metric;
```

### 9.4 Unicidad con columnas nulas

PostgreSQL permite varias filas `NULL` en índices únicos convencionales. Revisar especialmente:

- `klaviyo_daily_account_metrics.conversion_metric_id`;
- `shopify_daily_product_metrics.variant_id`;
- `product_supply_settings.supplier_id`;
- `integration_connections.external_account_id`;
- cualquier índice compuesto con una FK opcional.

Usar según el caso:

- `NULLS NOT DISTINCT`;
- índices parciales;
- dos índices separados;
- columna sustituta no nula.

### 9.5 Transcripción actual

Solo puede existir una transcripción actual por llamada:

```sql
create unique index ...
on public.call_transcripts(call_id)
where is_current;
```

### 9.6 Consultor principal

Solo debe existir un consultor principal activo por organización:

```sql
create unique index ...
on public.consultant_assignments(organization_id)
where is_primary and is_active;
```

### 9.7 Suscripción vigente

Definir si una organización puede tener varias suscripciones simultáneas. Para el MVP se recomienda una sola `trial` o `active`, salvo decisión distinta.

### 9.8 Webhook idempotency

`external_event_id` puede ser nulo. Una unique constraint normal no deduplica eventos nulos. Añadir:

- índice único parcial cuando exista ID externo;
- fingerprint calculado para proveedores sin ID;
- registro de intentos y replay seguro.

### 9.9 Consistencia de Meta Insights

Según `level`:

- `campaign` requiere `campaign_id`;
- `adset` requiere `ad_set_id`;
- `ad` requiere `ad_id`;
- `account` no requiere las anteriores.

Añadir checks razonables sin impedir breakdowns válidos.

### 9.10 Integridad de organización en referencias

Evitar casos como:

```text
task.organization_id = A
task.alert_id pertenece a B
```

Añadir tests y constraints compuestos en los dominios críticos.

---

## 10. RLS y helpers previstos

Funciones auxiliares ya diseñadas como referencia:

```text
private.is_platform_admin()
private.is_consultant()
private.is_active_org_member(organization_id)
private.current_member_role(organization_id)
private.is_assigned_consultant(organization_id)
private.has_valid_subscription(organization_id)
private.can_identify_org(organization_id)
private.can_access_org(organization_id)
private.can_edit_org_data(organization_id)
private.can_manage_org(organization_id)
private.is_consultant_or_admin_for_org(organization_id)
private.can_view_profile(user_id)
private.can_view_task(task_id)
private.can_view_call(call_id)
private.can_view_plan(plan_id)
private.can_view_plan_phase(phase_id)
private.can_view_milestone(milestone_id)
private.owns_ai_conversation(conversation_id)
```

RPC de referencia:

```text
public.set_task_status(...)
```

### Matriz resumida

| Actor | Alcance |
|---|---|
| Cliente | Su organización y contenido visible para cliente |
| `readonly` | Solo lectura |
| Consultor | Organizaciones asignadas, incluidas notas internas |
| Platform admin | Acceso global controlado |
| Backend `service_role` | Integraciones, métricas, IA y procesos internos |
| Navegador | Nunca credenciales ni `private` |

### Reglas de implementación

- activar RLS en todas las tablas expuestas;
- no conceder acceso a `private` para `anon` o `authenticated`;
- funciones `SECURITY DEFINER` con `search_path = ''`;
- nombres de tablas totalmente cualificados dentro de funciones;
- revocar `EXECUTE` por defecto y conceder solo a roles necesarios;
- probar cliente A contra cliente B;
- probar consultor asignado y no asignado;
- probar suscripción cancelada o suspendida.

---

## 11. Seeds mínimos

Los seeds de desarrollo deben crear:

- un `platform_admin`;
- un consultor;
- dos organizaciones;
- owner, manager, member y readonly;
- una suscripción activa y una cancelada;
- asignación de consultor solo a una organización;
- datos Shopify/Meta sintéticos;
- una alerta y varias tareas;
- un plan estratégico;
- una llamada con transcripción y resumen.

Los tests deben verificar que los usuarios de una organización no pueden acceder a la otra.

---

## 12. Definition of Done de una migración

Una migración no está terminada hasta que:

- aplica desde una base vacía;
- revierte mediante estrategia documentada o tiene rollback compensatorio;
- no depende de ejecución manual fuera del repositorio;
- crea constraints e índices necesarios;
- define RLS cuando la tabla queda expuesta;
- incluye comentarios para invariantes no obvios;
- incluye seeds o fixtures cuando corresponda;
- pasa tests SQL;
- regenera tipos TypeScript;
- actualiza DBML y contexto si cambia el modelo;
- no expone secretos ni PII innecesaria.

---

## 13. Checklist para cada petición a Codex

Usar un prompt similar:

```text
Lee docs/database/ECOMSCALING_DATABASE_CONTEXT_FOR_CODEX.md completo.
Implementa únicamente la fase y las tablas indicadas.
No inventes columnas.
Comprueba las migraciones existentes.
Crea una migración Supabase idempotente y tests SQL.
Añade RLS, índices, constraints, comentarios y triggers aplicables.
No modifiques auth.users.
No expongas private ni service_role.
Muestra un resumen de cambios, riesgos y comandos de verificación.
```

---

## 14. Decisiones pendientes que Codex no debe resolver solo

- mapeo exacto de GoHighLevel;
- regla comercial exacta de activación/cancelación;
- capacidades futuras distintas entre Growth y Scale;
- nomenclatura exacta de anuncios de Meta;
- fórmula canónica final de algunos KPIs calculados;
- frecuencia de sincronización por proveedor;
- retención de `raw_data` y webhooks;
- proveedor/modelo final de embeddings y dimensión;
- autonomía futura de agentes para acciones externas.

Estas decisiones requieren aprobación humana.

---

# ANEXO A — DBML COMPLETO v0.2

El siguiente bloque es la representación conceptual completa vigente. No debe ejecutarse como SQL.

```dbml
// ============================================================
// ECOMSCALING IA
// Modelo de base de datos v0.2
// PostgreSQL + Supabase
//
// Principios:
// - Multi-tenant mediante organization_id
// - Métricas asociadas a tiendas/cuentas, no a usuarios
// - Separación entre datos operativos, métricas y credenciales
// - Datos sensibles en schema private
// - Preparado para RLS de Supabase
// ============================================================


// ============================================================
// ENUMS
// ============================================================

Enum platform_role {
  user
  consultant
  platform_admin
}

Enum organization_status {
  onboarding
  active
  suspended
  cancelled
}

Enum member_role {
  owner
  manager
  member
  readonly
}

Enum subscription_status {
  pending
  trial
  active
  paused
  cancelled
  expired
}

Enum integration_provider {
  shopify
  meta
  klaviyo
  loom
  fathom
}

Enum integration_status {
  pending
  connected
  disconnected
  expired
  error
}

Enum sync_status {
  pending
  running
  completed
  partial
  failed
}

Enum task_status {
  pending
  in_progress
  completed
  ignored
  cancelled
}

Enum task_priority {
  low
  medium
  high
  urgent
}

Enum task_source {
  manual
  alert
  consulting_call
  strategic_plan
  ai_consultant
  system
}

Enum alert_status {
  open
  acknowledged
  resolved
  dismissed
}

Enum alert_severity {
  info
  low
  medium
  high
  critical
}

Enum plan_status {
  draft
  active
  completed
  archived
}

Enum plan_phase_status {
  locked
  pending
  active
  completed
}

Enum milestone_status {
  locked
  pending
  in_progress
  completed
  skipped
}

Enum call_status {
  draft
  processing
  pending_review
  approved
  published
  failed
}

Enum ai_review_status {
  pending
  approved
  rejected
  edited
}

Enum campaign_status {
  draft
  planned
  scheduled
  sent
  cancelled
}

Enum campaign_channel {
  email
  sms
  whatsapp
  meta_ads
  other
}

Enum knowledge_document_status {
  draft
  processing
  ready
  failed
  archived
}

Enum conversation_status {
  active
  closed
  archived
}

Enum message_role {
  user
  assistant
  system
  tool
}

Enum notification_status {
  unread
  read
  archived
}

Enum product_cost_source {
  shopify
  manual
  imported
  calculated
}

Enum product_traffic_source {
  shopifyql
  web_pixel
  manual
  unavailable
}

Enum meta_insight_level {
  account
  campaign
  adset
  ad
}

Enum meta_creative_asset_type {
  image
  video
  primary_text
  headline
  description
  call_to_action
  link_url
  thumbnail
  other
}

Enum meta_report_status {
  pending
  running
  completed
  failed
  cancelled
}

Enum metric_origin {
  api
  calculated
  manual
}

Enum klaviyo_audience_type {
  list
  segment
}

Enum klaviyo_audience_role {
  included
  excluded
}

Enum klaviyo_report_entity_type {
  campaign
  campaign_message
  flow
  flow_message
  form
  segment
}

Enum klaviyo_report_type {
  values
  series
  metric_aggregate
}

Enum klaviyo_report_status {
  pending
  running
  completed
  failed
}


// ============================================================
// SUPABASE AUTH
// Tabla administrada por Supabase. Solo se representa en el ERD.
// ============================================================

Table auth.users {
  id uuid [pk]
  email varchar
  created_at timestamptz

  Note: 'Tabla gestionada por Supabase Auth. No crear manualmente.'
}


// ============================================================
// CORE MULTI-TENANT
// ============================================================

Table public.profiles {
  id uuid [pk]
  full_name varchar(180)
  avatar_url text
  phone varchar(40)
  platform_role platform_role [not null, default: 'user']
  is_active boolean [not null, default: true]
  last_login_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Note: 'Perfil público asociado a auth.users.'
}

Table public.organizations {
  id uuid [pk, default: `gen_random_uuid()`]
  legal_name varchar(200)
  display_name varchar(200) [not null]
  slug varchar(120) [not null, unique]
  tax_id varchar(40)
  website_url text
  ecommerce_url text
  timezone varchar(80) [not null, default: 'Europe/Madrid']
  currency_code varchar(3) [not null, default: 'EUR']
  status organization_status [not null, default: 'onboarding']
  onboarding_completed_at timestamptz
  activated_at timestamptz
  suspended_at timestamptz
  created_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Note: 'Cada organización representa una tienda o cliente de EcomScaling.'
}

Table public.organization_members {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  user_id uuid [not null]
  role member_role [not null, default: 'member']
  is_active boolean [not null, default: true]
  invited_by uuid
  invited_at timestamptz
  joined_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (organization_id, user_id) [unique]
    organization_id
    user_id
  }

  Note: 'Usuarios pertenecientes a una tienda.'
}

Table public.consultant_assignments {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  consultant_user_id uuid [not null]
  is_primary boolean [not null, default: false]
  is_active boolean [not null, default: true]
  assigned_by uuid
  assigned_at timestamptz [not null, default: `now()`]
  ended_at timestamptz

  indexes {
    (organization_id, consultant_user_id) [unique]
    organization_id
    consultant_user_id
  }

  Note: 'Controla qué consultores pueden acceder a cada cliente.'
}

Table public.service_subscriptions {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  plan_code varchar(50) [not null]
  status subscription_status [not null, default: 'pending']
  starts_at timestamptz
  ends_at timestamptz
  cancelled_at timestamptz
  external_subscription_id varchar(200)
  metadata jsonb
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    status
  }

  Note: 'El acceso a la aplicación depende de una suscripción activa.'
}


// ============================================================
// CONFIGURACIÓN FINANCIERA Y OBJETIVOS
// ============================================================

Table public.organization_financial_settings {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null, unique]
  break_even_roas numeric(10,4)
  estimated_fixed_monthly_cost numeric(14,2)
  default_gross_margin_percentage numeric(8,4)
  default_product_cost_percentage numeric(8,4)
  calculation_method varchar(60)
  configured_by uuid
  configured_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Note: 'Configuración necesaria para estimar beneficio neto y rentabilidad.'
}

Table public.fixed_expenses {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  name varchar(180) [not null]
  category varchar(100)
  monthly_amount numeric(14,2) [not null]
  currency_code varchar(3) [not null, default: 'EUR']
  starts_on date
  ends_on date
  is_active boolean [not null, default: true]
  created_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
  }
}

Table public.shipping_cost_rules {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  zone_code varchar(50) [not null]
  zone_name varchar(120) [not null]
  country_codes jsonb
  charged_to_customer numeric(12,2)
  actual_shipping_cost numeric(12,2)
  free_shipping_threshold numeric(12,2)
  is_active boolean [not null, default: true]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (organization_id, zone_code) [unique]
  }
}

Table public.organization_metric_targets {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  metric_code varchar(100) [not null]
  minimum_value numeric(16,4)
  maximum_value numeric(16,4)
  target_value numeric(16,4)
  lookback_days int
  configured_by uuid
  is_active boolean [not null, default: true]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (organization_id, metric_code) [unique]
  }

  Note: 'Objetivos personalizados: popup conversion, hook rate, recurrencia, etc.'
}


// ============================================================
// INTEGRACIONES
// ============================================================

Table public.integration_connections {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  provider integration_provider [not null]
  external_account_id varchar(255)
  external_account_name varchar(255)
  status integration_status [not null, default: 'pending']
  non_secret_settings jsonb
  scopes jsonb
  connected_by uuid
  connected_at timestamptz
  token_expires_at timestamptz
  last_successful_sync_at timestamptz
  last_error_at timestamptz
  last_error_message text
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    provider
    (organization_id, provider, external_account_id) [unique]
  }

  Note: 'Solo contiene metadatos no sensibles de la conexión.'
}

Table private.integration_credentials {
  id uuid [pk, default: `gen_random_uuid()`]
  connection_id uuid [not null, unique]
  access_token_encrypted text
  refresh_token_encrypted text
  api_key_encrypted text
  client_secret_encrypted text
  encryption_key_version varchar(50)
  token_expires_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Note: 'Nunca exponer mediante Supabase API pública. Acceso exclusivo desde backend seguro.'
}

Table public.integration_sync_runs {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]

  provider integration_provider [not null]

  sync_scope varchar(120)
  sync_mode varchar(60)

  api_version varchar(20)

  external_operation_id varchar(255)

  status sync_status [not null, default: 'pending']

  records_read int [not null, default: 0]
  records_created int [not null, default: 0]
  records_updated int [not null, default: 0]
  records_failed int [not null, default: 0]

  cursor_value text
  watermark_updated_at timestamptz

  error_code varchar(120)
  error_message text

  started_at timestamptz
  finished_at timestamptz

  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    connection_id
    provider
    status
    external_operation_id

    (organization_id, created_at)
  }

  Note: 'Registra sincronizaciones paginadas, webhooks, reconciliaciones y Bulk Operations.'
}

Table private.webhook_events {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid
  connection_id uuid

  provider integration_provider [not null]

  source_account_identifier varchar(255)
  api_version varchar(30)

  external_event_id varchar(255)
  event_type varchar(180) [not null]

  payload jsonb [not null]
  provider_context jsonb

  signature_valid boolean [not null, default: false]

  processed boolean [not null, default: false]
  processing_attempts int [not null, default: 0]

  processing_error text

  triggered_at timestamptz
  received_at timestamptz [not null, default: `now()`]
  processed_at timestamptz

  indexes {
    (provider, external_event_id) [unique]

    organization_id
    connection_id
    event_type
    processed
    received_at
  }

  Note: 'Eventos externos validados y procesados de forma idempotente desde el backend.'
}


// ============================================================
// SHOPIFY
// ============================================================

Table public.shopify_stores {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]

  external_shop_id varchar(255) [not null]

  myshopify_domain varchar(255) [not null]
  primary_domain varchar(255)

  shop_name varchar(255) [not null]

  currency_code varchar(3)
  timezone varchar(100)
  plan_display_name varchar(120)
  weight_unit varchar(30)

  taxes_included boolean

  is_active boolean [not null, default: true]

  external_created_at timestamptz
  external_updated_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (organization_id, external_shop_id) [unique]
    connection_id [unique]
    myshopify_domain [unique]
    organization_id
  }

  Note: 'Tienda Shopify identificada automáticamente mediante la query shop.'
}

Table public.shopify_products {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  store_id uuid [not null]
  external_product_id varchar(255) [not null]
  title varchar(255) [not null]
  handle varchar(255)
  vendor varchar(180)
  product_type varchar(180)
  status varchar(50)
  published_at timestamptz
  external_created_at timestamptz
  external_updated_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (store_id, external_product_id) [unique]
    organization_id
    store_id
  }
}

Table public.shopify_variants {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  product_id uuid [not null]

  external_variant_id varchar(255) [not null]

  title varchar(255)
  barcode varchar(180)

  current_price numeric(14,2)
  compare_at_price numeric(14,2)

  position int
  taxable boolean
  inventory_policy varchar(50)

  is_active boolean [not null, default: true]

  external_created_at timestamptz
  external_updated_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (product_id, external_variant_id) [unique]
    organization_id
    product_id
    barcode
  }

  Note: 'Variante comercial del producto. El SKU, coste y control de inventario pertenecen principalmente a InventoryItem.'
}

Table public.product_costs {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  inventory_item_id uuid [not null]

  unit_cost numeric(14,4) [not null]
  currency_code varchar(3) [not null, default: 'EUR']

  source product_cost_source [not null]

  is_override boolean [not null, default: false]

  valid_from date [not null]
  valid_until date

  created_by uuid

  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    inventory_item_id
    valid_from

    (inventory_item_id, valid_from, source) [unique]
  }

  Note: 'Histórico de costes. Puede proceder de Shopify o haber sido sobrescrito manualmente.'
}

Table public.shopify_order_facts {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  store_id uuid [not null]

  external_order_id varchar(255) [not null]
  order_name varchar(100)

  customer_reference_hash varchar(255)

  financial_status varchar(80)
  fulfillment_status varchar(80)

  source_name varchar(100)

  currency_code varchar(3)
  presentment_currency_code varchar(3)

  gross_sales numeric(14,2) [not null, default: 0]
  discounts numeric(14,2) [not null, default: 0]
  refunds numeric(14,2) [not null, default: 0]
  net_sales numeric(14,2) [not null, default: 0]

  current_subtotal_price numeric(14,2) [not null, default: 0]
  current_shipping_price numeric(14,2) [not null, default: 0]
  current_total_tax numeric(14,2) [not null, default: 0]
  current_total_price numeric(14,2) [not null, default: 0]

  total_items int [not null, default: 0]

  is_first_customer_order boolean
  is_test_order boolean [not null, default: false]

  external_created_at timestamptz
  processed_at timestamptz
  external_updated_at timestamptz

  cancelled_at timestamptz
  cancel_reason varchar(120)

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (store_id, external_order_id) [unique]

    organization_id
    store_id
    processed_at
    external_updated_at
    customer_reference_hash

    (organization_id, processed_at)
  }

  Note: 'Pedido sincronizado sin almacenar nombre, email, teléfono ni dirección del comprador.'
}

Table public.shopify_order_items {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  order_id uuid [not null]

  product_id uuid
  variant_id uuid

  external_line_item_id varchar(255) [not null]

  title varchar(255) [not null]
  sku_snapshot varchar(180)
  vendor_snapshot varchar(180)

  quantity_original int [not null, default: 0]
  quantity_current int [not null, default: 0]

  unit_price numeric(14,2) [not null, default: 0]

  original_line_total numeric(14,2) [not null, default: 0]
  discount_total numeric(14,2) [not null, default: 0]
  current_line_total numeric(14,2) [not null, default: 0]

  refunded_quantity int [not null, default: 0]
  refunded_amount numeric(14,2) [not null, default: 0]

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (order_id, external_line_item_id) [unique]

    organization_id
    order_id
    product_id
    variant_id
    sku_snapshot
  }

  Note: 'Línea económica del pedido. Conserva datos históricos aunque el producto se modifique o elimine.'
}

Table public.shopify_refunds {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  order_id uuid [not null]

  external_refund_id varchar(255) [not null]

  total_refunded numeric(14,2) [not null, default: 0]
  currency_code varchar(3)

  external_created_at timestamptz [not null]

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (order_id, external_refund_id) [unique]

    organization_id
    order_id
    external_created_at
  }

  Note: 'Cabecera del reembolso económico de un pedido.'
}


Table public.shopify_refund_items {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]

  refund_id uuid [not null]
  order_item_id uuid [not null]

  location_id uuid

  external_refund_line_item_id varchar(255)

  quantity int [not null]

  subtotal numeric(14,2) [not null, default: 0]
  total_tax numeric(14,2) [not null, default: 0]

  restock_type varchar(80)

  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    refund_id
    order_item_id

    (refund_id, external_refund_line_item_id) [unique]
  }

  Note: 'Productos y cantidades concretas incluidas en un reembolso.'
}

Table public.shopify_inventory_items {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  variant_id uuid [not null, unique]

  external_inventory_item_id varchar(255) [not null]

  sku varchar(180)

  tracked boolean [not null, default: false]
  requires_shipping boolean [not null, default: true]

  current_unit_cost numeric(14,4)
  cost_currency_code varchar(3)

  country_code_of_origin varchar(2)
  province_code_of_origin varchar(10)
  harmonized_system_code varchar(20)

  measurement_data jsonb

  external_created_at timestamptz
  external_updated_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    external_inventory_item_id [unique]
    organization_id
    sku
  }

  Note: 'Entidad de inventario de Shopify asociada normalmente 1:1 con una variante.'
}

Table public.shopify_inventory_level_snapshots {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]

  inventory_item_id uuid [not null]
  location_id uuid [not null]

  external_inventory_level_id varchar(255)

  available_quantity int
  on_hand_quantity int
  committed_quantity int
  incoming_quantity int

  quantities_data jsonb

  is_active boolean [not null, default: true]

  captured_at timestamptz [not null]

  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    inventory_item_id
    location_id
    captured_at

    (inventory_item_id, location_id, captured_at) [unique]
  }

  Note: 'Fotografía histórica de las cantidades de un InventoryItem en una Location concreta.'
}

Table public.shopify_daily_store_metrics {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  store_id uuid [not null]
  metric_date date [not null]
  orders_count int [not null, default: 0]
  units_sold int [not null, default: 0]
  gross_revenue numeric(14,2) [not null, default: 0]
  net_revenue numeric(14,2) [not null, default: 0]
  refunds numeric(14,2) [not null, default: 0]
  shipping_revenue numeric(14,2) [not null, default: 0]
  unique_customers int [not null, default: 0]
  new_customers int [not null, default: 0]
  returning_customers int [not null, default: 0]
  average_order_value numeric(14,2)
  recurrence_90d numeric(8,4)
  estimated_product_cost numeric(14,2)
  estimated_shipping_cost numeric(14,2)
  estimated_fixed_cost numeric(14,2)
  estimated_ad_cost numeric(14,2)
  estimated_net_profit numeric(14,2)
  estimated_profit_per_order numeric(14,2)
  calculated_at timestamptz [not null, default: `now()`]

  indexes {
    (store_id, metric_date) [unique]
    organization_id
    metric_date
  }
}

Table public.shopify_daily_product_metrics {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]

  product_id uuid [not null]
  variant_id uuid

  metric_date date [not null]

  units_sold int [not null, default: 0]
  orders_count int [not null, default: 0]

  gross_revenue numeric(14,2) [not null, default: 0]
  discounts numeric(14,2) [not null, default: 0]
  refunds numeric(14,2) [not null, default: 0]
  net_revenue numeric(14,2) [not null, default: 0]

  available_stock int

  calculated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    product_id
    variant_id
    metric_date

    (product_id, variant_id, metric_date) [unique]
  }

  Note: 'Métricas comerciales diarias calculadas a partir de pedidos, devoluciones e inventario.'
}


Table public.shopify_daily_product_traffic_metrics {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]

  store_id uuid [not null]
  product_id uuid [not null]

  metric_date date [not null]

  source product_traffic_source [not null]

  page_views int [not null, default: 0]
  add_to_cart_count int [not null, default: 0]
  checkout_started_count int [not null, default: 0]
  purchases_count int [not null, default: 0]

  conversion_rate numeric(8,4)

  calculated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    store_id
    product_id
    metric_date

    (product_id, metric_date, source) [unique]
  }

  Note: 'Tráfico por producto obtenido mediante ShopifyQL, Web Pixel u otra fuente validada.'
}



Table public.shopify_locations {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  store_id uuid [not null]

  external_location_id varchar(255) [not null]

  name varchar(255) [not null]

  is_active boolean [not null, default: true]
  fulfills_online_orders boolean

  address_data jsonb

  external_created_at timestamptz
  external_updated_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (store_id, external_location_id) [unique]
    organization_id
    store_id
  }

  Note: 'Almacenes, tiendas físicas u operadores logísticos donde Shopify mantiene inventario.'
}


// ============================================================
// PROVEEDORES Y PLANIFICACIÓN DE STOCK
// Fase 2
// ============================================================

Table public.suppliers {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  name varchar(200) [not null]
  reference_code varchar(100)
  default_lead_time_days int
  country_code varchar(2)
  is_active boolean [not null, default: true]
  created_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
  }
}

Table public.product_supply_settings {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  variant_id uuid [not null]
  supplier_id uuid
  lead_time_days int [not null]
  safety_stock_quantity int [not null, default: 0]
  reorder_point_quantity int
  minimum_order_quantity int
  season_code varchar(80)
  season_start_month int
  season_end_month int
  is_active boolean [not null, default: true]
  created_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (variant_id, supplier_id) [unique]
    organization_id
  }
}

Table public.stock_forecasts {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  variant_id uuid [not null]
  forecast_date date [not null]
  forecast_period_start date [not null]
  forecast_period_end date [not null]
  expected_units_sold int
  current_stock int
  safety_stock int
  recommended_order_quantity int
  recommended_order_date date
  projected_stockout_date date
  calculation_data jsonb
  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    variant_id
    forecast_date
  }
}


// ============================================================
// META ADS
// ============================================================

Table public.meta_ad_accounts {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]
  business_account_id uuid

  external_ad_account_id varchar(255) [not null]

  account_name varchar(255) [not null]

  account_status_code int
  disable_reason_code int

  currency_code varchar(3)
  timezone_name varchar(100)
  timezone_offset_hours_utc numeric(6,2)

  amount_spent numeric(16,2)
  balance numeric(16,2)
  spend_cap numeric(16,2)
  minimum_daily_budget numeric(16,2)

  is_selected boolean [not null, default: true]
  is_active boolean [not null, default: true]

  raw_data jsonb

  last_synced_at timestamptz

  external_created_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (connection_id, external_ad_account_id) [unique]
    organization_id
    business_account_id
    account_status_code
  }

  Note: 'Cuenta publicitaria Meta seleccionada por el cliente.'
}

Table public.meta_campaigns {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  ad_account_id uuid [not null]

  external_campaign_id varchar(255) [not null]

  name varchar(255) [not null]

  objective varchar(120)
  buying_type varchar(80)

  configured_status varchar(80)
  effective_status varchar(80)

  special_ad_categories jsonb

  daily_budget numeric(16,2)
  lifetime_budget numeric(16,2)
  budget_remaining numeric(16,2)

  bid_strategy varchar(120)

  starts_at timestamptz
  ends_at timestamptz

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (ad_account_id, external_campaign_id) [unique]
    organization_id
    ad_account_id
    effective_status
    objective
  }
}

Table public.meta_ad_sets {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  campaign_id uuid [not null]

  external_ad_set_id varchar(255) [not null]

  name varchar(255) [not null]

  configured_status varchar(80)
  effective_status varchar(80)

  optimization_goal varchar(120)
  billing_event varchar(120)

  bid_strategy varchar(120)
  bid_amount numeric(16,2)

  daily_budget numeric(16,2)
  lifetime_budget numeric(16,2)
  budget_remaining numeric(16,2)

  destination_type varchar(120)

  promoted_object jsonb
  targeting_data jsonb
  attribution_spec jsonb

  is_dynamic_creative boolean [not null, default: false]

  starts_at timestamptz
  ends_at timestamptz

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (campaign_id, external_ad_set_id) [unique]
    organization_id
    campaign_id
    effective_status
    optimization_goal
  }
}

Table public.meta_creatives {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  ad_account_id uuid [not null]

  external_creative_id varchar(255) [not null]

  name varchar(255)

  object_type varchar(100)

  object_story_id varchar(255)
  effective_object_story_id varchar(255)

  call_to_action_type varchar(100)

  primary_text text
  headline varchar(500)
  description text

  link_url text
  thumbnail_url text

  image_hash varchar(255)
  external_video_id varchar(255)

  url_tags text

  object_story_spec jsonb
  asset_feed_spec jsonb
  degrees_of_freedom_spec jsonb

  raw_data jsonb

  last_synced_at timestamptz

  external_created_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (ad_account_id, external_creative_id) [unique]
    organization_id
    ad_account_id
    external_video_id
    image_hash
  }

  Note: 'Cabecera de la creatividad. Las variantes de imágenes, vídeos y textos se guardan en meta_creative_assets.'
}


Table public.meta_creative_assets {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  creative_id uuid [not null]

  asset_type meta_creative_asset_type [not null]

  position int [not null, default: 0]

  external_asset_id varchar(255)
  asset_hash varchar(255)

  text_value text

  media_url text
  thumbnail_url text
  link_url text

  asset_label varchar(180)

  is_primary boolean [not null, default: false]

  metadata jsonb

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    creative_id
    asset_type
    external_asset_id
    asset_hash
  }

  Note: 'Activos individuales de una creatividad clásica o dinámica.'
}


Table public.meta_ads {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  ad_set_id uuid [not null]

  current_creative_id uuid

  external_ad_id varchar(255) [not null]

  name varchar(255) [not null]

  configured_status varchar(80)
  effective_status varchar(80)

  parsed_angle varchar(180)
  parsed_format varchar(120)
  parsed_hook varchar(255)

  naming_parser_version varchar(50)
  parsed_naming_data jsonb

  tracking_specs jsonb
  conversion_specs jsonb
  review_feedback jsonb

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (ad_set_id, external_ad_id) [unique]
    organization_id
    ad_set_id
    current_creative_id
    effective_status
    parsed_angle
    parsed_format
  }
}

Table public.meta_ad_creative_assignments {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]

  ad_id uuid [not null]
  creative_id uuid [not null]

  valid_from timestamptz [not null]
  valid_until timestamptz

  detected_at timestamptz [not null, default: `now()`]

  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    ad_id
    creative_id
    valid_from
  }

  Note: 'Histórico de creatividades asociadas a un anuncio para no perder la relación temporal.'
}

Table public.meta_insight_rows_daily {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  ad_account_id uuid [not null]

  campaign_id uuid
  ad_set_id uuid
  ad_id uuid

  level meta_insight_level [not null]
  external_entity_id varchar(255) [not null]

  metric_date date [not null]

  publisher_platform varchar(80)
  platform_position varchar(120)
  device_platform varchar(80)

  breakdowns jsonb
  breakdown_hash varchar(64) [not null, default: 'none']

  attribution_windows jsonb
  attribution_hash varchar(64) [not null, default: 'default']

  action_report_time varchar(50) [not null, default: 'default']

  spend numeric(18,4) [not null, default: 0]

  impressions bigint [not null, default: 0]
  reach bigint [not null, default: 0]
  frequency numeric(12,6)

  clicks bigint [not null, default: 0]
  unique_clicks bigint [not null, default: 0]
  inline_link_clicks bigint [not null, default: 0]
  outbound_clicks bigint [not null, default: 0]

  cpm numeric(18,6)
  cpc numeric(18,6)
  ctr numeric(12,6)
  cpp numeric(18,6)

  raw_data jsonb

  synced_at timestamptz [not null, default: `now()`]

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    ad_account_id
    campaign_id
    ad_set_id
    ad_id
    level
    metric_date
    publisher_platform
    platform_position

    (
      ad_account_id,
      level,
      external_entity_id,
      metric_date,
      breakdown_hash,
      attribution_hash,
      action_report_time
    ) [unique]
  }

  Note: 'Fila base de Ads Insights. Las acciones, valores, ROAS y métricas de vídeo se normalizan aparte.'
}

Table public.meta_insight_action_metrics {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  insight_row_id uuid [not null]

  metric_name varchar(120) [not null]

  action_type varchar(180) [not null, default: 'none']
  attribution_window varchar(80) [not null, default: 'default']

  value numeric(20,6)

  raw_value jsonb

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    insight_row_id
    metric_name
    action_type

    (
      insight_row_id,
      metric_name,
      action_type,
      attribution_window
    ) [unique]
  }

  Note: 'Valores de arrays de Ads Insights: actions, action_values, purchase_roas, costes por acción y métricas de vídeo.'
}

Table public.meta_calculated_metrics_daily {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  insight_row_id uuid [not null]

  metric_code varchar(120) [not null]

  value numeric(20,8)

  formula_code varchar(120) [not null]
  formula_version varchar(50) [not null]

  input_data jsonb

  calculated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    insight_row_id
    metric_code

    (
      insight_row_id,
      metric_code,
      formula_version
    ) [unique]
  }

  Note: 'KPIs calculados por EcomScaling: hook_rate, hold_rate, canonical_roas, cac o creative_fatigue.'
}

Table public.meta_insight_report_runs {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]
  ad_account_id uuid [not null]

  sync_run_id uuid

  external_report_run_id varchar(255) [not null]

  level meta_insight_level [not null]

  status meta_report_status [not null, default: 'pending']
  percent_complete numeric(6,2) [not null, default: 0]

  request_params jsonb [not null]

  error_code varchar(120)
  error_message text

  requested_at timestamptz [not null, default: `now()`]
  started_at timestamptz
  completed_at timestamptz
  downloaded_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    external_report_run_id [unique]
    organization_id
    ad_account_id
    status
  }

  Note: 'Seguimiento de informes asíncronos de Ads Insights.'
}

Table public.meta_business_accounts {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]

  external_business_id varchar(255) [not null]
  name varchar(255) [not null]

  verification_status varchar(80)
  vertical varchar(120)

  is_selected boolean [not null, default: true]
  is_active boolean [not null, default: true]

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (connection_id, external_business_id) [unique]
    organization_id
    connection_id
  }

  Note: 'Business Manager o portfolio empresarial de Meta accesible mediante la autorización.'
}

Table public.meta_pages {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]
  business_account_id uuid

  external_page_id varchar(255) [not null]

  name varchar(255) [not null]
  category varchar(180)

  tasks jsonb
  picture_url text

  is_selected boolean [not null, default: true]
  is_active boolean [not null, default: true]

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (connection_id, external_page_id) [unique]
    organization_id
    business_account_id
  }

  Note: 'Página de Facebook vinculada a una cuenta profesional de Instagram.'
}


Table private.meta_asset_tokens {
  id uuid [pk, default: `gen_random_uuid()`]

  connection_id uuid [not null]

  asset_type varchar(80) [not null]
  external_asset_id varchar(255) [not null]

  access_token_encrypted text [not null]

  scopes jsonb
  token_expires_at timestamptz

  encryption_key_version varchar(50)

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (connection_id, asset_type, external_asset_id) [unique]
    connection_id
    token_expires_at
  }

  Note: 'Tokens específicos de Página, sistema u otros activos Meta. Nunca accesible desde el frontend.'
}



// ============================================================
// KLAVIYO
// Fase 2
// ============================================================

Table public.klaviyo_accounts {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]

  external_account_id varchar(255) [not null]

  account_name varchar(255)

  timezone varchar(100)
  default_currency varchar(3)

  public_api_key varchar(50)

  api_revision varchar(30) [not null, default: '2026-04-15']

  is_active boolean [not null, default: true]

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (connection_id, external_account_id) [unique]
    connection_id [unique]
    organization_id
  }

  Note: 'Cuenta de Klaviyo detectada automáticamente tras completar OAuth.'
}

Table public.klaviyo_lists {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  external_list_id varchar(255) [not null]

  name varchar(255) [not null]

  opt_in_process varchar(80)

  is_active boolean [not null, default: true]

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_list_id) [unique]
    organization_id
    account_id
    name
  }

  Note: 'Listas estáticas de perfiles utilizadas como audiencias o triggers.'
}

Table public.klaviyo_list_daily_snapshots {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  list_id uuid [not null]

  snapshot_date date [not null]

  profile_count bigint [not null, default: 0]

  captured_at timestamptz [not null, default: `now()`]

  indexes {
    (list_id, snapshot_date) [unique]
    organization_id
    snapshot_date
  }

  Note: 'Histórico agregado del tamaño de una lista. No almacena sus miembros.'
}

Table public.klaviyo_segments {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  external_segment_id varchar(255) [not null]

  name varchar(255) [not null]

  is_active boolean
  is_starred boolean [not null, default: false]

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_segment_id) [unique]
    organization_id
    account_id
    name
    is_active
  }

  Note: 'Audiencias dinámicas definidas por condiciones dentro de Klaviyo.'
}

Table public.klaviyo_segment_daily_snapshots {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  segment_id uuid [not null]

  snapshot_date date [not null]

  profile_count bigint [not null, default: 0]

  captured_at timestamptz [not null, default: `now()`]

  indexes {
    (segment_id, snapshot_date) [unique]
    organization_id
    snapshot_date
  }

  Note: 'Histórico agregado del tamaño del segmento.'
}

Table public.klaviyo_flows {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  external_flow_id varchar(255) [not null]

  name varchar(255) [not null]

  status varchar(80)
  trigger_type varchar(180)

  archived boolean [not null, default: false]

  definition_hash varchar(64)

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_flow_id) [unique]
    organization_id
    account_id
    status
    trigger_type
    archived
  }

  Note: 'Automatización de Klaviyo. Sus acciones y mensajes se almacenan en tablas separadas.'
}

Table public.klaviyo_flow_actions {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  flow_id uuid [not null]

  external_action_id varchar(255) [not null]

  action_type varchar(120) [not null]
  status varchar(80)

  position int

  settings_data jsonb

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (flow_id, external_action_id) [unique]
    organization_id
    flow_id
    action_type
    status
  }

  Note: 'Acciones internas del flow: envío de email, SMS, espera, condición, etc.'
}

Table public.klaviyo_flow_messages {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  flow_action_id uuid [not null]

  external_message_id varchar(255) [not null]
  external_template_id varchar(255)

  channel varchar(50) [not null]

  name varchar(255)

  subject varchar(500)
  preview_text text

  from_email varchar(255)
  from_label varchar(255)
  reply_to_email varchar(255)

  status varchar(80)

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (flow_action_id, external_message_id) [unique]
    organization_id
    flow_action_id
    channel
    status
  }

  Note: 'Mensaje asociado a una acción de flow. No almacena perfiles destinatarios.'
}

Table public.klaviyo_campaigns {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  external_campaign_id varchar(255) [not null]

  name varchar(255) [not null]

  status varchar(80)
  archived boolean [not null, default: false]

  primary_channel varchar(50)

  scheduled_at timestamptz
  send_time timestamptz

  send_strategy jsonb
  send_options jsonb
  tracking_options jsonb

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_campaign_id) [unique]
    organization_id
    account_id
    status
    archived
    scheduled_at
  }

  Note: 'Cabecera de la campaña. El contenido y el canal se detallan mediante mensajes.'
}

Table public.klaviyo_campaign_messages {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  campaign_id uuid [not null]

  external_message_id varchar(255) [not null]
  external_template_id varchar(255)

  channel varchar(50) [not null]

  name varchar(255)
  label varchar(255)

  subject varchar(500)
  preview_text text

  from_email varchar(255)
  from_label varchar(255)
  reply_to_email varchar(255)

  status varchar(80)

  scheduled_at timestamptz
  sent_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (campaign_id, external_message_id) [unique]
    organization_id
    campaign_id
    channel
    status
    sent_at
  }

  Note: 'Mensaje de email, SMS, push u otro canal asociado a una campaña.'
}

Table public.klaviyo_campaign_audiences {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  campaign_id uuid [not null]

  audience_type klaviyo_audience_type [not null]
  audience_role klaviyo_audience_role [not null, default: 'included']

  list_id uuid
  segment_id uuid

  external_audience_id varchar(255)

  priority int

  raw_data jsonb

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    campaign_id
    audience_type
    audience_role
    list_id
    segment_id
  }

  Note: 'Relaciona campañas con listas y segmentos incluidos o excluidos. Debe existir list_id o segment_id según audience_type.'
}

Table public.klaviyo_forms {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  external_form_id varchar(255) [not null]

  name varchar(255) [not null]

  status varchar(80)

  has_ab_test boolean [not null, default: false]

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_form_id) [unique]
    organization_id
    account_id
    status
    has_ab_test
  }

  Note: 'Formulario o pop-up de Klaviyo. Su rendimiento se obtiene mediante Reporting API.'
}

Table public.klaviyo_report_runs {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  sync_run_id uuid

  report_type klaviyo_report_type [not null]
  entity_type klaviyo_report_entity_type [not null]

  conversion_metric_id uuid

  statistics jsonb [not null]

  timeframe_start timestamptz [not null]
  timeframe_end timestamptz [not null]

  interval varchar(50)
  channel varchar(50)

  filters jsonb
  request_data jsonb

  api_revision varchar(30) [not null, default: '2026-04-15']

  status klaviyo_report_status [not null, default: 'pending']

  error_code varchar(120)
  error_message text

  requested_at timestamptz [not null, default: `now()`]
  started_at timestamptz
  completed_at timestamptz

  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    account_id
    sync_run_id
    report_type
    entity_type
    status
    requested_at
  }

  Note: 'Auditoría de cada consulta realizada a Reporting API o Metric Aggregates.'
}

Table public.klaviyo_report_values {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  report_run_id uuid [not null]

  entity_type klaviyo_report_entity_type [not null]
  external_entity_id varchar(255) [not null]

  campaign_id uuid
  campaign_message_id uuid

  flow_id uuid
  flow_message_id uuid

  form_id uuid
  segment_id uuid

  statistic_name varchar(180) [not null]

  value_numeric numeric(20,6)
  value_json jsonb

  period_start timestamptz [not null]
  period_end timestamptz [not null]

  interval varchar(50)
  channel varchar(50)

  dimensions jsonb
  dimension_hash varchar(64) [not null, default: 'none']

  raw_data jsonb

  captured_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    report_run_id
    entity_type
    external_entity_id
    statistic_name
    period_start
    period_end
    channel

    (
      report_run_id,
      entity_type,
      external_entity_id,
      statistic_name,
      period_start,
      period_end,
      dimension_hash
    ) [unique]
  }

  Note: 'Valor normalizado de Reporting API. Solo una de las referencias campaign, flow, form o segment debe aplicar según entity_type.'
}

Table public.klaviyo_metrics {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  external_metric_id varchar(255) [not null]

  name varchar(255) [not null]

  external_integration_id varchar(255)
  integration_name varchar(180)
  integration_category varchar(120)

  is_conversion_candidate boolean [not null, default: false]
  is_primary_conversion_metric boolean [not null, default: false]

  external_created_at timestamptz
  external_updated_at timestamptz

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_metric_id) [unique]
    organization_id
    account_id
    name
    integration_name
    is_primary_conversion_metric
  }

  Note: 'Definiciones de métricas de Klaviyo. Una se seleccionará como métrica oficial de conversión/revenue.'
}


Table public.klaviyo_daily_account_metrics {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  conversion_metric_id uuid

  metric_date date [not null]

  channel varchar(50) [not null, default: 'email']

  flow_attributed_revenue numeric(16,2) [not null, default: 0]
  campaign_attributed_revenue numeric(16,2) [not null, default: 0]
  total_attributed_revenue numeric(16,2) [not null, default: 0]

  total_store_revenue numeric(16,2)

  attributed_revenue_percentage numeric(10,6)

  recipients bigint [not null, default: 0]
  delivered bigint [not null, default: 0]
  opens bigint [not null, default: 0]
  clicks bigint [not null, default: 0]
  conversions numeric(16,4) [not null, default: 0]

  calculation_version varchar(50) [not null]

  calculated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    account_id
    metric_date
    channel
    conversion_metric_id

    (
      account_id,
      metric_date,
      channel,
      conversion_metric_id
    ) [unique]
  }

  Note: 'Tabla derivada por EcomScaling IA a partir de Reporting API y revenue de Shopify.'
}


// ============================================================
// PLANIFICACIÓN DE CAMPAÑAS
// Fase 2
// ============================================================

Table public.marketing_campaigns {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  klaviyo_campaign_id uuid
  name varchar(255) [not null]
  channel campaign_channel [not null, default: 'email']
  campaign_month date
  reason varchar(255)
  offer_description text
  planned_send_at timestamptz
  actual_send_at timestamptz
  status campaign_status [not null, default: 'draft']
  expected_revenue numeric(14,2)
  actual_revenue numeric(14,2)
  internal_notes text
  created_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    campaign_month
    status
  }
}

Table public.marketing_campaign_products {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  campaign_id uuid [not null]
  product_id uuid [not null]
  variant_id uuid
  expected_units int
  required_stock int
  created_at timestamptz [not null, default: `now()`]

  indexes {
    campaign_id
    product_id
  }
}


// ============================================================
// ALERTAS Y TAREAS
// ============================================================

Table public.alert_rule_templates {
  id uuid [pk, default: `gen_random_uuid()`]
  code varchar(120) [not null, unique]
  name varchar(255) [not null]
  description text
  metric_code varchar(120)
  default_severity alert_severity [not null]
  default_lookback_days int
  default_condition jsonb [not null]
  alert_title_template text [not null]
  alert_message_template text [not null]
  task_title_template text
  task_description_template text
  is_active boolean [not null, default: true]
  phase int [not null, default: 1]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Note: 'Reglas globales: ROAS bajo, stock cero, sin campaña, flow sin envíos, etc.'
}

Table public.organization_alert_rules {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  template_id uuid [not null]
  is_enabled boolean [not null, default: true]
  severity_override alert_severity
  condition_override jsonb
  configured_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (organization_id, template_id) [unique]
    organization_id
  }
}

Table public.alerts {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  rule_template_id uuid
  organization_rule_id uuid
  source_entity_type varchar(100)
  source_entity_id uuid
  status alert_status [not null, default: 'open']
  severity alert_severity [not null]
  title varchar(255) [not null]
  message text [not null]
  metric_code varchar(120)
  metric_value numeric(16,4)
  threshold_value numeric(16,4)
  context_data jsonb
  fingerprint varchar(255)
  first_detected_at timestamptz [not null, default: `now()`]
  last_detected_at timestamptz [not null, default: `now()`]
  acknowledged_by uuid
  acknowledged_at timestamptz
  resolved_by uuid
  resolved_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    status
    severity
    fingerprint
    (organization_id, status, severity)
  }
}

Table public.tasks {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  alert_id uuid
  assigned_to uuid
  created_by uuid
  source task_source [not null]
  status task_status [not null, default: 'pending']
  priority task_priority [not null, default: 'medium']
  title varchar(255) [not null]
  description text
  due_at timestamptz
  started_at timestamptz
  completed_at timestamptz
  ignored_at timestamptz
  ignored_reason text
  is_visible_to_client boolean [not null, default: true]
  metadata jsonb
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    assigned_to
    status
    priority
    due_at
    (organization_id, status, priority)
  }
}

Table public.task_status_history {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  task_id uuid [not null]
  previous_status task_status
  new_status task_status [not null]
  changed_by uuid
  reason text
  changed_at timestamptz [not null, default: `now()`]

  indexes {
    task_id
    organization_id
  }
}

Table public.task_comments {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  task_id uuid [not null]
  author_user_id uuid [not null]
  body text [not null]
  is_internal boolean [not null, default: false]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    task_id
    organization_id
  }
}


// ============================================================
// PLAN ESTRATÉGICO: MI CAMINO
// ============================================================

Table public.strategic_plans {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  name varchar(255) [not null]
  description text
  status plan_status [not null, default: 'draft']
  version int [not null, default: 1]
  starts_on date
  completed_on date
  created_by uuid [not null]
  approved_by uuid
  approved_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    status
  }
}

Table public.strategic_plan_phases {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  plan_id uuid [not null]
  name varchar(255) [not null]
  description text
  position int [not null]
  status plan_phase_status [not null, default: 'locked']
  activated_at timestamptz
  completed_at timestamptz
  activated_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (plan_id, position) [unique]
    organization_id
  }
}

Table public.strategic_plan_milestones {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  phase_id uuid [not null]
  name varchar(255) [not null]
  description text
  position int [not null]
  status milestone_status [not null, default: 'locked']
  target_date date
  activated_at timestamptz
  completed_at timestamptz
  completed_by uuid
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (phase_id, position) [unique]
    organization_id
  }
}

Table public.milestone_task_links {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  milestone_id uuid [not null]
  task_id uuid [not null]
  created_at timestamptz [not null, default: `now()`]

  indexes {
    (milestone_id, task_id) [unique]
    organization_id
  }
}

Table public.milestone_internal_notes {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  milestone_id uuid [not null]
  author_user_id uuid [not null]
  body text [not null]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    milestone_id
    organization_id
  }

  Note: 'Solo visibles para consultores y administradores.'
}


// ============================================================
// LLAMADAS, TRANSCRIPCIONES Y RESÚMENES
// ============================================================

Table public.consulting_calls {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  consultant_user_id uuid [not null]
  title varchar(255) [not null]
  scheduled_at timestamptz
  started_at timestamptz
  ended_at timestamptz
  loom_url text
  fathom_external_id varchar(255)
  recording_url text
  status call_status [not null, default: 'draft']
  is_visible_to_client boolean [not null, default: false]
  published_at timestamptz
  created_by uuid [not null]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    consultant_user_id
    scheduled_at
    status
  }
}

Table public.call_transcripts {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  call_id uuid [not null]

  version int [not null, default: 1]
  is_current boolean [not null, default: true]

  source varchar(80) [not null]
  language_code varchar(10)

  transcript_text text [not null]
  transcript_segments jsonb

  word_count int

  created_by uuid

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    call_id
    is_current

    (call_id, version) [unique]
  }

  Note: 'Versiones de la transcripción de una llamada. Solo una debe permanecer como versión actual.'
}

Table public.call_ai_summaries {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  call_id uuid [not null]
  transcript_id uuid [not null]

  version int [not null, default: 1]

  review_status ai_review_status [not null, default: 'pending']

  topics_summary text [not null]
  decisions_summary text

  raw_ai_output jsonb

  model_provider varchar(80)
  model_name varchar(120)
  prompt_version varchar(80)

  generated_at timestamptz [not null, default: `now()`]

  reviewed_by uuid
  reviewed_at timestamptz
  published_at timestamptz

  indexes {
    organization_id
    call_id
    transcript_id

    (call_id, version) [unique]
  }
}

Table public.call_task_links {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  call_id uuid [not null]
  task_id uuid [not null]
  extracted_by_ai boolean [not null, default: true]
  approved_by uuid
  approved_at timestamptz
  created_at timestamptz [not null, default: `now()`]

  indexes {
    (call_id, task_id) [unique]
    organization_id
  }
}


// ============================================================
// INSTAGRAM Y ANÁLISIS DE CONTENIDO
// Fase 3
// ============================================================

Table public.instagram_accounts {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  connection_id uuid [not null]

  page_id uuid

  external_account_id varchar(255) [not null]

  username varchar(255) [not null]
  name varchar(255)

  biography text
  website_url text
  profile_picture_url text

  account_type varchar(80)

  current_followers_count bigint
  current_follows_count bigint
  current_media_count bigint

  is_selected boolean [not null, default: true]
  is_active boolean [not null, default: true]

  raw_data jsonb

  last_synced_at timestamptz

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (connection_id, external_account_id) [unique]
    organization_id
    page_id
    username
  }

  Note: 'Cuenta profesional de Instagram Business o Creator.'
}

Table public.instagram_account_snapshots {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  snapshot_date date [not null]

  followers_count bigint
  follows_count bigint
  media_count bigint

  captured_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, snapshot_date) [unique]
    organization_id
    snapshot_date
  }

  Note: 'Fotografía diaria del tamaño de la cuenta para calcular crecimiento.'
}

Table public.instagram_account_insight_values {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  metric_name varchar(180) [not null]
  metric_period varchar(80) [not null]

  period_start timestamptz [not null]
  period_end timestamptz [not null]

  value_numeric numeric(20,6)
  value_json jsonb

  breakdown jsonb
  breakdown_hash varchar(64) [not null, default: 'none']

  origin metric_origin [not null, default: 'api']

  captured_at timestamptz [not null, default: `now()`]

  raw_data jsonb

  indexes {
    organization_id
    account_id
    metric_name
    period_start
    period_end

    (
      account_id,
      metric_name,
      metric_period,
      period_start,
      period_end,
      breakdown_hash
    ) [unique]
  }

  Note: 'Insights de la cuenta profesional almacenados sin depender de columnas rígidas.'
}

Table public.instagram_media {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]

  parent_media_id uuid

  external_media_id varchar(255) [not null]

  shortcode varchar(100)

  media_type varchar(80)
  media_product_type varchar(80)

  caption text

  permalink text
  media_url text
  thumbnail_url text

  username_snapshot varchar(255)

  current_like_count bigint
  current_comments_count bigint

  is_carousel_child boolean [not null, default: false]
  is_deleted boolean [not null, default: false]

  external_published_at timestamptz

  media_url_refreshed_at timestamptz
  last_synced_at timestamptz

  raw_data jsonb

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (account_id, external_media_id) [unique]
    organization_id
    account_id
    parent_media_id
    media_type
    media_product_type
    external_published_at
  }

  Note: 'Posts, reels, stories y elementos hijos de carruseles.'
}

Table public.instagram_follower_winners {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  account_id uuid [not null]
  media_id uuid [not null]

  reporting_month date [not null]

  rank_position int [not null]

  estimated_followers_gained int

  source metric_origin [not null, default: 'manual']

  notes text

  submitted_by uuid [not null]

  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (
      account_id,
      reporting_month,
      rank_position
    ) [unique]

    organization_id
    account_id
    media_id
  }

  Note: 'Ranking manual mensual porque Instagram no atribuye de forma general los seguidores ganados a cada publicación.'
}

Table public.instagram_media_insight_values {
  id uuid [pk, default: `gen_random_uuid()`]

  organization_id uuid [not null]
  media_id uuid [not null]

  metric_name varchar(180) [not null]
  metric_period varchar(80) [not null, default: 'lifetime']

  period_start timestamptz
  period_end timestamptz

  value_numeric numeric(20,6)
  value_json jsonb

  breakdown jsonb
  breakdown_hash varchar(64) [not null, default: 'none']

  origin metric_origin [not null, default: 'api']

  captured_at timestamptz [not null, default: `now()`]

  raw_data jsonb

  indexes {
    organization_id
    media_id
    metric_name
    captured_at

    (
      media_id,
      metric_name,
      metric_period,
      breakdown_hash,
      captured_at
    ) [unique]
  }

  Note: 'Snapshots de Insights de cada publicación. Las métricas disponibles dependen del tipo de medio.'
}

// ============================================================
// CONSULTOR IA Y BASE DE CONOCIMIENTO
// Fase 3
// ============================================================

Table public.knowledge_documents {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid
  title varchar(255) [not null]
  document_type varchar(100)
  storage_path text
  mime_type varchar(120)
  status knowledge_document_status [not null, default: 'draft']
  is_global boolean [not null, default: true]
  version int [not null, default: 1]
  checksum varchar(255)
  metadata jsonb
  uploaded_by uuid [not null]
  processed_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    status
    is_global
  }

  Note: 'Documentos globales de metodología o documentos específicos de un cliente.'
}

Table public.knowledge_chunks {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid
  document_id uuid [not null]
  chunk_index int [not null]
  content text [not null]
  token_count int
  embedding vector(1536)
  metadata jsonb
  created_at timestamptz [not null, default: `now()`]

  indexes {
    (document_id, chunk_index) [unique]
    organization_id
  }

  Note: 'La dimensión del vector se ajustará al proveedor de embeddings elegido.'
}

Table public.ai_conversations {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  user_id uuid [not null]
  title varchar(255)
  status conversation_status [not null, default: 'active']
  context_snapshot jsonb
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    user_id
    status
  }
}

Table public.ai_messages {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  conversation_id uuid [not null]
  role message_role [not null]
  content text [not null]
  source_citations jsonb
  model_name varchar(120)
  input_tokens int
  output_tokens int
  latency_ms int
  created_at timestamptz [not null, default: `now()`]

  indexes {
    conversation_id
    organization_id
    created_at
  }
}


// ============================================================
// NOTIFICACIONES Y AUDITORÍA
// ============================================================

Table public.notifications {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid
  user_id uuid [not null]
  status notification_status [not null, default: 'unread']
  type varchar(120) [not null]
  title varchar(255) [not null]
  message text
  action_url text
  entity_type varchar(100)
  entity_id uuid
  read_at timestamptz
  archived_at timestamptz
  created_at timestamptz [not null, default: `now()`]

  indexes {
    user_id
    organization_id
    status
    created_at
  }
}

Table public.audit_logs {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid
  actor_user_id uuid
  action varchar(160) [not null]
  entity_type varchar(100)
  entity_id uuid
  old_data jsonb
  new_data jsonb
  request_id varchar(255)
  ip_address varchar(64)
  user_agent text
  created_at timestamptz [not null, default: `now()`]

  indexes {
    organization_id
    actor_user_id
    entity_type
    entity_id
    created_at
  }
}


// ============================================================
// RELACIONES
// ============================================================

// Auth y núcleo
Ref: public.profiles.id - auth.users.id
Ref: public.organizations.created_by > public.profiles.id
Ref: public.organization_members.organization_id > public.organizations.id
Ref: public.organization_members.user_id > public.profiles.id
Ref: public.organization_members.invited_by > public.profiles.id
Ref: public.consultant_assignments.organization_id > public.organizations.id
Ref: public.consultant_assignments.consultant_user_id > public.profiles.id
Ref: public.consultant_assignments.assigned_by > public.profiles.id
Ref: public.service_subscriptions.organization_id > public.organizations.id

// Configuración financiera
Ref: public.organization_financial_settings.organization_id - public.organizations.id
Ref: public.organization_financial_settings.configured_by > public.profiles.id
Ref: public.fixed_expenses.organization_id > public.organizations.id
Ref: public.fixed_expenses.created_by > public.profiles.id
Ref: public.shipping_cost_rules.organization_id > public.organizations.id
Ref: public.organization_metric_targets.organization_id > public.organizations.id
Ref: public.organization_metric_targets.configured_by > public.profiles.id

// Integraciones
Ref: public.integration_connections.organization_id > public.organizations.id
Ref: public.integration_connections.connected_by > public.profiles.id
Ref: private.integration_credentials.connection_id - public.integration_connections.id
Ref: public.integration_sync_runs.organization_id > public.organizations.id
Ref: public.integration_sync_runs.connection_id > public.integration_connections.id
Ref: private.webhook_events.organization_id > public.organizations.id
Ref: private.webhook_events.connection_id > public.integration_connections.id

// ============================================================
// SHOPIFY
// ============================================================

Ref: public.shopify_stores.organization_id > public.organizations.id
Ref: public.shopify_stores.connection_id - public.integration_connections.id

Ref: public.shopify_products.organization_id > public.organizations.id
Ref: public.shopify_products.store_id > public.shopify_stores.id

Ref: public.shopify_variants.organization_id > public.organizations.id
Ref: public.shopify_variants.product_id > public.shopify_products.id

Ref: public.shopify_inventory_items.organization_id > public.organizations.id
Ref: public.shopify_inventory_items.variant_id - public.shopify_variants.id

Ref: public.shopify_locations.organization_id > public.organizations.id
Ref: public.shopify_locations.store_id > public.shopify_stores.id

Ref: public.shopify_inventory_level_snapshots.organization_id > public.organizations.id
Ref: public.shopify_inventory_level_snapshots.inventory_item_id > public.shopify_inventory_items.id
Ref: public.shopify_inventory_level_snapshots.location_id > public.shopify_locations.id

Ref: public.product_costs.organization_id > public.organizations.id
Ref: public.product_costs.inventory_item_id > public.shopify_inventory_items.id
Ref: public.product_costs.created_by > public.profiles.id

Ref: public.shopify_order_facts.organization_id > public.organizations.id
Ref: public.shopify_order_facts.store_id > public.shopify_stores.id

Ref: public.shopify_order_items.organization_id > public.organizations.id
Ref: public.shopify_order_items.order_id > public.shopify_order_facts.id
Ref: public.shopify_order_items.product_id > public.shopify_products.id
Ref: public.shopify_order_items.variant_id > public.shopify_variants.id

Ref: public.shopify_refunds.organization_id > public.organizations.id
Ref: public.shopify_refunds.order_id > public.shopify_order_facts.id

Ref: public.shopify_refund_items.organization_id > public.organizations.id
Ref: public.shopify_refund_items.refund_id > public.shopify_refunds.id
Ref: public.shopify_refund_items.order_item_id > public.shopify_order_items.id
Ref: public.shopify_refund_items.location_id > public.shopify_locations.id

Ref: public.shopify_daily_store_metrics.organization_id > public.organizations.id
Ref: public.shopify_daily_store_metrics.store_id > public.shopify_stores.id

Ref: public.shopify_daily_product_metrics.organization_id > public.organizations.id
Ref: public.shopify_daily_product_metrics.product_id > public.shopify_products.id
Ref: public.shopify_daily_product_metrics.variant_id > public.shopify_variants.id

Ref: public.shopify_daily_product_traffic_metrics.organization_id > public.organizations.id
Ref: public.shopify_daily_product_traffic_metrics.store_id > public.shopify_stores.id
Ref: public.shopify_daily_product_traffic_metrics.product_id > public.shopify_products.id

// Proveedores y stock
Ref: public.suppliers.organization_id > public.organizations.id
Ref: public.suppliers.created_by > public.profiles.id
Ref: public.product_supply_settings.organization_id > public.organizations.id
Ref: public.product_supply_settings.variant_id > public.shopify_variants.id
Ref: public.product_supply_settings.supplier_id > public.suppliers.id
Ref: public.product_supply_settings.created_by > public.profiles.id
Ref: public.stock_forecasts.organization_id > public.organizations.id
Ref: public.stock_forecasts.variant_id > public.shopify_variants.id

// ============================================================
// KLAVIYO
// ============================================================

Ref: public.klaviyo_accounts.organization_id > public.organizations.id
Ref: public.klaviyo_accounts.connection_id - public.integration_connections.id


// Listas y segmentos

Ref: public.klaviyo_lists.organization_id > public.organizations.id
Ref: public.klaviyo_lists.account_id > public.klaviyo_accounts.id

Ref: public.klaviyo_list_daily_snapshots.organization_id > public.organizations.id
Ref: public.klaviyo_list_daily_snapshots.list_id > public.klaviyo_lists.id

Ref: public.klaviyo_segments.organization_id > public.organizations.id
Ref: public.klaviyo_segments.account_id > public.klaviyo_accounts.id

Ref: public.klaviyo_segment_daily_snapshots.organization_id > public.organizations.id
Ref: public.klaviyo_segment_daily_snapshots.segment_id > public.klaviyo_segments.id


// Flows

Ref: public.klaviyo_flows.organization_id > public.organizations.id
Ref: public.klaviyo_flows.account_id > public.klaviyo_accounts.id

Ref: public.klaviyo_flow_actions.organization_id > public.organizations.id
Ref: public.klaviyo_flow_actions.flow_id > public.klaviyo_flows.id

Ref: public.klaviyo_flow_messages.organization_id > public.organizations.id
Ref: public.klaviyo_flow_messages.flow_action_id > public.klaviyo_flow_actions.id


// Campañas

Ref: public.klaviyo_campaigns.organization_id > public.organizations.id
Ref: public.klaviyo_campaigns.account_id > public.klaviyo_accounts.id

Ref: public.klaviyo_campaign_messages.organization_id > public.organizations.id
Ref: public.klaviyo_campaign_messages.campaign_id > public.klaviyo_campaigns.id

Ref: public.klaviyo_campaign_audiences.organization_id > public.organizations.id
Ref: public.klaviyo_campaign_audiences.campaign_id > public.klaviyo_campaigns.id
Ref: public.klaviyo_campaign_audiences.list_id > public.klaviyo_lists.id
Ref: public.klaviyo_campaign_audiences.segment_id > public.klaviyo_segments.id


// Formularios

Ref: public.klaviyo_forms.organization_id > public.organizations.id
Ref: public.klaviyo_forms.account_id > public.klaviyo_accounts.id


// Métricas

Ref: public.klaviyo_metrics.organization_id > public.organizations.id
Ref: public.klaviyo_metrics.account_id > public.klaviyo_accounts.id


// Reporting

Ref: public.klaviyo_report_runs.organization_id > public.organizations.id
Ref: public.klaviyo_report_runs.account_id > public.klaviyo_accounts.id
Ref: public.klaviyo_report_runs.sync_run_id > public.integration_sync_runs.id
Ref: public.klaviyo_report_runs.conversion_metric_id > public.klaviyo_metrics.id

Ref: public.klaviyo_report_values.organization_id > public.organizations.id
Ref: public.klaviyo_report_values.report_run_id > public.klaviyo_report_runs.id

Ref: public.klaviyo_report_values.campaign_id > public.klaviyo_campaigns.id
Ref: public.klaviyo_report_values.campaign_message_id > public.klaviyo_campaign_messages.id

Ref: public.klaviyo_report_values.flow_id > public.klaviyo_flows.id
Ref: public.klaviyo_report_values.flow_message_id > public.klaviyo_flow_messages.id

Ref: public.klaviyo_report_values.form_id > public.klaviyo_forms.id
Ref: public.klaviyo_report_values.segment_id > public.klaviyo_segments.id


// Resumen calculado

Ref: public.klaviyo_daily_account_metrics.organization_id > public.organizations.id
Ref: public.klaviyo_daily_account_metrics.account_id > public.klaviyo_accounts.id
Ref: public.klaviyo_daily_account_metrics.conversion_metric_id > public.klaviyo_metrics.id

// Campañas
Ref: public.marketing_campaigns.organization_id > public.organizations.id
Ref: public.marketing_campaigns.klaviyo_campaign_id > public.klaviyo_campaigns.id
Ref: public.marketing_campaigns.created_by > public.profiles.id
Ref: public.marketing_campaign_products.organization_id > public.organizations.id
Ref: public.marketing_campaign_products.campaign_id > public.marketing_campaigns.id
Ref: public.marketing_campaign_products.product_id > public.shopify_products.id
Ref: public.marketing_campaign_products.variant_id > public.shopify_variants.id

// Alertas y tareas
Ref: public.organization_alert_rules.organization_id > public.organizations.id
Ref: public.organization_alert_rules.template_id > public.alert_rule_templates.id
Ref: public.organization_alert_rules.configured_by > public.profiles.id
Ref: public.alerts.organization_id > public.organizations.id
Ref: public.alerts.rule_template_id > public.alert_rule_templates.id
Ref: public.alerts.organization_rule_id > public.organization_alert_rules.id
Ref: public.alerts.acknowledged_by > public.profiles.id
Ref: public.alerts.resolved_by > public.profiles.id
Ref: public.tasks.organization_id > public.organizations.id
Ref: public.tasks.alert_id > public.alerts.id
Ref: public.tasks.assigned_to > public.profiles.id
Ref: public.tasks.created_by > public.profiles.id
Ref: public.task_status_history.organization_id > public.organizations.id
Ref: public.task_status_history.task_id > public.tasks.id
Ref: public.task_status_history.changed_by > public.profiles.id
Ref: public.task_comments.organization_id > public.organizations.id
Ref: public.task_comments.task_id > public.tasks.id
Ref: public.task_comments.author_user_id > public.profiles.id

// Plan estratégico
Ref: public.strategic_plans.organization_id > public.organizations.id
Ref: public.strategic_plans.created_by > public.profiles.id
Ref: public.strategic_plans.approved_by > public.profiles.id
Ref: public.strategic_plan_phases.organization_id > public.organizations.id
Ref: public.strategic_plan_phases.plan_id > public.strategic_plans.id
Ref: public.strategic_plan_phases.activated_by > public.profiles.id
Ref: public.strategic_plan_milestones.organization_id > public.organizations.id
Ref: public.strategic_plan_milestones.phase_id > public.strategic_plan_phases.id
Ref: public.strategic_plan_milestones.completed_by > public.profiles.id
Ref: public.milestone_task_links.organization_id > public.organizations.id
Ref: public.milestone_task_links.milestone_id > public.strategic_plan_milestones.id
Ref: public.milestone_task_links.task_id > public.tasks.id
Ref: public.milestone_internal_notes.organization_id > public.organizations.id
Ref: public.milestone_internal_notes.milestone_id > public.strategic_plan_milestones.id
Ref: public.milestone_internal_notes.author_user_id > public.profiles.id

// Llamadas
Ref: public.consulting_calls.organization_id > public.organizations.id
Ref: public.consulting_calls.consultant_user_id > public.profiles.id
Ref: public.consulting_calls.created_by > public.profiles.id
Ref: public.call_transcripts.organization_id > public.organizations.id
Ref: public.call_transcripts.call_id - public.consulting_calls.id
Ref: public.call_transcripts.created_by > public.profiles.id
Ref: public.call_ai_summaries.organization_id > public.organizations.id
Ref: public.call_ai_summaries.call_id > public.consulting_calls.id
Ref: public.call_ai_summaries.transcript_id > public.call_transcripts.id
Ref: public.call_ai_summaries.reviewed_by > public.profiles.id
Ref: public.call_task_links.organization_id > public.organizations.id
Ref: public.call_task_links.call_id > public.consulting_calls.id
Ref: public.call_task_links.task_id > public.tasks.id
Ref: public.call_task_links.approved_by > public.profiles.id

// ============================================================
// META AUTHORIZATION AND ASSETS
// ============================================================

Ref: public.meta_business_accounts.organization_id > public.organizations.id
Ref: public.meta_business_accounts.connection_id > public.integration_connections.id

Ref: public.meta_pages.organization_id > public.organizations.id
Ref: public.meta_pages.connection_id > public.integration_connections.id
Ref: public.meta_pages.business_account_id > public.meta_business_accounts.id

Ref: private.meta_asset_tokens.connection_id > public.integration_connections.id


// ============================================================
// META ADS
// ============================================================

Ref: public.meta_ad_accounts.organization_id > public.organizations.id
Ref: public.meta_ad_accounts.connection_id > public.integration_connections.id
Ref: public.meta_ad_accounts.business_account_id > public.meta_business_accounts.id

Ref: public.meta_campaigns.organization_id > public.organizations.id
Ref: public.meta_campaigns.ad_account_id > public.meta_ad_accounts.id

Ref: public.meta_ad_sets.organization_id > public.organizations.id
Ref: public.meta_ad_sets.campaign_id > public.meta_campaigns.id

Ref: public.meta_creatives.organization_id > public.organizations.id
Ref: public.meta_creatives.ad_account_id > public.meta_ad_accounts.id

Ref: public.meta_creative_assets.organization_id > public.organizations.id
Ref: public.meta_creative_assets.creative_id > public.meta_creatives.id

Ref: public.meta_ads.organization_id > public.organizations.id
Ref: public.meta_ads.ad_set_id > public.meta_ad_sets.id
Ref: public.meta_ads.current_creative_id > public.meta_creatives.id

Ref: public.meta_ad_creative_assignments.organization_id > public.organizations.id
Ref: public.meta_ad_creative_assignments.ad_id > public.meta_ads.id
Ref: public.meta_ad_creative_assignments.creative_id > public.meta_creatives.id

Ref: public.meta_insight_rows_daily.organization_id > public.organizations.id
Ref: public.meta_insight_rows_daily.ad_account_id > public.meta_ad_accounts.id
Ref: public.meta_insight_rows_daily.campaign_id > public.meta_campaigns.id
Ref: public.meta_insight_rows_daily.ad_set_id > public.meta_ad_sets.id
Ref: public.meta_insight_rows_daily.ad_id > public.meta_ads.id

Ref: public.meta_insight_action_metrics.organization_id > public.organizations.id
Ref: public.meta_insight_action_metrics.insight_row_id > public.meta_insight_rows_daily.id

Ref: public.meta_calculated_metrics_daily.organization_id > public.organizations.id
Ref: public.meta_calculated_metrics_daily.insight_row_id > public.meta_insight_rows_daily.id

Ref: public.meta_insight_report_runs.organization_id > public.organizations.id
Ref: public.meta_insight_report_runs.connection_id > public.integration_connections.id
Ref: public.meta_insight_report_runs.ad_account_id > public.meta_ad_accounts.id
Ref: public.meta_insight_report_runs.sync_run_id > public.integration_sync_runs.id


// ============================================================
// INSTAGRAM
// ============================================================

Ref: public.instagram_accounts.organization_id > public.organizations.id
Ref: public.instagram_accounts.connection_id > public.integration_connections.id
Ref: public.instagram_accounts.page_id > public.meta_pages.id

Ref: public.instagram_account_snapshots.organization_id > public.organizations.id
Ref: public.instagram_account_snapshots.account_id > public.instagram_accounts.id

Ref: public.instagram_account_insight_values.organization_id > public.organizations.id
Ref: public.instagram_account_insight_values.account_id > public.instagram_accounts.id

Ref: public.instagram_media.organization_id > public.organizations.id
Ref: public.instagram_media.account_id > public.instagram_accounts.id
Ref: public.instagram_media.parent_media_id > public.instagram_media.id

Ref: public.instagram_media_insight_values.organization_id > public.organizations.id
Ref: public.instagram_media_insight_values.media_id > public.instagram_media.id

Ref: public.instagram_follower_winners.organization_id > public.organizations.id
Ref: public.instagram_follower_winners.account_id > public.instagram_accounts.id
Ref: public.instagram_follower_winners.media_id > public.instagram_media.id
Ref: public.instagram_follower_winners.submitted_by > public.profiles.id

// IA y conocimiento
Ref: public.knowledge_documents.organization_id > public.organizations.id
Ref: public.knowledge_documents.uploaded_by > public.profiles.id
Ref: public.knowledge_chunks.organization_id > public.organizations.id
Ref: public.knowledge_chunks.document_id > public.knowledge_documents.id
Ref: public.ai_conversations.organization_id > public.organizations.id
Ref: public.ai_conversations.user_id > public.profiles.id
Ref: public.ai_messages.organization_id > public.organizations.id
Ref: public.ai_messages.conversation_id > public.ai_conversations.id

// Notificaciones y auditoría
Ref: public.notifications.organization_id > public.organizations.id
Ref: public.notifications.user_id > public.profiles.id
Ref: public.audit_logs.organization_id > public.organizations.id
Ref: public.audit_logs.actor_user_id > public.profiles.id


```

---

# ANEXO B — Resumen para Codex

```text
Producto:
EcomScaling IA, plataforma multi-tenant para consultoría eCommerce.

Base:
Supabase/PostgreSQL.

Aislamiento:
organization_id + RLS + constraints cross-tenant.

Integraciones:
Shopify, Meta, Klaviyo; Loom/Fathom por fases.
GoHighLevel pendiente de auditoría y mapeo.

Datos sensibles:
schema private, backend exclusivo.

Agentes:
contexto profundo y adaptativo;
SQL analítico dinámico de lectura controlada;
escrituras mediante RPC/tools;
auditoría completa.

Planes:
Growth y Scale dan actualmente las mismas capacidades de IA.

Construcción:
vertical slices y migraciones por fases;
nunca todo el esquema de una sola vez.

Regla principal:
no inventar columnas, relaciones ni reglas comerciales.
```
