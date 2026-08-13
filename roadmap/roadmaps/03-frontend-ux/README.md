# Roadmap operativo - Frontend y UX

## Objetivo

Construir una app usable para cliente y consultor sin presentar datos falsos como reales. Cada pantalla debe tener loading, empty, error, permisos, estados de sync y responsive.

El criterio de terminado común está en el [objetivo global del SaaS](../../../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md):
la UI debe estar lista para Shopify hoy y para activar Meta Ads, Klaviyo e Instagram mañana con los mismos
componentes y contratos, cambiando solo capacidades, estado de conexión y datos disponibles.

## Contrato global

Antes de tocar cualquier `fases/FE-XX-*.md` o codigo en `apps/web/src`, aplica
[`FRONTEND_CONTRACT.md`](FRONTEND_CONTRACT.md): capacidades por rol (no roles crudos), contratos
compartidos con el backend (error, dinero, metrica, paginacion), reglas de contenido/subtextos y
Definition of Done por pantalla.

## Fases

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| FE-00 | `fases/FE-00-shell-design-system.md` | F1-F3 | Next.js, layout, design system y navegacion base. |
| FE-01 | `fases/FE-01-auth-onboarding.md` | F2-F5 | Login, cuenta activa, organizacion, conexiones e inputs financieros. |
| FE-02 | `fases/FE-02-dashboard.md` | F5-F6 | Dashboard Shopify/Meta con freshness y datos incompletos. |
| FE-03 | `fases/FE-03-tareas-alertas.md` | F7 | Cola de tareas, alertas, filtros, comentarios y historial. |
| FE-04 | `fases/FE-04-llamadas-mi-camino.md` | F8-F9 | Mis Llamadas, aprobaciones y plan estrategico. |
| FE-05 | `fases/FE-05-planificacion-retencion.md` | F11-F12 | Klaviyo, stock, campanas y planificacion. |
| FE-06 | `fases/FE-06-consultor-ia-contenido.md` | F13-F14 | Chat IA, fuentes, RAG, Instagram y creatividades. |
| FE-07 | `fases/FE-07-panel-consultor.md` | F2-F14 | Panel consultor evolutivo por modulo. |
| FE-08 | `fases/FE-08-ui-ux-interfaz-dinamica.md` | F10 (pre-piloto) | Design system final, rediseño completo e interfaz dinamica asistida por IA. |
