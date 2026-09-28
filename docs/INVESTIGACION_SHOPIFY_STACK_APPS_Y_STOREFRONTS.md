# Investigación Shopify: Stack, apps y análisis de tiendas

**Revisado:** 27 de septiembre de 2026. Fuentes consultadas únicamente en dominios oficiales de Shopify.

## Qué parece ser “Stack”

La coincidencia más probable es **Stack | AI Page Builder**, app de terceros publicada por **STACK** en Shopify App Store. Su ficha la describe como constructor con IA para páginas de producto, secciones, bundles, upsells y blogs; acepta instrucciones en lenguaje natural o capturas y permite refinar resultados por chat. La ficha muestra el distintivo **Built for Shopify**. [Ficha oficial de Stack](https://apps.shopify.com/stack)

La ficha incluye información útil para evaluar la app, como categoría, compatibilidad, funciones, precio, valoración, reseñas y distintivo. “Stack” no es una referencia inequívoca fuera de este resultado, así que conviene confirmar que sea la app que el usuario tenía en mente.

## Descubrimiento de apps en Shopify

Shopify permite descubrir apps mediante búsqueda por palabra clave, categorías y filtros como **Built for Shopify**. También muestra recomendaciones personalizadas según similitud entre tiendas —sector, ubicación, antigüedad y otros atributos— y, en ciertos casos, el uso de Shopify. Sidekick puede recomendar y comparar apps. Shopify aclara que estas recomendaciones no son anuncios pagados por los desarrolladores. [Cómo encontrar y elegir apps](https://help.shopify.com/en/manual/apps/finding-choosing-apps)

Las fichas publican datos para una evaluación curada; las directrices de publicación permiten categorías, tags y hasta 25 funciones estructuradas por categoría. [Directrices de fichas y descubrimiento](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)

**No encontré en la documentación oficial un API público para buscar o descargar en bloque el catálogo global del App Store ni sus reseñas.** La Partner API documentada ofrece datos de la organización Partner autenticada y sus recursos; su esquema contiene consultas como `app(id:)`, eventos y transacciones, no una consulta documentada para listar apps arbitrarias del marketplace. [Partner API](https://shopify.dev/docs/api/partner/2026-01) · [Esquema QueryRoot](https://shopify.dev/docs/api/partner/latest/objects/queryroot)

Por tanto, podemos mantener una selección editorial interna de apps mediante investigación de fichas oficiales, pero no asumir que Shopify proporciona un feed oficial para rastrear el marketplace automáticamente o reproducir sus recomendaciones personalizadas.

## APIs, scraping y análisis de storefronts

- Los términos de Shopify API prohíben copiar, scrapear, minar o crear derivados de la API, datos de comerciantes, cualquier tienda de comerciantes o servicios de Shopify, salvo autorización escrita de Shopify o cuando la ley aplicable impida la restricción. También prohíben usar la API para recopilación sistemática o automatizada de datos (incluidos scraping, minería, extracción y harvesting) y para crear índices de comercio o productos. [Términos de Shopify API, §2.2](https://www.shopify.com/legal/api-terms)
- Para una tienda cliente conectada, la vía prevista es usar APIs de Shopify con credenciales y permisos autorizados por el comerciante, solicitar solo los scopes necesarios y limitar el uso al servicio de la app. Shopify exige que las apps usen sus APIs y que pidan únicamente los permisos necesarios. [Términos de Shopify API, §2.1](https://www.shopify.com/legal/api-terms) · [Requisitos del App Store](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- La autorización del cliente no debe interpretarse como permiso para saltarse los límites contractuales de Shopify: los términos también contienen una prohibición específica de scraping de tiendas. Para auditar una tienda propia, conviene priorizar APIs autorizadas, métricas y revisión aprobada por el propietario. Antes de automatizar captura o extracción de páginas, aclarar el alcance con asesoría legal y, si corresponde, obtener autorización escrita de Shopify.
- Para tiendas de terceros sin conexión ni permiso del propietario, no construir extracción automatizada ni reutilizar contenido/datos como si fueran propios. La recomendación conservadora para E-NORA es no crear un crawler general de tiendas. Basar las recomendaciones en datos autorizados del cliente y conocimiento editorial, no en extracción masiva.

## Implicación para E-NORA

1. **Radar interno de apps y patrones:** catálogo curado con nombre, función, caso de uso, precio observado, requisitos, fecha y enlace a ficha oficial. Los agentes consultan este conocimiento para sugerir opciones relevantes; las notas internas no se exponen como propiedad intelectual al cliente. Evitar recopilar en masa fichas, reseñas o storefronts.
2. **Auditor de crecimiento por tienda conectada:** empieza por datos autorizados (catálogo, tema/configuración accesible, métricas Shopify y otras integraciones); propone oportunidades con evidencia, impacto estimado, esfuerzo, riesgos y forma de medir. Las recomendaciones de apps son opcionales y explican el ajuste; no prometen aumento de ventas sin evidencia propia o experimento.

El distintivo **Built for Shopify** es una señal verificable de calidad evaluada por Shopify, no prueba de que una app vaya a convertir mejor o sea adecuada para un cliente concreto. [Criterios del distintivo](https://help.shopify.com/en/manual/apps/finding-choosing-apps)

> **Conclusión:** Stack parece ser una app de creación/optimización de páginas con IA. Un agente de recomendaciones de apps y mejoras CRO sí puede aportar valor, pero debería combinar un catálogo curado con auditorías autorizadas de tiendas conectadas, no rastrear automáticamente el App Store ni tiendas ajenas.
