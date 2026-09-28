# Email Intelligence

Email Intelligence es la arquitectura de conocimiento e infraestructura de IA dedicada a Email Marketing Ecommerce, Lifecycle Marketing y Dropshipping. Organiza el conocimiento y los componentes futuros por responsabilidad para agentes y copilotos.

## Separación por responsabilidad

- `01-rag-produccion`: conocimiento que la IA recupera para comprender, razonar, diagnosticar, recomendar y explicar estrategias.
- `02-contratos-IA`: estructuras de entrada y salida de agentes y copilotos.
- `03-runtime`: lógica determinista que el software calcula o ejecuta.
- `04-policies-guardrails`: reglas duras, compliance y límites.
- `05-experience-learning`: resultados y aprendizajes reales.
- `06-tenant-context`: información particular de cada ecommerce.

El corpus maestro (`00-corpus-maestro`) conserva fuentes amplias; no todo ese contenido pasa a RAG. Auditoría (`99-auditoria`) permite revisar calidad y cobertura. El conocimiento se mantiene separado de la lógica de software; cada pieza que mezcle responsabilidades debe dividirse.

## Regla arquitectónica

```text
CONOCIMIENTO QUE LA IA DEBE SABER
→ 01-rag-produccion

INFORMACIÓN ESTRUCTURAL DE ENTRADA/SALIDA DE AGENTES
→ 02-contratos-IA

LÓGICA QUE EL SOFTWARE DEBE CALCULAR O EJECUTAR
→ 03-runtime

REGLAS DURAS, COMPLIANCE Y LÍMITES
→ 04-policies-guardrails

RESULTADOS Y APRENDIZAJES REALES
→ 05-experience-learning

INFORMACIÓN PARTICULAR DE CADA ECOMMERCE
→ 06-tenant-context
```

No mezclar conocimiento universal con contexto de tienda, resultados experimentales con reglas globales, recomendaciones de IA con acciones automáticas ni policies con heurísticas.

## Fases

- 00 Fundamentos
- 01 Cliente y lifecycle
- 02 Flows
- 03 Campañas
- 04 Copywriting
- 05 Brand Voice
- 06 Diseño de Email
- 07 Producto, Merchandising y Ofertas
- 08 Orquestación
- 09 Dropshipping
- 10 Deliverability y Compliance
- 11 Métricas y Analítica
- 12 Experimentación y Learning
- 13 Motores de Decisión
- 14 Contratos de IA
- 15 Runtime y Context Assembly
- 16 Agentes Especializados
- 17 Autonomía y Guardrails
- 18 Auditoría de Tienda
- 19 Mejora Continua
