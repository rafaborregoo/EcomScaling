# ADR-0022: Retención de los datos de Shopify

- **Fecha:** 2026-09-10
- **Estado:** Aprobada.
- **Relacionada:** [`ADR-0016-retencion-transcripciones-llamadas.md`](ADR-0016-retencion-transcripciones-llamadas.md),
  [`ADR-0018-retencion-audit-logs.md`](ADR-0018-retencion-audit-logs.md),
  [`SHOPIFY_DATOS_PROTEGIDOS.md`](../SHOPIFY_DATOS_PROTEGIDOS.md).

## Contexto

Shopify exige, ya en el Nivel 1 de datos protegidos, aplicar periodos de retención
a los datos del merchant y de sus clientes. Teníamos retención escrita para
webhooks, transcripciones de llamadas y audit logs, y un borrado real por baja de
tienda o de organización — pero **nada de eso estaba declarado para los datos de
Shopify**. El requisito no pide inventar una ventana: pide poder decir cuál es y
demostrar que se aplica.

El punto que obliga a pensar es que aquí una ventana corta rompería el producto.
`shopify_customer_value` calcula el valor de vida sobre **todo** el historial del
cliente y `shopify_cohorts` mira 12 meses atrás: purgar pedidos a los 12 meses
dejaría esas dos cifras mudas o, peor, mintiendo con datos truncados.

## Decisión

1. **Mientras la tienda está conectada**, los datos sincronizados de Shopify se
   conservan sin purga temporal. Son la materia prima del servicio contratado y
   su antigüedad es justamente lo que les da valor (cohortes, recurrencia, LTV).
2. **Al desconectar una tienda**, la conexión pasa a `pending_deletion` con
   `scheduled_purge_at = ahora + 30 días` (`RETENTION_PERIOD_DAYS` en
   [`consultant.ts`](../../apps/api/src/consultant.ts)) y un job periódico borra
   físicamente sus datos al vencer. Los 30 días son un periodo de gracia para
   revertir una desconexión accidental, no un archivo.
3. **Al dar de baja una organización**, se aplica el mismo mecanismo y el mismo
   plazo sobre todos sus datos.
4. **No se guarda PII directa de los clientes del merchant**: `shopify_customers`
   solo tiene `customer_reference_hash`, contadores y estados de marketing
   ([migración](../../supabase/migrations/20260715200000_db_06_shopify_customers.sql));
   la ubicación aproximada se eliminó por innecesaria
   ([migración](../../supabase/migrations/20260910130000_shopify_customers_drop_location.sql)).
   Pedidos y checkouts no almacenan email ni dirección de envío.
5. **El borrado a petición del merchant** no espera a los 30 días: desconectar y
   pedir el borrado inmediato es una operación disponible, y `shop/redact` /
   `customers/redact` se atienden por el flujo de webhooks obligatorios.

## Consecuencias

- La ventana declarada coincide con lo que el código ya hacía; esta ADR no
  introduce comportamiento nuevo, elimina una laguna documental.
- "Sin purga temporal mientras dure la relación" solo es defendible porque no
  guardamos PII directa. **Si algún día se sincroniza email, teléfono o dirección,
  esta ADR deja de ser válida y hay que reabrirla antes de escribir esa columna.**
- Los 30 días son un número elegido para ser reversible, no un requisito legal.
  Un merchant puede exigir borrado inmediato y hay que poder hacerlo.
