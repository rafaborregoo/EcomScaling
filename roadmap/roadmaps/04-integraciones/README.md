# Roadmap operativo - Integraciones

## Objetivo

Integrar proveedores externos de forma aislada, auditable e idempotente, sin contaminar el dominio interno con payloads externos.

## Fases

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| INT-00 | `fases/INT-00-nucleo-comun.md` | F4 | OAuth, credenciales, sync runs, webhooks, retries y rate limits. |
| INT-01 | `fases/INT-01-shopify.md` | F4-F5 | Shopify end-to-end. |
| INT-02 | `fases/INT-02-meta-ads.md` | F6 | Meta Ads y creatividades. |
| INT-03 | `fases/INT-03-klaviyo.md` | F11 | Klaviyo y email reporting. |
| INT-04 | `fases/INT-04-fathom-loom.md` | F8/F12 | Llamadas manuales Loom y automatizacion Fathom. |
| INT-05 | `fases/INT-05-instagram.md` | F14 | Instagram Graph API y contenido organico. |

