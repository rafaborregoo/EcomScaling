# ADR Log

| ID | Fecha | Decision | Motivo | Impacto | Estado |
| --- | --- | --- | --- | --- | --- |
| ADR-0001 | 2026-07-15 | Dividir el roadmap maestro en roadmaps operativos por dominio y fase. | El roadmap maestro es correcto como estrategia, pero demasiado grande para ejecucion diaria. | Se crea `roadmap/roadmaps/` como capa operativa sin sustituir fuentes originales. | Aprobada |
| ADR-0002 | 2026-07-15 | Usar npm workspaces para el monorepo inicial. | `pnpm` no esta instalado en la maquina y npm ya esta disponible. | Se mantiene monorepo TypeScript sin dependencia global adicional. | Aprobada |
| ADR-0003 | 2026-07-15 | No aplicar el SQL exportado desde DBML como migracion directa. | Crea `auth.users`, no tiene RLS/policies/triggers y despliega 90 tablas de golpe. | Se generan migraciones Supabase por fase: DB-00, DB-01, DB-02 primero. | Aprobada |
| ADR-0004 | 2026-07-15 | Dockerizar API y worker, pero no Supabase gestionado. | Web puede ir en Vercel; API y worker necesitan runtime persistente y portable; Supabase sera servicio gestionado. | Dockerfiles en BE-00/OPS-00 antes del piloto; Supabase local queda opcional para tests. | Aprobada |
| ADR-0004 | 2026-07-15 | Fijar EcomScaling IA en puerto local 3001. | El puerto 3000 queda reservado para NORA. | Next.js usa `3001`; Supabase Auth local usa `http://localhost:3001` como `site_url`. | Aprobada |
| ADR-0005 | 2026-07-15 | Usar `Public distribution` para Shopify productivo y `Custom distribution` solo para pruebas. | EcomScaling conecta tiendas de clientes distintos; Shopify limita `Custom distribution` a una sola tienda, varias de la misma org Plus o dev stores. | La app Shopify productiva se instala por tienda; las credenciales quedan en backend y el frontend solo inicia el flujo. | Aprobada |
