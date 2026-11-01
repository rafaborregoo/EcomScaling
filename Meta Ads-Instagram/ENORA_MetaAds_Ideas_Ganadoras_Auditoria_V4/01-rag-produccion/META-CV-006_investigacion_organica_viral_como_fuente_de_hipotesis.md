---
id: META-CV-006
titulo: "Investigacion organica viral como fuente de hipotesis"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "10:23–12:39"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Investigacion organica viral como fuente de hipotesis

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (10:23–12:39)
Segundo framework: explorar Reels y TikTok orgánicos sobre un problema/persona, buscar patrones que se repiten, especialmente publicaciones con resultados llamativos en cuentas pequeñas, y usar guiones/mensajes como inspiración. El procedimiento se describe como un SOP, pero no se comparte íntegramente.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
Definir ruta `EXPLORACION_ORGANICA` como **investigación exploratoria** cuando falta histórico o se exploran nuevos públicos; el engagement orgánico es señal creativa, no prueba de rentabilidad publicitaria.

## 3. Datos necesarios y procedencia
- Muestras de publicaciones obtenidas legalmente; visualizaciones, antigüedad, seguidores aproximados, fuentes y fecha de observación.
- Disponibilidad de APIs/autorizaciones o insumos aportados por el tenant.
- No asumir acceso a TikTok, Instagram orgánico, transcripciones o scraping por existir integración Meta Ads.

## 4. Procedimiento o regla candidata
1. Partir de necesidad/idea, no de lista de vídeos virales sin relación con el producto.
2. Recopilar ejemplos con fecha, contexto y permiso.
3. Etiquetar lenguaje, motivo, formato y señal de engagement con limitaciones.
4. Formular una hipótesis original adaptada al producto, con test de pago separado.
5. Nunca reproducir assets, guiones o marcas ajenas sin autorización.

## 5. Restricciones y riesgos
- Viralidad orgánica ≠ retorno comercial.
- Seguidores y visualizaciones no bastan para estimar uplift; no hay benchmarks medidos en la fuente.
- La API puede no dar los datos requeridos; no construir un scraper clandestino como solución por defecto.

## 6. Ejemplos de aplicación y de rechazo
Aceptable: “tema prometedor para explorar; sin datos de CPA/ROAS”. Rechazar: “este Reel viral hará que tu campaña sea rentable”.

## 7. Encaje incremental / comprobación de duplicados
V02 ya sugiere publicar orgánico como prueba y V03 mirar tendencias. V04 aporta **patrones repetidos y búsqueda por necesidad**; fusionar si no hay capacidad nueva.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
