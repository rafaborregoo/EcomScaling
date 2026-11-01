---
id: META-CV-001
titulo: "Big idea separada de formato"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "01:50–03:04; 08:13–08:50"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Big idea separada de formato

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (01:50–03:04; 08:13–08:50)
La ponente explica que cada anuncio debe tener una **idea central identificable**; pide resumirla de forma concisa y muestra cómo un anuncio estilo “get ready with me” podía funcionar por una promesa de **rapidez**, no por el propio formato del vídeo.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
La unidad de conocimiento no debe ser “vídeo UGC” o “imagen estática”, sino `proposición/beneficio + necesidad + prueba`. El formato es una ejecución de esa idea. Distinguir `big_idea`, `angle`, `hook`, `message`, `creative_concept` y `format`.

## 3. Datos necesarios y procedencia
- Creativos accesibles de Meta: texto, titulares, nombres, medios y métricas cuando el scope lo permita.
- Catálogo Shopify y evidencia de producto autorizada.
- Etiquetado humano o clasificación multimodal solo si hay acceso legítimo a vídeos/imágenes; texto de anuncio no demuestra su contenido audiovisual.

## 4. Procedimiento o regla candidata
1. Describir el objetivo del anuncio y resumir en una frase su promesa central.
2. Vincular esa promesa con público/necesidad y evidencia aportada.
3. Registrar el **formato** por separado.
4. Si la evidencia no basta, declarar `idea_no_determinable` y pedir revisión, no inventar.

## 5. Restricciones y riesgos
- Un buen hook no acredita la propuesta central.
- No inferir que un anuncio fue ganador por su storytelling; exige resultados y métricas apropiadas.
- Evitar atribuir al consumidor características sensibles o claims de eficacia no respaldados.

## 6. Ejemplos de aplicación y de rechazo
Ejemplo ilustrativo: “rutina de maquillaje en cinco minutos” = idea de ahorro de tiempo; “vídeo selfie de una creadora” = formato. **No** concluir que el mismo concepto venderá otro producto o a otro público.

## 7. Encaje incremental / comprobación de duplicados
V03 ya trata `persona × ángulo × conciencia × formato` y briefs: fusionar definiciones existentes si son equivalentes; no crear una segunda taxonomía paralela.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
