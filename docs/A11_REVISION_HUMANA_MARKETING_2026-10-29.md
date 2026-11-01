# A11 · Revisión humana de marketing

29 de octubre de 2026. Estado: evaluación pendiente del propietario; modelo sin reasignar.

Cuenta: borregorafa99@gmail.com. Entorno TEST ES IA, organización del propietario, tienda E-NORA Demo.

18 borradores: seis emails, seis anuncios de Meta y seis publicaciones de Instagram. Todos en estado draft, sin fecha de envío ni publicación. Busca [LAB A11] en Marketing > Contenido y abre cada pieza en el Estudio.

Tres casos sintéticos por seis modelos, con prompt activo v11 y 18/18 contratos válidos. No son productos reales. No se ejecutan herramientas ni se generan imágenes. Astra excluido. Claude confirma el ID solicitado; Codex no confirma el ID servido. Se completó también Terra sobre el snapshot histórico, conservado aparte.

| Canal | Modelo | API estimada USD | Borrador |
| --- | --- | --- | --- |
| email_klaviyo | Haiku 5.5 | 0.0054–0.0060 | 88e97566-4fd5-5e7a-aed0-fe65ea11247f |
| email_klaviyo | Sonnet 5.5 | 0.0549–0.0669 | d3e805a5-8378-51b1-a208-b5bb03e49add |
| email_klaviyo | Opus 5.5 | 0.1314–0.1553 | de59681a-e9d4-54be-aada-41d87e57ef46 |
| email_klaviyo | GPT-6 Luna | 0.0030–0.0030 | 51e868c1-b701-5d5d-acc6-be7ce39dd0e4 |
| email_klaviyo | GPT-6.1 Sol | 0.0703–0.0703 | 2e6fac9e-1131-5771-ab77-fc399390fc1c |
| email_klaviyo | GPT-6.1 Terra | 0.0331–0.0331 | 4dc1d661-59b8-507d-ae6c-9e929f847c50 |
| meta_ads | Haiku 5.5 | 0.0029–0.0035 | b224ce9f-e139-59cf-a6f2-51ccb9f9c57f |
| meta_ads | Sonnet 5.5 | 0.0324–0.0440 | ce96ca91-0af9-5796-a000-f646a09dcc1a |
| meta_ads | Opus 5.5 | 0.0772–0.1003 | 67880696-7f0d-5c02-a6c8-09d091276b2e |
| meta_ads | GPT-6 Luna | 0.0024–0.0024 | f05da5ec-2518-5dca-ae7e-a9b1738b1f82 |
| meta_ads | GPT-6.1 Sol | 0.0596–0.0596 | 98fe701f-cac3-545a-aa17-e401dda11e64 |
| meta_ads | GPT-6.1 Terra | 0.0280–0.0280 | 1e7a931b-0f42-5a56-a519-be33b68ea826 |
| instagram_organic | Haiku 5.5 | 0.0030–0.0036 | 5740f2ea-00ef-5846-a42b-797ab519c3d0 |
| instagram_organic | Sonnet 5.5 | 0.0551–0.0689 | cb1c40e8-c8b3-5eb8-a760-2f075c244428 |
| instagram_organic | Opus 5.5 | 0.1261–0.1542 | d6697582-07c9-5004-a22a-bf17d431b8bb |
| instagram_organic | GPT-6 Luna | 0.0024–0.0024 | 69afc0a9-5249-5619-ade6-e7e8a96d5c1f |
| instagram_organic | GPT-6.1 Sol | 0.0616–0.0616 | ad400b25-ec41-57db-a13b-1036dfb2d0ee |
| instagram_organic | GPT-6.1 Terra | 0.0290–0.0290 | 9c046433-aea6-5649-ac44-db7addaea674 |

El precio estima tarifas API sobre consumo CLI con sobrecarga; no es factura ni medición de rendimiento API. A11 es manual: la referencia de cuatro generaciones al mes debe ajustarse a la frecuencia elegida por el propietario.

## Qué revisar

Voz de marca, claridad, literal obligatorio, fidelidad a atributos y precio, estructura y paleta del email, enlace de baja, CTA y formato de cada canal. Comprobar primero si la pieza sirve y después su precio. Los blancos y grises añadidos requieren criterio editorial; no se clasifican automáticamente como fallo.

Los seis modelos mantuvieron destination_url=null ante la URL ausente y approval_required=true. En Instagram, los seis devolvieron carousel y captions dentro del límite. Esto no certifica calidad editorial ni envío real.

## Fallos y verificación

- Corregido el desbordamiento de tone, preheader y purpose al guardar. El original se conserva y el borrador muestra una advertencia; no se cambia el copy. Dos pruebas de regresión correctas. Corrección de runtime local, pendiente de despliegue.
- Reconciliado un manifiesto histórico de A08 que declaraba Terra donde sus resultados archivados incluían Astra. No cambia ninguna respuesta ni decisión de modelo.
- Artefactos del laboratorio verificados: hashes de prompts, contextos y esquemas; 57 casos y 356 combinaciones históricas en total.
- Los 18 borradores tienen snapshot inicial de versión 1. La exportación usa IDs estables y no sobrescribe posteriores revisiones humanas.
- Visibilidad comprobada con el rol authenticated y el UID del propietario: 18 borradores visibles, todos sin programación. Esto comprueba acceso en base de datos, no sustituye una inspección visual del navegador.

Artefactos privados en .e-nora-test-lab/ai-models: report.json, a11-drafts.prepared.json, a11-drafts.manifest.json y receipts. Resumen reproducible: scripts/ai-model-lab-a11-summary.mts.
