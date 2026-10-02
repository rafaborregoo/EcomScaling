# Plan de ejecución: panel de administración E-NORA

## Decisión de producto

El panel será una consola de trabajo por entidades, no una sucesión de tablas con formularios desplegados debajo. Los directorios sirven para encontrar y comparar; cada cliente, consultor y registro operativo importante tiene URL y ficha propia. El color base es `#3d3b3a`, con contraste accesible, y los SVG de la raíz del proyecto se usan mediante `BrandLogo`.

Este plan abarca la consola de plataforma y su relación con los datos de cada tienda. La prioridad comercial y técnica es la [auditoría de Shopify, datos, UI y agentes](./AUDITORIA_SHOPIFY_DATOS_UI_AGENTES.md), apoyada en la [documentación oficial de la API](./AUDITORIA_SHOPIFY_API_OFICIAL.md). El plan inicial de [catálogo, packs y promociones](./PLAN_CATALOGO_PACKS_PROMOCIONES_SHOPIFY.md) queda como antecedente.

## Estado del código revisado el 30-09-2026

La estructura nueva ya existe en el árbol de trabajo: `PlatformAdminShell` agrupa la navegación, `/admin` ofrece un índice de módulos, y `/admin/clientes/[clientId]` y `/admin/consultores/[consultantId]` abren fichas independientes. La ficha de cliente ya enlaza operación, plan, accesos e integraciones; la de consultor incluye asignaciones y acciones de ciclo de vida. El tema de admin define `--admin-accent: #3d3b3a` y el shell usa `BrandLogo`. Esto es trabajo local presente, no una declaración de que todos los flujos estén cerrados en un entorno real.

El API ya ofrece rutas administrativas para clientes, consultores, suscripciones, finanzas, facturas, agentes, observabilidad, conocimiento, errores de sincronización y auditoría. Las pantallas no deben inventar capacidades que estas rutas no permitan; cada acción nueva requiere contrato, permiso, estado de carga, confirmación cuando cambia datos sensibles, resultado visible y registro auditable.

## Matriz de módulos y fichas

| Área | Vista principal | Ficha o control propio | Acciones que deben quedar revisadas |
| --- | --- | --- | --- |
| Resumen | Estado y tareas prioritarias de la plataforma | Acceso directo al registro afectado | Navegación y fechas/frescura de los indicadores |
| Clientes | Directorio buscable y filtrable | `/admin/clientes/[clientId]`: identidad, plan, miembros, consultores, integraciones, sync, IA, facturación, actividad | Alta, edición, asignación, plan, ver como, exportación, baja y reintento de sync |
| Consultores | Directorio y carga de trabajo | `/admin/consultores/[consultantId]`: perfil, capacidad, clientes, referidos, actividad | Invitación, reenvío, asignación, activación, revocación y eliminación |
| Programa | Directorio de socios y referidos | Ficha por socio/referido cuando requiera historial y acciones | Códigos, atribución y estados |
| Agentes de IA | Estado, configuración y límites | Ficha de agente y de ejecución con entradas, herramientas, coste, resultado y errores | Activar/desactivar, límites, reintentos y revisión de propuestas según permisos |
| Observabilidad y errores | Cola de incidencias y trazas | Ficha de ejecución/sync/error con línea temporal | Diagnóstico, reintento seguro, resolución y enlace a cliente/tienda |
| Finanzas y facturación | Resúmenes y directorios de movimientos/facturas | Ficha de gasto, factura o suscripción con historial | Alta/edición, concesión, reintentos fiscales y envío con confirmación |
| Conocimiento y laboratorio | Directorios de documentos y fichas | Versiones, procedencia, derechos, estado y usos por agentes | Ingesta, revisión, publicación y retirada |
| Herramientas y auditoría | Inventario y registro filtrable | Detalle de acción con actor, alcance y resultado | Operaciones restringidas y trazabilidad |
| Comercio Shopify | Directorio de productos/promociones por tienda | Producto, variante, pack y promoción con datos verificados | Sincronizar, filtrar y abrir ficha; después analizar ventas, stock y reglas |

## Reglas de interfaz y operación

1. Mantener contexto de organización y tienda en enlaces profundos; el servidor vuelve a comprobar permisos. Las listas grandes usan paginación y filtros que puedan conservarse en URL.
2. Una acción de una fila abre una página cuando requiere contexto o decisiones. Solo acciones triviales, reversibles y de alcance evidente pueden resolverse en la lista.
3. Cada ficha agrupa resumen, estado, relaciones, actividad reciente y acciones. Las fechas, moneda, tienda, cobertura de sincronización y procedencia se muestran junto al dato cuando cambian su interpretación.
4. Estados vacíos, de carga y de error tienen un siguiente paso comprensible. Los errores de permisos no se transforman en «sin datos».
5. Las operaciones destructivas o externas explican alcance y consecuencia antes de ejecutarse; el API aplica permisos y deja auditoría. Los controles deshabilitados explican por qué.
6. Desktop y móvil comparten jerarquía de información. Navegación por teclado, foco, contraste y tablas legibles forman parte de cada módulo.

## Dependencias de datos y agentes

Antes de cambiar tablas, mapear para cada módulo: entidad, clave, organización, tienda, relaciones, RLS, RPC/endpoint, paginación, índice, retención y auditoría. Priorizar consultas individuales para fichas; hoy algunas fichas filtran en el navegador una colección completa y deben migrar a endpoints por ID cuando el volumen crezca. Las migraciones son aditivas y las pantallas deben admitir datos históricos incompletos.

Los agentes deben recibir el mismo alcance y vocabulario que ve el administrador: cliente, tienda, periodo, `as_of`, cobertura y fuente. Una recomendación con datos parciales se presenta como tal. La consola debe permitir seguir una propuesta hasta su ejecución, coste, aprobación, resultado y error sin confundir una inferencia del agente con un hecho sincronizado.

## Orden de ejecución

1. **Base de navegación y entidades:** consolidar shell, identidad visual, directorios y fichas de cliente/consultor ya iniciadas; revisar una por una las acciones y sustituir aperturas debajo de listas. Cerrar los contratos por ID y los estados vacíos/error.
2. **Comercio Shopify:** catálogo paginado y fichas de producto ya iniciados; después métricas, promociones, packs confirmados y agentes, según el plan enlazado.
3. **Operaciones e IA:** fichas de ejecución, incidencias y agente; permisos y trazabilidad de cada acción; conexión con el contexto por cliente.
4. **Finanzas, programa y conocimiento:** pasar de paneles densos a directorio + ficha cuando hay historial o decisiones; revisar envíos, facturas, referidos y publicaciones.
5. **Cierre transversal:** recorrer todos los enlaces y acciones con roles reales, móvil, teclado, tiendas múltiples, errores de API y datos incompletos; documentar los módulos cerrados y los pendientes.

## Criterio de cierre por módulo

Un módulo queda cerrado cuando su lista encuentra registros sin truncarlos, su ficha abre por URL y conserva el contexto, todas sus acciones tienen permisos y resultados claros, los estados de error y vacío son útiles, y el flujo completo se ha revisado con datos y roles representativos. La compilación local por sí sola no cumple este criterio.
