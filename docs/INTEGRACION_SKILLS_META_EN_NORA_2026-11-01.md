# Encaje de las skills Meta en el código de E-NORA

Fecha: 01/11/2026. Estado: mapa y propuesta de implementación sobre código inspeccionado; no cambia todavía prompts, contratos ni comportamiento en producción.

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

Este documento completa el primer paso de encaje solicitado. La implementación y la comparación de modelos siguen pendientes; no se ha activado el pack ni modificado ningún agente durante esta revisión.
