# Auditoría de canales y software E-NORA · 19-10-2026

Leer primero el [plan principal](../PLAN_ORGANIZACION_CANALES_STOCK_Y_AUDITORIA_2026-10-19.md): contiene el dictamen, mapa de páginas, prioridades, migración de rutas y criterios de aceptación.

## Informes

- [Especificación de UI y guía de implementación](./ESPECIFICACION_UI_Y_GUIA_IMPLEMENTACION.md): patrones, pantallas, componentes y criterios visuales.
- [Shopify: capacidades y límites](./SHOPIFY_CAPACIDADES_Y_LIMITES.md).
- [Meta y Klaviyo: capacidades y límites](./META_KLAVIYO_CAPACIDADES_Y_LIMITES.md).
- [Matriz inicial de capacidades efectivas](./MATRIZ_CAPACIDADES_EFECTIVAS.md).
- [Agente de stock: auditoría y diseño objetivo](./AUDITORIA_AGENTE_STOCK.md).
- [Auditoría transversal del software](./AUDITORIA_TRANSVERSAL_SOFTWARE.md).
- [Evidencia de cierre de F0](./evidencias/F0_CIERRE.md).
- [Evidencia de cierre de F1](./evidencias/F1_CIERRE.md).

Las rutas propuestas en los anexos son opciones de diseño; el mapa de rutas del plan principal prevalece para la implementación. Los informes distinguen viabilidad de plataforma, existencia en código y ejecución real no certificada.

## Evidencia

- [Inventario estático de superficies](./evidencias/inventario-superficies.json): 90 páginas; 0 enlaces href literales sin ruta encontrada. No acredita query params, anclas, permisos, enlaces dinámicos ni navegación en navegador.
- [Script del inventario](./evidencias/inventariar-superficies.cjs), ejecutable desde la raíz con Node.
- [Tests focalizados de conectores y navegación](./evidencias/tests-conectores-navegacion.txt): 69 correctos.
- El informe de stock registra su selección local: 14 correctos.
- [Typecheck web de la auditoría inicial](./evidencias/typecheck-web.txt): registró el TS2322 encontrado entonces; el problema ya está corregido y ambos typechecks pasan en el [cierre de F0](./evidencias/F0_CIERRE.md).

La revisión es estática y focal, con investigación oficial y pruebas locales; no es una certificación exhaustiva de producción, seguridad o rendimiento. No se ejecutaron agentes operativos, migraciones, cobros, seeds ni publicaciones/envíos en cuentas de proveedores para hacer esta auditoría.

La auditoría anterior es una línea base fechada. El roadmap posterior ya cerró F0 y aplicó las migraciones A14 e Inventario a TEST y producción; el código de API/web no se desplegará hasta el cierre del plan.
