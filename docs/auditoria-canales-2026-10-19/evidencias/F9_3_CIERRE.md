# F9.3 · Compilación, accesibilidad y carga

Fecha: 2026-10-21. Verificación local; sin despliegue.

## Cambios

- El typecheck integral destapó y se corrigieron errores de compilación en la resolución del agente de propuestas, en el requisito de tienda del análisis visual Meta y en la selección de creatividades por moneda.
- Se corrigieron dos enlaces internos a Klaviyo para usar `next/link` y se trasladó la lectura del reloj de la página de reuniones a la hidratación del cliente.
- El build detectó un selector CSS inválido en la ficha de promociones; se corrigió el selector de inputs.
- Revisión de accesibilidad del shell autenticado: idioma `es`, enlace para saltar al contenido, landmark `main`, foco visible y reglas `prefers-reduced-motion` presentes.

## Verificación

- `npm run typecheck` desde la raíz: correcto para todos los workspaces (API, web, worker y paquetes).
- `npm run lint` en web: 0 errores y 186 avisos. La mayoría corresponden a estado síncrono en efectos y dependencias de hooks; se conservan como deuda existente.
- `npm run build` de web: correcto; compilación, TypeScript y prerender de 87/87 páginas completados. El proceso necesitó valores temporales de Supabase para prerenderizar `/nueva-contrasena`; se pasaron solo al proceso de build y no se escribieron en archivos ni se usaron para conectar a un proyecto.
- Artefactos estáticos: 119 chunks JavaScript, 6.649.707 bytes sin comprimir; el mayor ocupa 2.033.825 bytes. Son tamaños brutos, no la transferencia comprimida de una sesión.
- No se ejecutaron pruebas automatizadas.

## Límites y pendientes de liberación

- La auditoría de accesibilidad fue de código. No se hizo recorrido manual con teclado, lector de pantalla ni zoom; no se declara certificación WCAG.
- El build local no mide LCP, INP, CLS ni rendimiento de backend en producción. El chunk mayor requiere perfilado por ruta y una medición real antes de optimizarlo.
- No se desplegó código ni se hicieron cambios de configuración en Shopify, Meta o Klaviyo. No se requiere ninguna acción del usuario en esas aplicaciones durante esta fase.
- F9.3 queda implementada en local. La validación final de navegador, permisos y métricas reales queda para el despliegue final del plan.
