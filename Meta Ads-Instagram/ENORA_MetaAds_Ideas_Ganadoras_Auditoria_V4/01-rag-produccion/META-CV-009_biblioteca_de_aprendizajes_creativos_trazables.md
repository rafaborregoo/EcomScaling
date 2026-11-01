---
id: META-CV-009
titulo: "Biblioteca de aprendizajes creativos trazables"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "03:04–04:06; 07:43–10:23; 14:10–15:18"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Biblioteca de aprendizajes creativos trazables

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (03:04–04:06; 07:43–10:23; 14:10–15:18)
La fuente describe el valor de reconocer ideas repetidas, trasladar mensajes ganadores a nuevas ejecuciones y mantener continuidad creativa. No muestra un esquema de base de datos ni un sistema de memoria implementado.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
Propuesta de producto: una **biblioteca de hipótesis y aprendizajes por tenant** con vínculo a evidencias y versiones, independiente del corpus RAG genérico. No guardar resultados de un cliente como conocimiento universal de otros.

## 3. Datos necesarios y procedencia
- IDs de anuncios y assets, ventanas de evaluación, métricas, fecha de test y contexto de oferta.
- IDs de ideas y relaciones entre variaciones, con provenance/consentimiento para fuentes externas.
- Logs, RLS y políticas de retención acordes con el sistema real.

## 4. Procedimiento o regla candidata
1. Registrar cada idea como hipótesis con fuente y fecha.
2. Asociar creativos de distintas ejecuciones.
3. Guardar resultados **con ventana y definiciones**, incluyendo negativos y sin datos.
4. Promover a “aprendizaje local” solo mediante criterio verificable y control de sesgos.
5. No promover automáticamente aprendizaje local a conocimiento global.

## 5. Restricciones y riesgos
- No inventar ni desplegar nueva tabla sin auditar modelo real.
- Versionar para no confundir modificaciones posteriores de un anuncio con resultados históricos.
- Evitar embeddings con PII y datos privativos sin justificación.

## 6. Ejemplos de aplicación y de rechazo
Ejemplo registro: IDEA-042 «ahorro de tiempo» → anuncio A vídeo, anuncio B estática, métricas comparables; el sistema puede decir «hipótesis apoyada» sin garantizar causalidad.

## 7. Encaje incremental / comprobación de duplicados
V03 ya plantea `05-experience-learning` y contratos; V04 es complemento para parentesco, provenance, estados y separación de aprendizajes locales vs globales.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
