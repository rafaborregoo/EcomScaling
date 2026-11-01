---
id: META-CV-007
titulo: "Personas actuales futuras y brecha de enfoque"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "12:39–14:10"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Personas actuales futuras y brecha de enfoque

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (12:39–14:10)
La ponente distingue personas inferidas de comentarios/reseñas, personas a quienes se dirigen los anuncios existentes y oportunidades externas observadas en contenido orgánico. Reconoce que personas compradoras actuales no tienen por qué representar la mejor audiencia futura.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
Plantear análisis de **brecha entre necesidades documentadas, segmentos buscados por el mensaje y oportunidades aún no comprobadas**. Las personas son hipótesis agregadas, nunca atributos reales asignados a un individuo por LLM.

## 3. Datos necesarios y procedencia
- Reseñas/feedback con consentimiento/base jurídica y minimización adecuada.
- Mensajes publicitarios accesibles, datos comerciales agregados y señales orgánicas permitidas.
- Validación humana, criterios de segmentación lícitos y límites de representatividad.

## 4. Procedimiento o regla candidata
1. Delimitar persona basada en problema/uso/beneficio, no en datos sensibles.
2. Asociar cada idea a sus evidencias (reseña, mensaje, investigación externa).
3. Comparar cobertura del inventario creativo existente.
4. Etiquetar ausencias como `gap_potencial`, no oportunidades cuantificadas.
5. Proponer experimento con KPI; revisar resultado y posibles explicaciones alternativas.

## 5. Restricciones y riesgos
- No inferir salud, embarazo, orientación u otros rasgos especialmente protegidos.
- No inferir demografía desde fotografías o identidades de usuarios sin habilitación y legitimidad.
- Los compradores observados pueden reflejar sesgo de selección del marketing previo.

## 6. Ejemplos de aplicación y de rechazo
Ejemplo: “personas que buscan ahorro de tiempo” = hipótesis de necesidad; “usuarios con determinada enfermedad compran este producto” = inferencia prohibida sin datos y base legítima.

## 7. Encaje incremental / comprobación de duplicados
V03 ya tiene META-CR-005 (personas), META-CR-006 (matriz) y META-CR-008 (gaps). No duplicar taxonomías; ampliar origen orgánico externo si procede.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
