# F9.1 · Permisos, aislamiento y navegación

Fecha: 2026-10-21. Implementación y comprobaciones locales. El despliegue del código continúa reservado para el final.

## Cambios

- Catálogo, inventario, fichas y descuentos Shopify, biblioteca Meta y consultas Klaviyo usan `requireOperationalOrganization`: se deniega una organización ajena, suspendida o con suscripción no activa. Un acceso limitado a tienda no se convierte en permiso general de organización.
- Crear, listar y aprobar propuestas de descuentos exige pertenencia real como propietario/gestor y cobertura de la tienda. La aprobación valida el rol antes de consultar la propuesta con privilegios de servicio.
- Klaviyo resuelve la tienda por organización, conexión e indicador activo. Una conexión sin tienda devuelve 404; un fallo de consulta devuelve 503. Ninguno amplía el alcance a todas las tiendas. Varias cuentas sin selección devuelven 409 y piden elegir tienda; la conexión asociada también se filtra por organización.
- Los enlaces internos de Shopify, Meta, Klaviyo y Marketing conservan organización y conexión, respetando los parámetros explícitos. Los enlaces externos no reciben ese contexto.
- Las fichas anidadas activan su sección del menú; `/informes` corresponde a Analítica. Web e Informes usan el marco persistente del portal. Las áreas de Klaviyo muestran los errores de acceso/carga y conservan el contexto al abrir Marketing.
- Se añade una regresión de capturas web: solo la organización propietaria puede leer el archivo y solo se admiten identificador y viewport válidos.

El cliente de servicio de Supabase puede omitir RLS; por eso las rutas que lo utilizan necesitan autorización previa y filtros explícitos. Referencia: [documentación oficial de RLS y claves de servicio](https://supabase.com/docs/guides/database/postgres/row-level-security#bypassing-row-level-security).

## Cobertura comprobada

| Superficie | Casos locales |
| --- | --- |
| 15 operaciones públicas de los módulos del plan | Organización ajena, suspendida, suscripción vencida y acceso solo de tienda: 403 antes de consultar datos |
| Lectura de biblioteca Meta | Propietario, gestor, lector y consultor asignado con organización operativa |
| Propuestas de descuentos | Lector, consultor asignado y administrador con acceso sintético: denegados antes de consultar; propietario/gestor reales: listado filtrado por organización/tienda |
| Workspace Klaviyo | Tienda inexistente/inactiva, fallo de resolución, tienda válida propagada a estadísticas y varias cuentas sin selección |
| Capturas web | Lectura propietaria, organización distinta, archivo ausente, viewport y revisión inválidos |
| Navegación | Menú según rol, gestión de equipo/facturación, fichas anidadas, Analítica, contexto y enlaces externos |

Las pruebas de API usan el cliente Supabase real contra un servidor REST local con respuestas controladas; las capturas usan archivos temporales. No acceden a bases remotas ni ejecutan mutaciones de proveedores. Las cuatro denegaciones de cada una de las 15 operaciones se agrupan en un test por operación.

## Verificación

Desde `apps/api`:

```text
npx tsx --test src/channel-access-regression.test.ts src/auth-context-operational.test.ts src/shopify-discount-proposals.test.ts src/meta-creative-library.test.ts src/marketing-store-scope.test.ts src/marketing-klaviyo.test.ts
40 tests correctos
```

Desde `apps/web`:

```text
npx tsx --tsconfig tsconfig.json --test src/components/portal-navigation.test.ts src/lib/portal-route-context.test.ts
9 tests correctos
```

Además: typecheck completo de API; typecheck focal de los archivos web modificados y sus dependencias; ESLint focal de navegación, contexto, marco persistente y página Klaviyo; comprobación de espacios del diff y enlaces locales de esta documentación.

## Límites y siguiente bloque

- No hay migraciones nuevas ni acciones necesarias del usuario en Shopify, Meta o Klaviyo para este bloque.
- Estas pruebas no certifican JWT, políticas Postgres ni sesiones de navegador contra TEST/producción. Los recorridos reales se mantienen pendientes para la liberación; tampoco se certifican escrituras remotas.
- Las cuentas con permiso solo de tienda siguen necesitando endpoints compatibles con ese alcance; no se les concede acceso general mediante este cambio.
- Con varias cuentas Klaviyo hay que seleccionar tienda. Los clientes sin selector, incluido el móvil actual, reciben el error de selección requerida; queda pendiente incorporar ese selector para cubrir ese caso de uso móvil.
- La compilación web integral, accesibilidad y carga corresponden a F9.3. El bloqueo global de calendario registrado en F7/F8 es evidencia histórica de esas fases; el typecheck focal de F9.1 no revalida ese archivo.
- F9.2 es el siguiente bloque: recuperación de jobs, reintentos y estados parciales sin duplicar acciones.
