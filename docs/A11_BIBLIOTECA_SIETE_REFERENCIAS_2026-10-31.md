# A11 · siete referencias internas con contexto editorial

## Acuerdo con el propietario

Las capturas que aporte en esta revisión se convierten en plantillas internas reemplazables de E-NORA. Se prepara y revisa primero la biblioteca; después se comparan los seis modelos acordados, sin Astra. Estas composiciones son referencias construidas manualmente por Codex con fotografías sintéticas, no salidas de Opus ni una evaluación de A11. No se modifican pesos ni se elige todavía un ganador.

## Nuevas plantillas

| Captura | Plantilla | Campos reemplazables | ID de borrador TEST |
| --- | --- | ---: | --- |
| 1.jpeg | 04 · Colección y acceso anticipado | 29 | 3c7a73be-3399-41e3-baab-3079a6867f45 |
| 2.jpeg | 05 · Descubrimiento en profundidad | 37 | cf7fc229-0aba-4b7b-9a70-61c5eb8dc863 |
| 3.jpeg | 06 · Garantía y evidencia | 28 | 9d8d73e3-10ac-4f46-bbdf-808604b0f3d3 |
| 4.jpeg | 07 · Anatomía de producto | 26 | e5611570-93f5-4ee2-9e02-6c8ddbbe8d05 |

Se mantienen 01 Pregunta y descubrimiento, 02 Lista de momentos y 03 Hilo editorial, ahora con criterios editoriales comunes añadidos como nuevas versiones. La curación de contexto conserva HTML y valores que el administrador pudiera haber editado. El historial permanece intacto.

Marca y productos ficticios: Órbita Mini y Órbita Alta. Nuevas imágenes de ambiente, segundo producto y despiece conceptual. La referencia de pádel se adapta a la anatomía de una lámpara; la de suplemento a una explicación de producto sin afirmaciones de salud. La garantía no hereda 30 días, cifras de devolución, estrellas ni número de clientes. Evidencia y reseñas quedan como espacios por verificar o retirar al producir la pieza real. La ilustración de despiece no acredita ingeniería real.

## Contexto persistido y visible

En **Platform Admin → Operaciones → Laboratorio de mailing → Biblioteca interna · E-NORA** (`/admin/laboratorio-mailing`) aparecen siete tarjetas agrupadas por plantilla. Abrir «Ver y personalizar» muestra el bloque plegable **Contexto editorial de esta plantilla**: objetivo, cuándo usar/evitar, estructura, dirección visual, CTA, criterios de evaluación y riesgos/evidencia necesaria.

Todo se guarda en los campos JSON existentes del repositorio privado: `objective`, `when_to_use`, `when_not_to_use`, `sequence_arc`, `visual_direction`, `persuasion_principles`, `cta_guidance`, `risks`, `lesson`, con procedencia y límites. La descarga JSON incluye el contexto editorial, fuente y evidencia, además de HTML y variables. El HTML mantiene los campos sustituibles y el editor permite nuevas versiones sin publicar ni enviar. No se añadieron plantillas a cuentas de clientes ni se publicaron originales de las capturas.

## Preparación de la comparación

`.e-nora-test-lab/marketing-internal-templates/benchmark-manifest.json` fija los siete ejemplos con sus IDs/versiones, hashes de HTML y recursos, variables y contexto. Estado `prepared_not_executed`; origen manual y revisión humana pendiente.

Modelos previstos: Haiku 5.5, Sonnet 5.5, Opus 5.5, Luna, Sol y Terra. Misma entrada de marca/producto real y los mismos recursos para cada modelo. Evaluar por separado:

1. Adaptación guiada: captura interna y contexto, sin confundir copia de HTML con calidad de diseño.
2. Creación desde cero: mismo brief, producto y principios; sin entregar una composición obligatoria a reproducir.

Se debe transmitir realmente la imagen por un canal visual admitido; un prompt con URLs o descripciones no demuestra que el modelo la haya visto. Conservar la salida original del modelo, registrar cualquier corrección humana como otra versión y cuantificar contexto, generación, imagen, revisión y reintentos. No decidir por cantidad de bloques ni por precio aislado.

Criterios: concepto y originalidad, jerarquía/composición, coherencia producto-imagen, adaptación móvil, fidelidad y evidencia, editabilidad y coste completo. No se ejecutó ninguna comparación en esta ampliación.

## Verificación y límites

- Diez pruebas focalizadas correctas: siete presets completos, todos los campos declarados usados, recursos existentes, límites de evidencia, renderer seguro, permisos/versionado API.
- Typecheck web correcto. El backend y el esquema de base de datos existentes no necesitan migración para estos nuevos ejemplos.
- Ocho renders nuevos a 600/360 px: imágenes cargadas, un H1, sin desbordamiento horizontal; inspección visual de las cuatro composiciones. Las tres anteriores conservan su verificación previa.
- Listado e inspección de los siete borradores con identidad real de administrador; acceso consultor denegado (403). El script es idempotente y no genera versiones extra sin cambios de contexto.
- Las capturas son renders de los emails, no una prueba visual autenticada completa de la galería. No se ha comprobado entrega en clientes de correo reales.

Presets en `scripts/fixtures/internal-reference-email-templates.ts`; creación/curación con `scripts/create-internal-orbita-templates.mts --refresh`; pruebas `scripts/internal-reference-email-templates.test.mts`; renders `scripts/verify-internal-orbita-templates.mts --new-only`. Galería y contexto en `apps/web/src/app/admin/laboratorio-mailing/internal-template-library.tsx`.

Datos en TEST. Código y recursos pendientes de despliegue para producción. No se enviaron campañas ni se activó recuperación automática de estos ejemplos por A11: esa conexión se validará en la fase de comparación.
