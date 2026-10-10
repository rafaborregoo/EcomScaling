-- Una tienda cuya conexion esta en borrado (pending_deletion) dejaba su fila de
-- shopify_stores con is_active = true: seguia contando en la moneda y en las
-- cifras de la organizacion (p. ej. dos tiendas de desarrollo en USD junto a la
-- tienda real en EUR dejaban las ventas sin moneda unica). Desde ahora el API
-- la desactiva al pedir el borrado y la reactiva al restaurar; esto corrige las
-- filas que ya estaban asi. Idempotente: solo toca las que siguen activas.
update public.shopify_stores as store
set is_active = false
from public.integration_connections as connection
where connection.id = store.connection_id
  and connection.status = 'pending_deletion'
  and store.is_active;
