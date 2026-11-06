# Encaje de las skills Meta en el código de E-NORA

Fecha: 01/11/2026, actualizado 02/11/2026. Estado: integración aplicada en código y principios activados en TEST. Comparación A11 ejecutada con seis modelos y productos de la tienda; detalle en [Resultados del 02/11](./A11_COMPARACION_SEIS_MODELOS_DATOS_TIENDA_2026-11-02.md). No se ha desplegado la aplicación en producción.

## Decisión de diseño

Integrar los métodos útiles en los agentes y servicios existentes. No instalar las cinco carpetas como si eso activase funciones del SaaS, ni copiar sus Python/HTML al runtime. Una skill de este pack es principalmente una guía para un asistente; NORA necesita traducir esa guía a instrucciones versionadas, datos verificables, contratos y operaciones reales.

La adaptación es en ambas direcciones: retirar los supuestos débiles de las skills y completar los huecos de NORA. Conservar datos normalizados, contexto por tienda, permisos, costes, trazas, versiones y revisión humana. No añadir cinco agentes que deban ejecutarse en cadena en cada petición.

## Mapa concreto

| Aportación del pack | Responsable en NORA | Código existente verificado | Cambio propuesto |
| --- | --- | --- | --- |
| Brief, conceptos, copy y guion | A11, creación | `runMarketingContentDraft` en `apps/api/src/ai-runtime.ts`; contratos Meta/Instagram en `packages/ai/src/index.ts` | Entrada verificada común y método editorial por tarea/canal; salida compatible con el Estudio |
| Hooks y variantes | A11, con señales de A23 | `runCreatividadMetaAgent`, `meta-creative-vision.ts`, borradores y versiones del Estudio | Variantes con objetivo, parentesco y diferencia explícita; cantidad según necesidad, no diez siempre |
| Composición y exportación visual | A11 + lectura A15 y sobreimpresión A16 | `marketing-studio.ts`, `studio-design.ts`, `/marketing/imagenes/render`, `instagram-image-bank.ts` | Reutilizar assets/editor/render; ampliar solo la composición que falte y revisar la pieza renderizada |
| Investigación de competencia | Fuente de referencias para A11/A23 | `meta-creative-library.ts` cubre creativos propios; no se encontró consulta de Ad Library en el runtime revisado | Añadir la fuente de investigación explícitamente si se usa; etiquetar referencias e hipótesis, no ganadores |
| Análisis de resultados | A14 y A23, condicionado por A24 y con contexto A25 | `runOperativaMetaAgent`, `runCreatividadMetaAgent`, `runMedicionMetaAgent`, `runCambiosMetaAgent` | Reutilizar métricas y cálculos del backend; explicar decisiones con disponibilidad, ventana y evidencia |

A14 interpreta operativa/rentabilidad; A23 revisa creatividad; A24 verifica medición; A25 aporta cambios y contexto operativo. No trasladar el script del pack como un sexto sistema independiente que decida apagar/escalar.

## Qué se convierte en qué

### Instrucciones del modelo

Brief mínimo, propuestas de ángulo, coherencia entre gancho/cuerpo/CTA, voz de marca y criterios de composición. Incorporarlos como fragmentos seleccionados de instrucciones, ligados a versiones de prompt del flujo existente. No inyectar todos los SKILL.md completos con sus disparadores «SIEMPRE» en todas las llamadas.

Tres trabajos distintos: crear una pieza, variar una existente y adaptar su formato. Elegir el método correspondiente; no generar automáticamente conceptos, diez hooks, carrusel y análisis de inversión en cada borrador. Versionar cualquier ampliación de contrato y conservar el comportamiento actual por defecto para consumidores existentes.

### Código determinista

Cálculos, moneda, atribución/periodo, validación de inputs, límites, control de claims, verificación de assets, tamaños, render, guardado y permisos. No delegar estos controles al texto del prompt. Reutilizar las funciones existentes; portar una función del pack solo si resuelve una capacidad que realmente falta y después de corregir sus fallos.

### Datos y contexto

Perfil de marca, productos, fotos, enlaces, restricciones y referencias aprobadas. Se recuperan para organización/tienda y se registran con procedencia/frescura. No se convierten en instrucciones ejecutables ni se mezclan con cifras de competencia.

### Resultados del producto

Piezas y variantes en `marketing_content_drafts`, diseño editable, assets y versiones; diagnósticos en las vistas Meta correspondientes. El laboratorio conserva comparación y costes. Crear un guion no equivale a producir un vídeo; HTML de vista previa social no equivale a un creativo compuesto y exportado.

## Huecos observados en el código

1. **Contexto inicial A11:** `marketingContextBlocks` contiene el brief, contexto aprobado A26/A28 cuando existe y asignación de consultor. A11 dispone de herramientas, pero no debe depender de que el modelo decida buscar correctamente cada dato básico. Precargar y verificar empresa/tienda, marca, productos/fotos/enlaces y restricciones antes de generar; dejar las herramientas para investigación adicional.
2. **Perfil de marca ya existe:** `marketing-brand-profile.ts` tiene marca, logo, paleta, fuentes, tono, vocabulario, textos obligatorios, restricciones de claims y pie legal. Recuperarlo y combinarlo con las selecciones autorizadas del encargo, en lugar de crear otra configuración paralela o volver a pedirlo todo.
3. **Las 13 referencias no están automáticamente activas:** son `example` en `draft`. La herramienta `search_internal_email_design_playbook` consulta exclusivamente `strategy` + `published`. `buildInternalMailingDesignContext` devuelve principios compactos, no HTML ni IDs de la biblioteca privada. Hace falta una integración deliberada, no asumir que el agente ya está usando las trece.
4. **Benchmark y cliente tienen accesos distintos:** un benchmark interno puede adjuntar referencias de borrador autorizadas por plataforma. La ejecución del cliente debe utilizar los principios seleccionados/aprobados, preservando la biblioteca privada. No cambiar permisos del cliente para resolver la comparación.
5. **Biblioteca propia no es investigación pública:** `listMetaCreativeLibrary` organiza creativos de las cuentas conectadas. El conector Meta disponible para el asistente de desarrollo no se convierte automáticamente en una herramienta del backend de NORA.
6. **Render ya tiene piezas aprovechables:** `renderSocialHtml` compone una vista de revisión; la ruta de render de imágenes exporta imagen y bloques de texto en ratios 1:1/4:5/9:16. Reutilizar esas capacidades y distinguir lo que falta para una composición más compleja. No usar sin adaptación el `render.py` externo ni tratar los emails responsive como lienzos publicitarios fijos.
7. **Medición ya condiciona creatividad:** A23 carga evidencia visual y valoración de medición; su objetivo actual no permite inferir montaje o movimiento desde una miniatura ni ordenar escalado/retirada. Conservar esos límites al incorporar ideas del pack. A14 ya cruza datos Meta/financieros de la tienda y periodos: no sustituirlo por CPA calculado sobre un CSV sin contexto.

Estos puntos son comprobaciones de interfaces y bloques concretos; no constituyen una auditoría completa de todos los caminos de generación o un benchmark de calidad.

## Flujo que debe quedar

1. El usuario solicita una pieza o una mejora y selecciona tienda/producto/objetivo cuando haga falta.
2. El backend prepara un paquete verificable de contexto común y explicita lo que no está disponible.
3. Se selecciona el trabajo editorial y, si procede, unas pocas referencias pertinentes. Creación desde cero sigue disponible; las plantillas no son obligatorias.
4. A11 genera concepto/copy/composición con contrato validado. A15/A16 se usan cuando hagan falta lectura o preparación visual, no por rutina en cada solicitud.
5. El software renderiza, comprueba la pieza y conserva los defectos/advertencias. Guardar versión o iterar no debe publicar ni enviar por accidente.
6. Cliente y consultor ven la pieza y su revisión en el Estudio, con el alcance existente. Las acciones de publicación siguen sus permisos y revisión.
7. A23/A14 leen resultados propios cuando haya datos; A24/A25 aportan medición/cambios. Ese feedback informa futuros encargos sin convertir correlaciones en certeza causal.

## Orden de implementación

### 1. Entrada común y referencias

Primera intervención sobre A11: recuperar perfil de marca existente, contexto real de tienda/producto y assets; producir un snapshot verificable antes del modelo. Incorporar explícitamente las referencias internas en el modo de comparación y definir qué principios aprobados pasan al uso normal. Comprobar aislamiento, ausencia de datos y no confundir ejemplo ficticio con catálogo real.

### 2. Método editorial de copy y variantes

Adaptar Copywriter y Multiplicadora a esa entrada. Variantes con diferencias justificadas, sin números inventados ni cantidad fija. Conservar outputs y costes. Las restricciones de evidencia tienen prioridad sobre el patrón persuasivo.

### 3. Composición editable y render

Aplicar lo útil de Diseñadora sobre el Estudio y la exportación actuales. Completar imágenes, capas/módulos y validación visual que falten, manteniendo diferenciados email, anuncio y carrusel. La revisión de copy por sí sola no cierra calidad de diseño.

### 4. Comparación justa de modelos

Haiku, Sonnet, Opus, Luna, Sol y Terra, sin Astra. Mismo paquete runtime y recursos realmente transmitidos a cada modelo. Separar adaptación guiada de creación desde cero; renderizar las salidas originales, registrar cualquier corrección humana aparte y comparar calidad, fidelidad y coste completo. No dar por ganador a Opus antes de observar resultados.

### 5. Referencias externas y feedback analítico

Incorporar investigación de competencia y los principios válidos del analista donde corresponda, con sus correcciones. No reescribir todos los agentes ni añadir cron adicionales por instalar este material.

## Verificación de la futura integración

Una tienda/empresa de prueba, producto y assets verificados; mismos inputs para seis modelos. Contexto desconocido no se transforma en cero, referencia externa no demuestra ventas y ejemplo de plantilla no se presenta como dato de producto. La pieza elegida se revisa desde cliente/consultor en el Estudio. Mantener costes por etapa y evitar llamadas duplicadas al abrir ambas vistas.

## Implementación aplicada

Los apartados anteriores conservan el mapa y la motivación de la intervención. Su estado actual es el siguiente:

- **A11, entrada de generación:** `marketing-creative-context.ts` precarga organización y tienda exactas, perfil de marca con herencia, catálogo real (hasta doce productos o seis seleccionados), fotos/enlaces/precios, cinco piezas anteriores y conclusiones recientes aprobadas de especialistas de la misma tienda. Un error de consulta detiene la generación; ausencia de inventario se declara desconocida. Sin tienda no se consulta un catálogo agregado.
- **Método versionado:** `marketing-creative-method.ts` adapta copywriter, multiplicadora y criterios de diseño a crear, variar y adaptar. Solicitar variantes/adaptación por API requiere una pieza origen de la misma tienda; se conserva su ID y versión. No cambia el modelo asignado ni lanza agentes adicionales.
- **Referencias:** trece estrategias abstractas `published` derivadas de las trece referencias; los trece ejemplos originales siguen siendo borradores privados. Recuperación de hasta cuatro principios pertinentes, con origen/derechos comprobados, sin HTML, fotos, nombres o IDs privados. Original sigue siendo el modo por defecto.
- **UI del Estudio:** «Dirección creativa» permite crear desde cero o inspirarse en referencias internas. «Producto del catálogo» permite seleccionar un producto verificado. Está en Marketing → Estudio → creación mediante brief; cliente y consultor utilizan el mismo componente con sus permisos existentes.
- **Editor:** conserva su contrato de operaciones, validación de enlaces/assets/productos, deshacer y autoguardado. Usa todos los campos del perfil de marca y el método correspondiente al mensaje. Recupera principios solo si el encargo los solicita. Corregida la omisión de imágenes privadas cuyo acceso ya se había resuelto mediante URL firmada.
- **Visuales y render:** la generación transmite al canal visual imágenes del producto verificadas en el CDN de Shopify y adjuntos autorizados, con un límite total de seis. Email conserva el HTML y el diseño del borrador; social conserva copy/dirección visual. Se reutilizan editor y render existentes. Esto no introduce un productor nuevo de fotografía, PNG o vídeo, ni convierte automáticamente un brief social en una pieza terminada.
- **Trazabilidad y coste:** snapshot obligatorio con versión de contexto, fecha, recursos transmitidos y avisos; metadatos del método en el borrador; selección creativa forma parte de la idempotencia. Presupuesto, medición de tokens/costes, finalización atómica y revisión existentes siguen en vigor. No hay cron nuevo ni coste fijo adicional por instalar métodos; el contexto consume tokens en la llamada existente.
- **A14/A23/A24/A25:** guía común de interpretación sobre datos desconocidos, monedas, atribución, ventanas y cambios. Se conservan cálculos y veredictos deterministas existentes. No se ha copiado el analista Python ni sus umbrales automáticos.
- **Competencia:** se pueden aportar hasta cuatro observaciones HTTPS con fecha/fuente. Se identifican como observaciones, sin descargar URLs ni inferir rentabilidad. No se ha añadido un scraper ni una conexión nueva a Meta Ad Library.

## Verificación y uso

Pruebas focalizadas de contexto, aislamiento, fuente de otra tienda, producto ausente, fallos de datos, referencias, idempotencia, operaciones del editor y medición: 44 pruebas correctas en la primera batería; además, tres pruebas del perfil de marca correctas. Typecheck API/web. Comprobación real TEST: marca recuperada, doce productos, selección por `product_id` correcta, principios pertinentes y repetición del activador sin duplicar estrategias. Recibos en `.e-nora-test-lab/skills-meta-ads/activation-receipt.json` y `integration-context.json`. El activador no invoca modelos ni publica campañas.

Arranque local y HTTP comprobados para API, Marketing y biblioteca interna. No hay comprobación visual autenticada del nuevo selector: el host de navegación y el pipe nativo no están disponibles en esta sesión. Un HTTP 200 no sustituye esa revisión.

Para reactivar/verificar en TEST: `npx dotenv -o -e .env.local -- tsx scripts/activate-marketing-design-principles.mts`. El script exige la base TEST, utiliza un administrador real y las funciones de curación/auditoría existentes. No aplica migraciones: esta integración utiliza tablas y RPC existentes.

La integración de métodos queda aplicada. Actualización 02/11/2026: se ejecutaron las 36 combinaciones de Haiku, Sonnet, Opus, Luna, Sol y Terra, con 35 respuestas válidas y una rechazada. Comparaciones en la cuenta del propietario y del consultor, Marketing → Laboratorio de marketing. Recomendación editorial provisional Sol; asignación sin cambiar e inspección visual pendiente por bloqueo de Computer Use. Ver [Auditoría y resultados](./A11_COMPARACION_SEIS_MODELOS_DATOS_TIENDA_2026-11-02.md).
