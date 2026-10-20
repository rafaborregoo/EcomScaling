# Cierre de F0

Fecha de revisión: 19-10-2026.

## Criterios cerrados

- **T-01 · Recuperación Stripe:** se añadió una prueba de la ruta completa `invoice.paid`: el primer intento falla con error transitorio, el mismo ID se reentrega y crea la factura; la duplicación posterior no vuelve a crearla y solo reintenta el email. Resultado: `stripe.test.ts`, 24 pruebas correctas.
- **T-02 · TypeScript y CI web:** pasan `npm run typecheck --workspace=@e-nora/api` y `npm run typecheck --workspace=web -- --incremental false`. El workflow `quality-gates.yml` ya incluye el typecheck web tras construir los paquetes compartidos y el API.
- **T-03 · Mensaje de margen:** la pantalla de Shopify marca el margen como parcial cuando faltan costes o líneas de pedido y evita presentarlo como una cifra completa.
- **Capacidades iniciales:** se añadió la [matriz de capacidades efectivas](../MATRIZ_CAPACIDADES_EFECTIVAS.md), separando implementación en el repositorio, scopes declarados y permisos/cuenta real todavía no verificados. Los tests focales de feature flags, permisos Shopify/Klaviyo y plan de escritura Meta pasan: 22 correctos.

## Límites y siguiente paso

Los typechecks, la prueba Stripe focal (24 correctos) y los tests de permisos/capacidades (22 correctos) se ejecutaron localmente. No se hizo un cobro ni una emisión fiscal real. No se validaron scopes, App Review ni operaciones autenticadas de Meta, Shopify o Klaviyo; esas comprobaciones corresponden a las fases del proveedor. Las migraciones de A14 e Inventario están aplicadas en TEST y producción, pero el código de API/web permanece local según la instrucción de desplegarlo al final.

F0 se considera cerrada en su alcance del roadmap. F1 continúa con el cierre del mapa de rutas, permisos y destinos de avisos.
