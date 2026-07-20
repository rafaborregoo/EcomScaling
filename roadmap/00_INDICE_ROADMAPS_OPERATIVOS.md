# EcomScaling IA - Indice de roadmaps operativos

> Capa operativa creada a partir del roadmap tecnico maestro, el contexto de base de datos, el briefing de producto y las guias de Shopify, Meta/Instagram, Klaviyo y agentes IA.

## Donde estamos hoy

Panel operativo en vivo: **[`ESTADO_GLOBAL.md`](roadmaps/99-decisiones-y-seguimiento/ESTADO_GLOBAL.md)**
— tabla con estado real, responsable, bloqueador y siguiente accion por fase, mas el release activo.
Este indice es el mapa conceptual; ese archivo es el panel operativo. Si ambos no coinciden, gana
`ESTADO_GLOBAL.md` (y si eso tampoco coincide con las migraciones o el codigo, ver la regla de
resolucion de contradicciones abajo).

- **Estados y evidencia** (taxonomia obligatoria para cerrar una fase): [`ESTADOS_Y_EVIDENCIA.md`](roadmaps/99-decisiones-y-seguimiento/ESTADOS_Y_EVIDENCIA.md)
- **Riesgos abiertos**: [`RIESGOS.md`](roadmaps/99-decisiones-y-seguimiento/RIESGOS.md)
- **Decisiones pendientes**: [`PREGUNTAS_ABIERTAS.md`](roadmaps/99-decisiones-y-seguimiento/PREGUNTAS_ABIERTAS.md)
- **Decisiones tomadas (ADRs)**: [`ADR_LOG.md`](roadmaps/99-decisiones-y-seguimiento/ADR_LOG.md) y `docs/decisions/`

## Regla de uso

El roadmap maestro sigue siendo la referencia estrategica. Esta carpeta divide el trabajo en roadmaps ejecutables por dominio y fases pequenas para poder avanzar, documentar decisiones y cerrar entregables sin perder dependencias.

Antes de implementar una fase:

1. Leer el roadmap del dominio correspondiente.
2. Leer el documento de fase.
3. Revisar dependencias con otros dominios.
4. Actualizar el estado de la fase y el registro de decisiones si cambia el alcance.
5. No crear tablas, endpoints, pantallas o agentes fuera de la fase aprobada.

## Fuentes principales

| Fuente | Uso |
| --- | --- |
| `roadmap/EcomScaling_IA_Roadmap_Tecnico_Implementacion_v0_1.md` | Orden maestro de releases y fases F0-F14. |
| `Base de Datos/ECOMSCALING_DATABASE_CONTEXT_FOR_CODEX.md` | Contrato conceptual DB v0.2, reglas SQL, RLS y secuencia DB-00 a DB-11. |
| `EcomScaling_IA_Briefing_Tecnico_Producto.md` | Producto, modulos, valor de negocio y fases funcionales. |
| `Agentes IA/EcomScaling_IA_Documento_Maestro_Agentes_v0_2.md` | Runtime IA, agentes A00-A09, SQL Gateway, herramientas y quality gates. |
| `Shopify/EcomScaling_IA_Guia_Shopify_GraphQL_Admin_API.md` | OAuth, GraphQL, bulk operations, webhooks, rate limits y privacidad Shopify. |
| `Meta Ads-Instagram/EcomScaling_IA_Guia_Meta_Ads_Instagram_API.md` | Marketing API, Instagram Graph API, insights, permisos y limitaciones. |
| `Klaviyo/EcomScaling_IA_Guia_Klaviyo_API.md` | API Klaviyo, reporting, flows, campanas, forms y rate limits. |

## Roadmaps por dominio

| Dominio | Carpeta | Responsabilidad |
| --- | --- | --- |
| Base de datos | `roadmap/roadmaps/01-base-de-datos/` | Migraciones Supabase, RLS, constraints, seeds, tests SQL y DBML. |
| Backend/API | `roadmap/roadmaps/02-backend-api/` | API, servicios de dominio, contratos, permisos, idempotencia y workers. |
| Frontend/UX | `roadmap/roadmaps/03-frontend-ux/` | Portal cliente, panel consultor, design system, estados y accesibilidad. |
| Integraciones | `roadmap/roadmaps/04-integraciones/` | Shopify, Meta Ads, Instagram, Klaviyo, Fathom/Loom, webhooks y syncs. |
| Agentes IA | `roadmap/roadmaps/05-agentes-ia/` | Runtime, SQL Gateway, A01-A09, RAG, evaluaciones y aprobaciones. |
| Seguridad/QA/Observabilidad | `roadmap/roadmaps/06-seguridad-qa-observabilidad/` | RLS, privacidad, tests, CI, logs, metricas, tracing y alertas operativas. |
| Operacion/Despliegue | `roadmap/roadmaps/07-operacion-despliegue/` | Entornos, releases, piloto MVP, runbooks, backups y soporte. |
| Decisiones y seguimiento | `roadmap/roadmaps/99-decisiones-y-seguimiento/` | ADRs, riesgos, preguntas abiertas y estado global. |

## Orden recomendado de ejecucion

1. F0/F1: cerrar contratos, monorepo, CI, Supabase local, API, worker y web shell.
2. F2/F3: multi-tenant, Auth, RLS, portal cliente y panel consultor navegables.
3. F4/F5: Shopify end-to-end, configuracion financiera, motor financiero y dashboard MVP.
4. F6: Meta Ads y adquisicion.
5. F7/F8/F9: alertas, tareas, llamadas, A01 y Mi Camino.
6. F10: hardening y piloto MVP con clientes reales controlados.
7. F11/F12: Klaviyo, retencion, stock, campanas y Fathom.
8. F13/F14: Consultor IA avanzado, RAG, Instagram y creatividad.

## Quality gate global

Una fase no se cierra si falta alguno de estos bloques:

- migraciones o contrato de datos cuando aplique;
- backend/API o worker cuando haya logica de negocio;
- frontend usable cuando haya superficie de producto;
- seguridad y permisos;
- tests proporcionales al riesgo;
- observabilidad minima;
- documentacion actualizada.
