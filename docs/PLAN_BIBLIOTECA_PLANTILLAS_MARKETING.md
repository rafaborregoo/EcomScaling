# Biblioteca de plantillas de Marketing

## Decisión de producto

La biblioteca vive dentro de `Marketing > Crear`, no como un módulo ni un
elemento adicional del subnavegador. Reúne tres orígenes en una misma lista:

- plantillas sincronizadas e importadas desde Klaviyo;
- plantillas diseñadas o editadas en E-NORA;
- propuestas generadas por IA que todavía no se han aprobado.

Una plantilla y un envío no son la misma entidad. La biblioteca muestra si una
plantilla se ha usado, cuántas veces y cómo rindieron esos envíos, sin afirmar
que un borrador no enviado tiene métricas.

## Ficha persistente de diseño

Cada versión de una plantilla guarda una ficha, no un análisis efímero. La
ficha se invalida solamente cuando cambian HTML, bloques o estilos y contiene:

- estructura y orden de bloques;
- paleta (hex y porcentaje aproximado de superficie); 
- tipografía (familia, tamaños, pesos y jerarquía);
- CTAs (texto, posición, contraste y frecuencia);
- uso de imágenes, densidad de texto y espaciado;
- técnicas persuasivas detectadas;
- procedencia, modelo, fecha, versión y hash del contenido analizado.

La primera lectura estructural se calcula al importar o guardar. El análisis
profundo se ejecuta explícitamente o en segundo plano una única vez por hash.
La generación posterior consulta la ficha persistida; nunca reenvía HTML
completo ni llama otra vez al analizador para una versión ya conocida.

## Flujo de IA y coste

1. Importar, crear o modificar una plantilla calcula un fingerprint SHA-256.
2. Si ya existe una ficha `ready` con ese fingerprint, se reutiliza.
3. Si no existe, se crea un trabajo idempotente `queued`; abrir la biblioteca
   no genera ningún trabajo.
4. Un worker procesa como máximo una ficha de diseño por organización y un
   máximo global conservador. El trabajo guarda `queued`, `running`, `ready` o
   `failed`, intentos y siguiente reintento.
5. Al crear desde ejemplos, se pasan como máximo tres fichas compactas y sus
   métricas agregadas a A11. No se hacen llamadas por plantilla ni por email.
6. La secuencia semanal usa una única lectura de perfiles y el plan A27; A11
   genera las piezas de forma limitada, nunca en paralelo sin límite.

El endpoint mantiene el rate limit actual por organización, presupuesto diario,
circuit breaker del proveedor y registro de cada ejecución. Los trabajos se
deduplican por `organization_id + fingerprint + analysis_version`.

## Métricas y estados

Para una plantilla de Klaviyo, el rendimiento se agrega desde mensajes de
campaña/flow enlazados por `external_template_id`. Para una plantilla interna,
solo se muestran métricas cuando existe una asociación verificable con un
envío. La interfaz enseña:

- `Sin enviar`, `Programada`, `Enviada` o `En revisión`;
- número de usos y último envío;
- aperturas, clics, conversiones, ingresos atribuidos y bajas cuando exista
  muestra; 
- comparación con la mediana del mismo tipo de envío, nunca un “éxito” sin
  datos suficientes.

## Interfaz

La pantalla principal de Crear mantiene su función de edición. Un botón
`Biblioteca de plantillas` abre el catálogo bajo demanda. Las filas muestran
preview, estado, origen y cuatro métricas pequeñas. Los filtros son origen,
estado y rendimiento. La acción `Crear desde ejemplos` abre un modal para
elegir hasta tres fichas ya listas; explica qué toma de cada una y permite
revisar el resultado antes de guardarlo.

## Seguridad y verificación

Las fichas respetan el mismo aislamiento por organización que
`marketing_content_drafts` y `klaviyo_templates`; no se exponen a otra tienda.
Las migraciones activan RLS y las rutas comprueban membresía antes de usar el
cliente de servicio. Se verificará: deduplicación, invalidación por cambios,
límite de concurrencia, ausencia de llamadas IA al listar, aislamiento entre
organizaciones y que una métrica sin envío se presente como no disponible.
