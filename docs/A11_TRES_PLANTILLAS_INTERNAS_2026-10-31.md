# Biblioteca interna E-NORA · tres composiciones reemplazables

Solicitud: reconstruir la estructura de las tres capturas aportadas con marca, producto, imágenes y textos ficticios sustituibles. No crear plantillas en la biblioteca del cliente ni elegir todavía un modelo ganador de A11.

## Entrega

En Platform Admin → Laboratorio de mailing (`/admin/laboratorio-mailing`) se añade la **Biblioteca interna · E-NORA**, sobre el repositorio privado existente. Tres tarjetas con miniatura, apertura de editor de campos, previsualización escritorio/móvil, descarga HTML/JSON y guardado como nueva versión. Solo platform_admin puede consultar o editar; cliente/consultor no tienen acceso.

Marca ficticia Órbita; producto ficticio Órbita Mini, lámpara portátil. Fotografía generada para esta demostración y conservada en el proyecto. El ejemplo no incorpora logos, fotografías, métricas sociales, textos comerciales ni afirmaciones de salud de las capturas. Se omiten los rótulos grandes superpuestos al vídeo original.

| Plantilla | Patrón | Campos | Último borrador TEST |
| --- | --- | ---: | --- |
| 01 · Pregunta y descubrimiento | Pregunta cotidiana → buscador editorial → explicación → CTA → producto | 18 | aaad7e8c-f2f2-4aa6-ad18-284b6ab32889 |
| 02 · Lista de momentos | Promesa → CTA → producto → ocasiones de uso → CTA → cierre visual | 21 | 6da853d6-f842-47dd-9ef2-9f8649cb529e |
| 03 · Hilo editorial | Publicación destacada → fotografía → CTA → publicaciones conectadas → cierre | 19 | de4cb137-5dea-4f81-85cd-a7b9ba76d3b2 |

Cada registro lleva `content.template` con manifiesto de variables y `content.raw_html` con el HTML parametrizado. Se reutiliza `internal_mailing_playbook_entries` JSONB, sin migración nueva. Guardar no sobrescribe la versión anterior y mantiene los controles existentes de versión obsoleta y auditoría. Las tarjetas agrupan versiones para mostrar tres plantillas, no seis registros. Los borradores iniciales v1 se conservan; v2 incorpora el nombre de producto en el pie para que todos los campos declarados tengan un uso visible.

Las capturas sirvieron para extraer la estructura; sus archivos originales no se subieron a storage ni se publicaron. Los recursos públicos nuevos contienen solo la imagen sintética y miniaturas de las composiciones ficticias. Los originales privados de la biblioteca permanecen bajo el endpoint de administración.

## Sustitución y uso

Sintaxis `{{brand}}`, `{{product_name}}`, `{{product_image}}`, etc. Los campos admitidos son texto, imagen, URL HTTPS o color hexadecimal. El renderer escapa los valores y rechaza variables sin declarar, URLs ejecutables, colores inválidos y nombres duplicados. La vista previa va en iframe con sandbox sin scripts. No existe vista previa vacía silenciosa ante valores inválidos: el editor muestra el campo a corregir y desactiva guardado/descarga.

La descarga HTML contiene los valores elegidos. La descarga JSON conserva estructura, manifiesto y valores de ejemplo. Los enlaces example.com y la imagen ficticia deben sustituirse para una pieza real; el archivo HTML de demostración resuelve esa imagen al origen de la aplicación. No se ha certificado compatibilidad con todos los clientes de correo, ni se ha enviado un email.

Los cambios de la galería guardan una nueva versión interna; no publican ni envían. No se activa la recuperación de estas plantillas por A11 ni se afirma haber entrenado pesos de un modelo. El siguiente paso es revisar las composiciones y decidir cómo incorporarlas como referencias del proceso creativo, conservando creación desde cero.

## Verificación

- 17 pruebas focalizadas: renderer, esquema, aislamiento del playbook, rechazo temprano de slots desconocidos, versionado y filtros de recuperación existentes.
- Build de contratos y typecheck API/web correctos.
- Creación e inspección con una identidad platform_admin real en TEST; listado incluye los tres manifiestos. Inspector del rol consultor devuelve 403.
- Seis renders headless con viewport efectivo 600/360 px: todos sin desbordamiento horizontal y con imágenes cargadas. Capturas inspeccionadas visualmente; comprobación de estructura y campos sin variables pendientes.
- API local reiniciada. Health, ruta del laboratorio e imagen de ejemplo HTTP 200. Esta comprobación de rutas no se presenta como recorrido autenticado completo de la nueva galería.

Scripts: `scripts/create-internal-orbita-templates.mts` (idempotente, TEST, `--refresh` crea una nueva versión si cambia el HTML), `scripts/verify-internal-orbita-templates.mts` (capturas vía Chrome CDP en perfil propio). Presets: `scripts/fixtures/internal-orbita-email-templates.ts`. Recibos y capturas en `.e-nora-test-lab/marketing-internal-templates/`. Recursos en `apps/web/public/marketing-demo/`.

Los datos se han guardado en TEST. El código y recursos requieren despliegue para aparecer en producción.
