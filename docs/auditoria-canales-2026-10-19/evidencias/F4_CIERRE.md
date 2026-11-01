# F4 · Promociones y códigos Shopify

Fecha: 21-10-2026 · Estado: implementación local terminada; validación real en tienda de ensayo pendiente del despliegue final.

## Entregado

- La vista `/shopify/promociones` deja crear propuestas internas de códigos porcentuales o de importe fijo, con fechas, límite de usos y uso por cliente. Guardar la propuesta no escribe en Shopify.
- Propietarios y gestores pueden aprobar una propuesta y solicitar su aplicación. La API restringe la conexión a la organización/tienda, comprueba el rol y los scopes `read_discounts` y `write_discounts`, marca la propuesta en E-NORA y crea el código con `discountCodeBasicCreate`.
- Tras la mutación, la API relee el código y confirma ID, título, código y marcador de E-NORA. Si una respuesta de red deja el resultado incierto, la interfaz permite verificar el estado remoto sin repetir la creación. Un código remoto ajeno queda como conflicto.
- La reserva única por tienda/código evita dos propuestas activas con el mismo código. La clave de idempotencia hace repetible el guardado de la propuesta.
- La tabla `shopify_discount_proposals` tiene RLS activa, sin acceso concedido a `anon`/`authenticated`; las operaciones de servidor usan el rol `service_role`. Migración `20270104160000_shopify_discount_proposals.sql` aplicada a TEST (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`). En ambos entornos se verificó que la tabla existe, RLS está activa y todavía no contiene registros.
- Se añadió `write_discounts` a los scopes de la app. Hasta desplegar el código y volver a autorizar la app, la función no aparece como capacidad operativa en Shopify.

## Alcance y controles

La primera versión crea descuentos de código básicos sobre todos los productos y compradores: porcentaje o importe fijo. Todavía no cubre descuentos automáticos, envío gratis, compra X y llévate Y, segmentación de productos/clientes, combinaciones con otros descuentos, edición/pausa de descuentos ya publicados ni sincronización de campañas promocionales externas. No se crea ni activa ninguna promoción al guardar el borrador.

La llamada real a una tienda de ensayo no se ha ejecutado: el código no se despliega hasta terminar F0–F9 y no se ha identificado/reautorizado una conexión de ensayo para el nuevo scope. Por ello queda pendiente confirmar una creación de prueba y su lectura posterior; esta fase se considera implementada, pero no certificada de extremo a extremo contra Shopify.

El asesor de seguridad de Supabase mantiene avisos globales preexistentes (funciones SECURITY DEFINER, search_path y protección de contraseñas). El aviso «RLS habilitada sin política» también incluye esta tabla: es intencional porque se revocó el acceso de los roles cliente y solo el backend con `service_role` la consulta/escribe. No se añadieron permisos de lectura/escritura a usuarios finales.

## Verificación

- `npm run typecheck --workspace=@e-nora/api`: correcto.
- `npm run typecheck --workspace=web`: correcto.
- `npx tsx --test --test-force-exit apps/api/src/shopify-discount-proposals.test.ts`: 3/3 correctos (normalización y límites, payload de ambos tipos, reconciliación con marcador/título/código).
- Shopify Admin GraphQL validator: `discountCodeBasicCreate` y `codeDiscountNodeByCode` válidos para API `2026-07`; scopes requeridos `write_discounts` y `read_discounts`.
- ESLint no se pudo ejecutar con la configuración predeterminada del repositorio: ESLint 9 no encuentra `eslint.config.*`. Los dos typechecks sí terminaron correctamente.
- Supabase TEST y producción: migración aplicada; la tabla aparece con RLS activa. El advisory de RLS sin políticas se revisó conforme al modelo de grants de solo servidor descrito arriba.

## Paso necesario al final del plan

Cuando toque el despliegue final, hay que desplegar la configuración con `write_discounts` y reautorizar la app Shopify. Después se debe seleccionar una conexión de tienda de ensayo autorizada, crear un descuento pequeño con fecha controlada, comprobar que aparece en Shopify y verificar que volver a pulsar «Verificar» no crea un duplicado. La aplicación del código E-NORA debe mantenerse fuera de producción hasta completar esa prueba.

## Referencias oficiales consultadas

- [Mutation `discountCodeBasicCreate` (Admin GraphQL 2026-07)](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/discountCodeBasicCreate)
- [Input `DiscountCodeBasicInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DiscountCodeBasicInput)
- [Input `DiscountContextInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DiscountContextInput)
- [Enum `DiscountBuyerSelection` (`ALL`)](https://shopify.dev/docs/api/admin-graphql/2026-07/enums/DiscountBuyerSelection)
- [Query `codeDiscountNodeByCode`](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/codeDiscountNodeByCode)
- [Seguridad de API y grants en Supabase](https://supabase.com/docs/guides/api/securing-your-api)
