# Rediseño de Marketing — 15 de octubre de 2026

## Alcance y sistema

Extensión autorizada del tema de Dashboard y Trabajo a Hoy, Campañas, Flows, Plantillas, Audiencias, Rendimiento, Crear contenido, Revisión de piezas, Biblioteca de plantillas, Banco de imágenes y Guía de marca. Incluye estilos compartidos del constructor de flows, los paneles de campaña y el editor de piezas del banco.

Grafito `#3D3B3A` para títulos y cifras, petróleo `#176b64` para acciones y selección, papel `#f3f6f6`, panel blanco y bordes `#d5dfdf`. Se conservan los colores de las imágenes, las piezas y la marca de cada tienda. La interfaz usa IBM Plex Sans.

## Cambios por superficie

- Hoy: título principal, próxima acción, cifras y calendario semanal con región desplazable identificada y foco visible.
- Campañas: cabecera clara, jerarquía y metadatos legibles, acciones en petróleo y controles móviles mayores. Estilos comunes para cliente y consultor.
- Flows: mismo tema en listado y constructor; pasos inactivos legibles, cabecera clara y navegación de paneles en móvil.
- Plantillas y Audiencias: filtros, tarjetas, estados y disposición adaptable coherentes con el resto del módulo.
- Rendimiento: etiquetas de ingresos sin asumir EUR, eje de gráfico con la moneda de la cuenta y estado de carga diferenciado de una cuenta desconectada. No se calcula el porcentaje sobre Shopify cuando sus monedas difieren o no están disponibles. La comparación con Meta declara que su respuesta no informa moneda, en lugar de atribuirle EUR.
- Legibilidad monetaria en móvil: los importes de la franja de Rendimiento pasan de 26px a 20px y permanecen en una línea, sin separar el identificador de moneda.
- Constructor de flows: la condición de importe indica «Moneda del evento» y explica su procedencia. `FlowAccount` no suministra el código de moneda al editor; se elimina la suposición de EUR.
- Revisión de piezas: cabecera específica, eliminación del resumen duplicado, cola más limpia y filtros táctiles accesibles.
- Biblioteca: conserva los resultados de la petición inicial; el efecto de reinicio se ejecuta antes de iniciar la carga. Se evita el bloqueo permanente en «Cargando biblioteca» y se ha comprobado la búsqueda local.
- Banco de imágenes: galería a todo el ancho cuando no hay ficha seleccionada, encabezado nativo y controles coherentes.
- Guía: cabecera clara y título nativo. Se elimina una regla global que imponía grafito a los títulos dentro de las vistas previas, respetando así el contraste propio de la marca.

## Verificación y límites

- 44 tests existentes correctos: campañas, estados de piezas, diseño del estudio, flows, revisión de overlays y perfil de marca.
- TypeScript sin errores; ESLint de Marketing sin errores; `git diff --check` correcto.
- Once entradas comprobadas a 1440×1000 y 390×844; Hoy también a 1707×1000. Capturas en `apps/web/.impeccable/review/marketing/`.
- Interacciones de lectura: buscar plantillas, abrir una ficha de imagen, abrir y cerrar una revisión, cambiar el periodo del informe, alternar paneles móviles del estudio y abrir un flow existente. No se han enviado, aprobado, publicado, importado ni generado contenidos.
- Detector ejecutado una vez. Se eliminó la transición de anchura detectada. Las fuentes de previews de email/redes y las fuentes de código son contextuales, no una sustitución de la tipografía de la interfaz.
- Las capturas principales corresponden a la cuenta cliente disponible y al primer viewport. La cartera del consultor y los estados de edición sin una pieza existente accesible se revisan en código. No se ha desplegado ni realizado una compilación de producción.

## Revisión independiente y documentación

La revisión independiente indicó dos correcciones: impedir que los importes móviles separasen el identificador de moneda y retirar EUR de la condición monetaria del editor de flows. Ambas están aplicadas en el código; TypeScript y ESLint pasan después de esas correcciones. Las capturas actualizadas de Rendimiento en escritorio y móvil y del editor de flows en escritorio se verificaron de nuevo. El revisor devolvió `disposition: ship` para esas dos correcciones, sin regresiones materiales visibles en las capturas modificadas; ese cierre no amplía la cobertura a estados o roles no capturados.

`apps/web/DESIGN.md` y su sidecar de esquema 2 amplían el alcance existente a Marketing sin reemplazar los tokens ni los componentes normativos de Dashboard y Trabajo. Se documentan los controles móviles de los editores y la separación entre el tema de la aplicación y la identidad de las piezas creadas.
