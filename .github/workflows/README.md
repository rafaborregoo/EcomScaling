# Workflows programados de benchmarks

Los workflows `*-benchmarks-p05` a `benchmark-confidence-p13` ejecutan código
compilado de varios workspaces de este monorepo. Su orden de ejecución es una
invariante de CI:

1. Instalar dependencias con `npm ci` en Node.js 24.
2. Compilar `@ecomscaling/contracts` antes de cualquier test de API que lo
   importe desde `dist`.
3. Compilar `@ecomscaling/api` antes de `@ecomscaling/worker`.
4. Compilar `@ecomscaling/worker` antes de ejecutar un comando `start:*`, pues
   estos ejecutan ficheros en `apps/worker/dist`.

`scripts/assert-benchmark-workflow-build-order.mjs` comprueba esta invariante
en el workflow principal de CI. Si se crea o modifica un benchmark programado,
actualiza el guard al mismo tiempo.
