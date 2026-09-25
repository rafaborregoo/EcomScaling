# ADR-0017: RAG primero y fine-tuning solo para comportamiento estable

## Estado

Aceptada para el piloto — 2026-08-24.

## Decisión

E-NORA combinará:

1. **Prompt estructurado** como contrato: `ROLE`, `GOAL`, `CONTEXT`, `INPUT`, `RULES / CONSTRAINTS`, `TOOLS`, `OUTPUT`, `FAILURE BEHAVIOUR` y `EXAMPLES` opcional.
2. **RAG** para conocimiento cambiante, privado o específico de cada organización: métricas Shopify, futuros datos Meta/Klaviyo/Instagram, playbooks, transcripciones y documentos.
3. **Fine-tuning únicamente después de disponer de suficientes ejemplos anonimizados, etiquetados y evaluados**, para mejorar formato, estilo, clasificación o decisiones repetitivas; nunca para introducir datos actuales del cliente ni secretos.
4. **Evals antes y después**: comparar modelo base + prompt + RAG frente a cualquier modelo ajustado usando groundedness, exactitud, abstención, seguridad tenant, coste y latencia.

## Por qué

RAG resuelve conocimiento vivo: permite actualizar o retirar una fuente sin reentrenar y conservar evidencia por respuesta. Fine-tuning resuelve comportamiento: hace más consistente una forma de responder o clasificar, pero no sustituye la recuperación de datos actuales ni garantiza que el modelo recuerde cifras correctas.

Para el estado actual no hay corpus real suficiente y estable para justificar entrenamiento. El orden será:

```text
prompt estructurado -> tools/contratos -> RAG con provenance -> evals offline/shadow
-> dataset anonimizado y versionado -> experimento fine-tuning -> promoción solo si mejora
```

## Política operativa

- No subir transcripciones, datos de clientes, tokens ni PII a datasets de fine-tuning.
- El contexto recuperado queda separado del prompt de sistema y etiquetado como datos no confiables; nunca puede cambiar reglas o permisos.
- El agente debe abstenerse si RAG no devuelve evidencia suficiente.
- Un modelo ajustado, si llega, estará detrás del mismo contrato `AgentInput`/`AgentOutput`, `ToolLayer`, presupuesto y aprobación humana.
- No se promociona por “sonar mejor”: debe superar regresiones de grounding, seguridad, coste y latencia.

## Criterios para valorar fine-tuning

Solo se inicia un experimento cuando exista un dataset versionado con ejemplos representativos, etiquetas de calidad y evaluación separada. Candidatos: severidad, normalización de formatos, tono editorial y selección consistente de acciones. No candidatos: ventas recientes, catálogo, campañas activas, políticas del cliente o conocimiento de Meta/Klaviyo.

La documentación oficial de OpenAI trata fine-tuning como trabajos basados en archivos JSONL y una API específica de entrenamiento; debe gestionarse como experimento versionado, no como almacenamiento de conocimiento vivo. [Archivos para fine-tuning](https://platform.openai.com/docs/api-reference/files) · [API de fine-tuning](https://platform.openai.com/docs/api-reference/fine-tuning).

## Consecuencia

Se prepara ahora el prompt estructurado y RAG. Fine-tuning queda como `planned_experiment`, no como dependencia del piloto ni requisito para conectar Meta/Klaviyo/Instagram.
