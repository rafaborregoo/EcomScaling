# Extensión de taxonomía (NO crear una taxonomía paralela)

> La taxonomía base de V03 se considera **candidata**, no verificada en producción.

| Eje | Significado | Distinción |
|---|---|---|
| `big_idea` | Promesa central reconocible | NO es formato ni título |
| `persona_need` | Necesidad, motivación u objeción | NO inferencia demográfica sensible |
| `angle` | Perspectiva narrativa/comercial | No sinónimo de hook |
| `hook` | Primera frase/imagen/dispositivo de atención | No prueba de resultado |
| `concept` | Propuesta concreta de ejecución | Puede heredar una big idea |
| `format` | STATIC, VIDEO, DEMO, UGC, etc. | No define por sí solo la promesa |
| `family_id` | Vinculación entre ejecuciones de la misma idea | No implica test independiente |
| `evidence_source` | Origen y scope de la señal | Privado, público, manual, etc. |
| `evidence_quality` | Resultado probado vs señal exploratoria | No sustituye análisis estadístico |
| `strategy_route` | Propio/externo/combinado | Selección por disponibilidad real |

**Antes de integrar:** localizar y reutilizar enums, etiquetas y schemas reales. Auditar cambios históricos de anuncios y coincidencias semánticas. No crear IDs globales que revelen inventario entre tenants.
