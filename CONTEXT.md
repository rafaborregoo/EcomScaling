# Catálogo comercial de E-NORA

Lenguaje compartido para interpretar los datos de una tienda conectada. Cada hecho pertenece a una organización y, cuando procede de Shopify, a una tienda concreta.

## Catálogo

**Producto**:
Artículo comercial publicado o preparado en una tienda. Puede tener varias variantes; su nombre o precio no demuestran que sea un pack.

**Variante**:
Opción vendible de un producto con identidad propia en Shopify. Es la unidad a la que se asocian SKU, precio, coste e inventario.

**Pack**:
Producto o variante vendible formado por otros artículos en cantidades definidas. Su composición solo se considera confirmada cuando Shopify o la aplicación que lo creó aporta relaciones explícitas.
_Evitar_: Llamar pack a cualquier producto cuyo título contenga «kit» o «combo».

**Componente de pack**:
Variante y cantidad que forman parte de un pack confirmado.

## Precios y promociones

**Precio de comparación**:
Precio de referencia de una variante en Shopify. Su presencia no demuestra por sí sola una promoción aplicada a un pedido.

**Promoción**:
Regla comercial con condiciones de aplicación, vigencia y beneficio, como un código o un descuento automático. Una promoción puede afectar a productos o colecciones y puede coexistir con otras en un pedido.
_Evitar_: Oferta para referirse indistintamente a un precio de comparación, un pack o un descuento.

**Descuento aplicado**:
Importe atribuido a una promoción en un pedido o línea. Es un hecho histórico aunque la regla comercial cambie o se retire.

## Organizaciones y planes

**Organización**:
Espacio de trabajo del cliente en E-NORA. Agrupa a sus usuarios y las tiendas conectadas.

**Plaza de usuario**:
Un usuario activo de la organización o una invitación vigente sin aceptar. Ambos cuentan para el límite de usuarios del plan; consultores asignados no ocupan una plaza.

**Límite de tiendas**:
Máximo de tiendas que puede conectar una organización según su plan.

**Límite de usuarios**:
Máximo de plazas de usuario que puede ocupar una organización según su plan. Un límite sin valor configurado significa sin límite para conservar compatibilidad con planes anteriores.

## Marketing

**Campaña paraguas**:
Iniciativa de marketing que reúne un objetivo, una audiencia y un periodo. Puede coordinar acciones de varios canales, como una secuencia de emails y anuncios de Meta.

**Acción de campaña**:
Ejecución individual y fechada dentro de una campaña paraguas. Cada envío de email y cada lanzamiento de anuncio o creativo de Meta ocupa su propia fecha en el calendario.

**Envío de email**:
Una comunicación de campaña enviada en una fecha a una audiencia. Varios envíos relacionados pueden pertenecer a la misma campaña paraguas; un flujo automatizado es un tipo distinto de comunicación.

**Flow de Klaviyo**:
Automatización que empieza cuando ocurre un disparador y puede esperar entre pasos. Su fecha en el calendario es la preparación del flow; las esperas no son fechas de envío fijas.

**Creativo de Meta**:
Concepto o pieza publicitaria preparada para un anuncio de Meta. La planificación puede fechar su preparación o lanzamiento; no significa que el anuncio esté creado o publicado en Meta.
