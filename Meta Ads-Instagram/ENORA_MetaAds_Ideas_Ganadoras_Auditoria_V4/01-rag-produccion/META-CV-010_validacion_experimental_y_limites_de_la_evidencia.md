---
id: META-CV-010
titulo: "Validacion experimental y limites de la evidencia"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "04:06–06:18; 06:18–10:23; 14:10–15:18"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Validacion experimental y limites de la evidencia

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (04:06–06:18; 06:18–10:23; 14:10–15:18)
El vídeo recomienda validar ideas de forma simple y rápida, reutilizar aprendizajes previos y priorizar lo que parece escalable. Parte de estas apreciaciones son experiencia subjetiva de la ponente y no ensayos controlados.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
Convertir consejos en **hipótesis contrastables**, con KPI definido antes del test, volumen suficiente, coste de aprendizaje y criterios de decisión; reportar incertidumbre en vez de porcentajes arbitrarios.

## 3. Datos necesarios y procedencia
- Objetivo del experimento, presupuesto, fecha, audiencias, eventos medidos, métricas de control, coste variable y cambios.
- Evidencia de datos y seguimiento autorizado en Meta/Shopify; sincronización temporal.
- Posible análisis inferencial cuando haya observaciones adecuadas.

## 4. Procedimiento o regla candidata
1. Formular hipótesis que distinga concepto vs formato.
2. Definir métrica de éxito según objetivo: tasa de compra, CPA, contribución, CTR, etc.
3. Acordar umbral económico y reglas de parada antes del lanzamiento.
4. Describir resultado con muestra y limitaciones; no prometer significación por pocos eventos.
5. Actualizar el aprendizaje local y siguiente iteración solamente si se implementa ese flujo.

## 5. Restricciones y riesgos
- No automatizar cambios de presupuesto ni publicación a partir de señales débiles.
- ROAS no equivale a beneficio; escala potencial no equivale a escalabilidad demostrada.
- Si falta un control o muestra, describir correlación y no causalidad.

## 6. Ejemplos de aplicación y de rechazo
Aceptar: “formato B fue mejor en CTR, pero no hay compras suficientes para elegir ganador de negocio”. Rechazar: “más alcance confirma que el anuncio convierte”.

## 7. Encaje incremental / comprobación de duplicados
V01 y V02 ya cubren métricas y criterios de optimización; V03 experimentos creativos. Consolidar un único estándar económico/estadístico si existe.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
