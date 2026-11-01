# F5 · Biblioteca y jerarquía operativa de Meta

Fecha: 21-10-2026 · Estado: implementación de lectura terminada en local; no desplegada.

## Entregado

- Nueva ruta `/meta/creativos`, añadida al menú lateral de Meta. Permite buscar creatividades importadas por nombre, texto principal o titular y paginar los resultados.
- Cada tarjeta muestra una vista previa cuando Meta dejó una imagen/miniatura disponible; el tipo de creativo, titular, texto, descripción, destino, cuenta y fecha de última sincronización.
- La creatividad se enlaza con los anuncios que la referencian mediante `meta_ads.current_creative_id`; desde cada anuncio se puede recorrer campaña → conjunto → anuncio → estado efectivo de Meta. Se presenta por separado el estado configurado, estado efectivo y feedback de revisión cuando Meta lo devuelve.
- Se muestran presupuesto diario o total y saldo restante del conjunto; si el conjunto no tiene presupuesto, se muestra el de campaña. La moneda proviene de la cuenta publicitaria vinculada. No se suman monedas ni se inventa presupuesto si no está sincronizado.
- La nueva API de solo lectura filtra cuentas seleccionadas, organización y tienda activa; requiere pertenencia a la organización y usa el cliente Supabase del usuario sujeto a RLS. El parámetro de contexto de tienda es la conexión Shopify activa, igual que en la lista actual de campañas Meta.
- La ficha de campaña ya existente mantiene el desglose de conjuntos, anuncios e incidencias. La biblioteca añade la entrada inversa desde la creatividad y conserva ese destino operativo.
- No se cambió la base de datos, los scopes de Meta, ni se invocaron endpoints de escritura de Meta. El botón o flujo de publicar/activar continúa fuera de esta biblioteca.

## Límites visibles

Meta devuelve una fotografía de estado sincronizada, no una garantía en tiempo real. La tarjeta siempre presenta la fecha de sincronización disponible. Puede no haber preview, texto, presupuesto o enlace a una campaña si la API de Meta no los devolvió o la relación no está completa; en esos casos la UI lo deja sin dato. La relación actual es con la creatividad principal del anuncio y no reconstruye todas las variantes dinámicas de assets como anuncios separados.

Esta fase confirma control de acceso de lectura en API/DB para las personas con acceso a la organización. No certifica permisos de escritura `ads_management`, Advanced Access, revisión de aplicación ni Business Verification; la publicación está en pausa y no se prueba ni se activa desde E-NORA.

## Verificación

- `npm run typecheck --workspace=@e-nora/api`: correcto.
- `npm run typecheck --workspace=web`: correcto.
- Pruebas focalizadas de biblioteca, modelo de campañas y moneda de creatividades: 11/11 correctas. Las pruebas de biblioteca comprueban el recorrido, el estado/feedback, presupuestos por nivel y que una jerarquía incompleta no se rellena con valores inventados.
- Inventario estático de superficies actualizado: 92 páginas, 1 route handler y 0 enlaces `href` literales sin ruta encontrada. Este inventario no valida navegación autenticada en navegador.
- No se aplicó migración, no se cambió la configuración de la app de Meta y no se desplegó código.

## Acción de la usuaria

Ninguna en Meta para esta fase de solo lectura. Cuando se planifique habilitar creación/edición/publicación será necesario confirmar los permisos de escritura disponibles y el estado de revisión de la app antes de abrir esos controles.
