# Rediseño de Inicio, Informes y Rentabilidad — 14 de octubre de 2026

Se ha implementado una revisión de UI, UX y estructura HTML de Inicio para cliente y consultor, sus vistas Shopify, Meta y Klaviyo, Informes y Rentabilidad. El objetivo es reconocer el alcance, leer el resultado y llegar a la acción o evidencia con menos recorrido. La autorización del usuario incluye el rediseño completo de estas superficies y el uso de `#3D3B3A` en elementos relevantes.

El workspace contenía numerosos cambios previos de API, agentes, contratos, configuración y otras pantallas. Este informe atribuye únicamente el trabajo de UI y presentación de datos de las superficies indicadas. No certifica ni incorpora esas otras modificaciones al rediseño.

## Problemas y cambios implementados

| Superficie | Problema | Cambio |
| --- | --- | --- |
| Inicio del cliente / Prioridades | Lectura extensa, jerarquía desigual y recorrido largo hasta tareas/evidencia. | Marco frío, cabecera operativa, KPI comparables, acciones próximas al dato y navegación local contextual. Gráfico diario en `details` nativo. |
| Shopify | Gráfico orientado al puntero y tablas de lectura densa. | Control de rango nativo con salida de fecha/importe, identificadores SVG únicos, índice del día acotado, cabeceras y regiones de scroll nombradas. Periodo obtenido del contrato real. |
| Meta | Confusión entre estado del filtro y condición de break-even; atribución técnica expuesta sin traducción fiable. | Filtros y significado económico separados; traducción del enum de atribución con salida para casos mixtos y desconocidos. Alcance y limitaciones del dato conservados. |
| Klaviyo | Tasa ausente podía aparentar salud; confusión entre spam y rebotes. | Nulos representados como dato no disponible; etiquetas y valores separados para spam y bounce. Estado expresado mediante texto. |
| Inicio del consultor | Densidad de cartera y evidencia sin una gramática de revisión consistente. | Cabecera de alcance, triaje, contadores, matriz y bloques operativos con la misma paleta local, foco y navegación contextual. |
| Informes | Búsqueda y cantidad visible insuficientes; etiquetas de formulario y jerarquía de títulos mejorables. | Búsqueda local, contador de resultados, estado sin coincidencias/restablecimiento y etiquetas visibles. Card admite h2 para conservar h1→h2. |
| Rentabilidad: cartera / cliente / tienda | Matriz dependiente de layout visual y serie mensual sin suficiente garantía de unidad/escala. | Tabla HTML nativa con cabeceras de fila, scroll regional y primera columna fija. MonthlyChart recibe moneda y escala reales desde sus tres callers y etiqueta los importes mensuales. |
| Estados compartidos de estas vistas | Una consulta fallida o ausente podía confundirse con una cola vacía. | Skeletons y reintentos contextualizados; ausencia de tareas disponible como estado desconocido, sin afirmar «Al día». |

## Color, tipografía y componentes

| Rol | Valor y aplicación |
| --- | --- |
| Identidad / lectura principal | `#3D3B3A`: títulos, cifras relevantes y serie principal del gráfico. |
| Acción / selección | `#176B64`; hover `#135C55`; apoyo `#E3F1EE`. |
| Marco / superficie | `#F3F6F6` de fondo, blanco en paneles, `#F4F7F7` en bloques secundarios. |
| Texto de apoyo | `#495858` y `#5C6B6B`. |
| Separación | `#D5DFDF` y `#E6EDED`. |
| Estados | Verde, aviso y error acompañados de texto. Rentabilidad conserva sus variantes locales y colores de barra; no se documenta una normalización que no ocurrió. |

IBM Plex Sans ya estaba alojada en el proyecto y se reutiliza para todos los roles, con cifras tabulares. Se mantiene el catálogo `src/components/ui` sobre HeroUI; no se introduce un segundo catálogo. Los paneles operativos locales tienen radios de 12px y controles de 8px. El wrapper de Inicio limita su tema a la ruta: los componentes y CSS de client-pulse también se utilizan en Analítica y otros módulos, por lo que no se presenta este trabajo como una migración del SaaS completo.

El tratamiento móvil de Inicio eleva botones generales y segmentos a 44px bajo la consulta de contenedor de 680px. No es una regla universal: los compactos mantienen su regla específica, los enlaces locales conservan 36px, Informes 36px y los botones de Rentabilidad 40px. Las tablas densas mantienen scroll dentro de su región; las columnas principales no deben generar scroll horizontal de página.

No se han creado nuevos assets raster para el producto. Las imágenes de `.impeccable/review` son evidencia de revisión, no archivos que la interfaz sirva como decoración o contenido.

## Presentación de datos y HTML

- Los enlaces locales dependen del contexto y apuntan a secciones existentes.
- El selector de día del gráfico funciona con teclado mediante un rango nativo y ofrece una salida textual; los gradientes SVG tienen IDs únicos y el índice seleccionado queda dentro del dominio disponible.
- El recuento absoluto de días procede de la API; no se recorta un periodo de 31 a 30 para hacerlo coincidir con una etiqueta.
- La atribución se traduce desde el enum del contrato, con tratamiento de mezcla y valores desconocidos. No se convierte un estado técnico en una promesa comercial.
- La serie mensual de Rentabilidad utiliza moneda y escala reales, etiquetas de importes y las llamadas desde cartera, cliente y tienda.
- Las tablas tienen cabeceras explícitas; la matriz de cartera incorpora `th scope="row"`. Las regiones de scroll se identifican y permiten foco.
- Informes utiliza etiquetas visibles de formulario y Card con nivel h2; los usos existentes del componente conservan h3 por defecto.

Los estados de carga, error, vacío y datos incompletos son diferenciados. No se considera saludable una tasa Klaviyo nula ni una cola de tareas cuya consulta no ha entregado datos. Se conservan las rutas y permisos existentes para las acciones.

## Verificación y evidencia

La validación comunicada de esta entrega incluye 47 tests aprobados: 41 existentes y seis añadidos para atribución y escala. ESLint dirigido a los archivos intervenidos y TypeScript (`tsc`) completados sin errores.

Se probaron con sesión de cliente Prioridades, Shopify, Meta, Klaviyo e Informes en escritorio de 1440×1000 y móvil de 390×844. La comprobación cubrió ausencia de desbordamiento horizontal de página, destinos válidos de enlaces locales, selección del gráfico con ArrowLeft, cambio de periodo 90→7→30 y búsqueda sin coincidencias/restablecimiento en Informes.

Las capturas completas y de viewport por prefijo `client`, `shopify`, `meta`, `klaviyo` y `reports` están en [apps/web/.impeccable/review](../apps/web/.impeccable/review). El registro de tests está en [unit-tests.txt](../apps/web/.impeccable/review/unit-tests.txt).

La revisión de cierre detectó cuatro problemas de interpretación: atribución, duración absoluta del periodo, spam frente a bounce y moneda/escala mensual. Los cuatro se corrigieron y recibieron evaluación `resolved`; la disposición `ship` de ese revisor se limita a esas cuatro correcciones. No equivale a aprobación visual general de todas las pantallas.

## Límites de esta entrega

- El recorrido de consultor y `/panel` se revisó por código y tests; no hay capturas autenticadas ni prueba visual de interacción con sesión de consultor.
- No se realizó una auditoría completa de accesibilidad ni prueba al 200 % de zoom. Las mejoras de foco, teclado, etiquetas y semántica no certifican conformidad WCAG global.
- No se ejecutó un build de producción ni un despliegue como parte de esta validación.
- No se probaron mutaciones externas de generación, envío o publicación; su éxito no se infiere del rediseño ni de las capturas.
- La revisión no acredita contratos ni cambios backend previos o fuera de alcance.

El sistema visual implementado queda registrado en [DESIGN.md](../apps/web/DESIGN.md), su extensión [design.json](../apps/web/.impeccable/design.json) y el [contrato de superficie](../apps/web/.impeccable/surfaces/src-app-dashboard.md). Esas fuentes distinguen los tokens efectivos, el alcance local y las limitaciones verificadas.
