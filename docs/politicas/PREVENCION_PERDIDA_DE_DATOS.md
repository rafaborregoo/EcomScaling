# Estrategia de prevención de pérdida de datos (DLP)

- **Última revisión:** 2026-09-10
- **Cubre:** requisito de Nivel 2 de Shopify "estrategia de prevención de pérdida
  de datos".

DLP aquí significa dos cosas distintas que conviene no mezclar: que los datos no
**salgan** por donde no deben, y que no se **pierdan**.

## 1. Que no salgan: menos datos, menos superficie

La medida más eficaz es no tener el dato. Por eso:

- `shopify_customers` guarda `customer_reference_hash`, contadores y estados de
  marketing. **No** nombre, email ni teléfono.
- Pedidos y checkouts no almacenan email ni dirección de envío.
- La ubicación aproximada del cliente se retiró del esquema por no usarse
  ([migración](../../supabase/migrations/20260910120000_shopify_customers_drop_location.sql)).

## 2. Salidas controladas

Los puntos por los que un dato puede abandonar el sistema, y qué los limita:

| Salida | Control |
|---|---|
| API a la web | RLS por organización + comprobación de pertenencia en cada escritura con service role |
| Agentes de IA | SQL Gateway de solo lectura: allowlist de tablas, validación AST y vistas del esquema `ai` filtradas por organización ([sql-gateway.ts](../../apps/api/src/sql-gateway.ts)) |
| Proveedores de LLM | Ver más abajo |
| Export de organización | Solo `platform_admin`; excluye credenciales; queda registrado dos veces en `audit_logs` |
| Logs de aplicación | Redacción de secretos antes de emitir |

### Datos hacia proveedores de IA

Es la salida que más fácilmente se pasa por alto. Los agentes reciben **métricas
agregadas**, no listados de clientes: recurrencia, valor medio, cohortes. El
`customer_reference_hash` no se envía en los prompts. Lo que sí sale son cifras
de negocio del merchant, y eso el merchant tiene que saberlo — está en la
política de privacidad y en el acuerdo de tratamiento.

Ver también [AI_SECURITY.md](../ai/AI_SECURITY.md).

## 3. Que no se pierdan

- **Cifrado en tránsito** (TLS en API, web y Supabase) y **en reposo** (Supabase).
  Las credenciales de integración se cifran además a nivel de aplicación antes de
  guardarse, en el esquema `private`.
- **Copias de seguridad** gestionadas por Supabase, cifradas.
- **Borrado reversible**: desconectar una tienda o dar de baja una organización no
  borra al instante; deja 30 días de gracia
  ([ADR-0022](../decisions/ADR-0022-retencion-datos-shopify.md)). Un borrado
  accidental se puede deshacer.
- **Migraciones idempotentes** como norma del repositorio: se pueden reaplicar sin
  daño, que es como se recupera una deriva de esquema.

## 4. Detección

- Registro de accesos a datos de cliente (`protected_data.*` en `audit_logs`).
- `agent_query_runs` con el SQL completo de cada consulta de agente.
- Advisors de seguridad de Supabase, revisados trimestralmente.

## Lo que falta

- **Separar desarrollo de producción.** Hoy el desarrollo local usa el mismo
  proyecto de Supabase que producción. Es la mayor exposición de esta lista y
  Shopify lo prohíbe explícitamente en Nivel 2.
- **Prueba de restauración de copias**: nunca se ha hecho.
- **Alerta automática** ante un pico de accesos a datos protegidos: hoy el
  registro existe pero solo se mira si alguien lo mira.
