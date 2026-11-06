# A11: piloto de subagentes · 2 de noviembre de 2026

Se ha implementado un coordinador de laboratorio y ejecutado un email con el mismo encargo, contexto y fotos de productos de Shopify que la comparación individual `a11-real-2026-11-02-v4`.

## Responsabilidades y resultados

| Etapa | Modelo candidato | Entrega | Coste API equivalente USD |
|---|---|---|---|
| Redacción | gpt-6.1-sol | Concepto, asunto, preheader, texto, CTA, productos y pendientes | 0,076102 |
| Diseño | claude-opus-5-5 | HTML responsive y contrato nativo de email | 0,325763–0,384056 |
| Revisión | claude-sonnet-5-5 | Dictamen y problemas, sin reescribir | 0,096679–0,136666 |
| Total del equipo | Tres llamadas | Un borrador | **0,498544–0,596824** |

Sol individual costó 0,106320 USD para ese mismo caso. El equipo cuesta aproximadamente **4,7–5,6 veces más**. No se ha demostrado todavía que la mejora visual compense ese incremento. Las cifras son estimaciones API sobre uso CLI, no facturas ni costes mensuales reales. La lectura desde cliente y consultor no genera otra pieza.

Sonnet aceptó el borrador para revisión humana y detectó pendientes de baja, dirección postal y remitente, además de una fuente que describía incorrectamente la narración previa como «aprobada». También señaló posibles ajustes de copy y presentación que requieren juicio humano. Los controles mecánicos no detectaron precios, fotos o destinos de producto ajenos al encargo.

**Revisión visual del email renderizado pendiente.** El revisor recibió código y fotos de origen, no una captura del email. No se ha certificado móvil, compatibilidad con clientes de correo, entregabilidad ni resultados comerciales. La herramienta de Computer Use detuvo el acceso previo por no poder verificar la URL activa; no se ha sustituido esa revisión por una afirmación de calidad visual.

## Dónde verlo

**Corrección solicitada por el propietario:** el ejemplo se muestra en el flujo normal, en **Marketing → Revisión de piezas (Contenido)**, con el título **Hydrogen · Una tabla protagonista**. Enlace directo al Estudio: `/marketing?section=crear&draft=a4e3a30e-1346-5490-af88-d3d684e71dc1`. Se retiró el laboratorio de las pestañas y la navegación de cliente/consultor. La pieza mantiene su HTML; los experimentos se excluyen de la lista ordinaria y la evidencia técnica previa se conserva en los archivos privados del piloto. Las indicaciones antiguas de laboratorio que siguen describen la primera ubicación, ya sustituida.

Cuenta `borregorafa99@gmail.com`, tienda E-NORA Demo; el consultor asignado comparte acceso mediante los permisos existentes.

- Marketing → Laboratorio de marketing: `/marketing?section=laboratorio`.
- Botón **Comparar Sol con el equipo**: email original individual frente a email del piloto.
- En el resultado del equipo: **Qué hizo cada subagente y cuánto costó**, con las tres respuestas originales.
- **Abrir borrador en el Estudio** permite editar la pieza; la comparación conserva la salida original.
- Borrador TEST: `a4e3a30e-1346-5490-af88-d3d684e71dc1`, sin programación ni publicación.

## Implementación y límites

- `apps/api/src/marketing-creative-pipeline.ts`: contratos tipados, ejecución ordenada y checkpoints; rechaza productos ajenos al encargo y detiene llamadas posteriores si falla contrato o presupuesto.
- Guarda respuestas, modelos, confirmación de ID, tiempos y precios por etapa. Codex no confirmó el ID servido; se muestra como solicitado. Claude confirmó Opus y Sonnet.
- No contiene herramientas de escritura externa ni envío. No hay bucles de autocorrección ni fallback implícito que oculte fallos.
- El presupuesto del piloto se comprueba entre etapas y después de cada llamada; no garantiza un techo duro de factura durante una llamada CLI en curso. Un consumo desconocido impide continuar.
- Los checkpoints son archivos privados del laboratorio y el resultado final/versionado vive en TEST. No es todavía un servicio productivo durable con reanudación distribuida.
- La asignación productiva de A11 no cambia. El coordinador está implementado y probado como piloto; no se ha conectado por defecto a todas las generaciones del editor.
- Un email no basta para escoger modelos por etapa. Meta e Instagram siguen necesitando producción de creativos, además de copy y dirección visual.

## Fallo corregido durante el piloto

El esquema del revisor generado por Zod anunciaba JSON Schema 2020-12, rechazado por Claude CLI antes de una respuesta de modelo. Se corrigió a draft-7. El recibo fallido se conservó y se repitió solo la revisión mediante `--retry-stage=review`. No se repitieron las dos llamadas anteriores. El intento rechazado no informó uso final; se conserva como intento sin coste medido, fuera del total conocido.

## Reproducción

Desde la raíz, con `.env.local` de TEST:

```powershell
npx dotenv -o -e .env.local -- tsx scripts/a11-specialists-pilot.mts
npx dotenv -o -e .env.local -- tsx scripts/a11-verify-real-comparison.mts --specialists
npx tsx --test apps/api/src/marketing-creative-pipeline.test.ts
```

Los recibos completados se reutilizan. Los fallos requieren reintento explícito, conservando el recibo anterior. La persistencia no sobrescribe ediciones humanas de un borrador existente.

Artefactos privados: `.e-nora-test-lab/a11-specialists-2026-11-02-v1/` (`trace.json`, recibos por etapa, `report.json`, `draft-manifest.json` y verificación de visibilidad).

## Verificación realizada

Cinco pruebas del coordinador y una de comparación correctas; typechecks API y web y ESLint de los componentes de comparación correctos. Verificación autenticada con ambos usuarios: un borrador y sus tres etapas visibles, versiones accesibles, filtros malformados rechazados y acceso a otra organización denegado. Página de laboratorio HTTP 200. Ningún envío, publicación o programación.

Siguiente decisión: revisión humana de esta pieza frente a Sol individual y medición de más encargos antes de activar el equipo en producción o elegir modelos definitivos por función.
