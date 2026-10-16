# Trabajo: extensión visual del Dashboard

El usuario autorizó aplicar la identidad vigente del Dashboard a Mi camino (`/camino`), Mi negocio (`/contexto`), Agenda (`/planificacion/calendario`) y Tareas (`/tareas`). Se conservan IBM Plex Sans, grafito `#3D3B3A`, petróleo `#176b64`, papel frío y paneles blancos. No se introduce otra dirección visual.

La implementación adapta el wrapper de Trabajo y sus overlays, las cabeceras y piezas compartidas, y las reglas locales de las cuatro rutas. `apps/web/DESIGN.md` documenta el alcance, los componentes y sus diferencias responsive; el sidecar conserva schemaVersion 2 y añade un ejemplo autocontenido de `HeroBlock`. La paleta y los tokens primitivos existentes se conservan.

## Evidencia de revisión

- Nueve capturas finales: escritorio y móvil de las cuatro rutas (`apps/web/.impeccable/review/trabajo-{camino,contexto,agenda,tareas}-final-{desktop,mobile}.jpg`) y Mi negocio al ancho del usuario (`trabajo-contexto-final-user-1707.jpg`). Resoluciones de referencia: 1440×1000, 390×844 y ancho 1707.
- La cuenta revisada muestra Camino propuesto. El mapa activo y el recorrido del consultor no se verificaron visualmente; estas capturas no acreditan todos los estados del módulo.
- La revisión independiente identificó un único hallazgo puntuado: contraste de metadatos de Aventura. Se corrigió con fondo blanco opaco. La comprobación de fuente confirmó `#5c6b6b` sobre blanco, contraste 5.57:1; el revisor dio ese hallazgo por resuelto. No equivale a una validación visual completa del mapa activo.
- El agente principal informó de TypeScript y ESLint sin errores y 30 pruebas aprobadas. La validación documental comprobó JSON válido, referencias de componentes y metadatos de color resueltas, cuatro rutas presentes y las ocho secciones canónicas de DESIGN.md en orden.

No se escribieron datos reales ni se desplegaron cambios durante esta revisión.
