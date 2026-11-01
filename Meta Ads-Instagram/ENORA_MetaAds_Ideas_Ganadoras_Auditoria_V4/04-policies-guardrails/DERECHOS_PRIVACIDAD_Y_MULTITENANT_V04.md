# Riesgos de contenido, datos y cumplimiento

- **Derechos:** benchmarking sí, copia no. Asegurar licencias, derechos de imagen, contratos con creadores, música/stock, autorización de testimonios y cumplimiento de políticas Meta.
- **Fuentes externas:** no asumir acceso API, permiso de scraping ni uso comercial de plataformas. Auditar condiciones aplicables cuando corresponda.
- **Datos de reseñas/comentarios:** minimizar PII, handles y datos innecesarios. Agregar con criterio y fundamento jurídico; no persistir contenido identificable en embeddings por defecto.
- **Atributos sensibles:** el análisis de personas no debe inferir características de salud, embarazo, orientación, origen, datos de menores ni otras clases sensibles de personas identificables.
- **IA/terceros:** verificar privacidad, DPA, retención y transferencias para proveedores realmente utilizados por el producto antes de enviar datos privados.
- **Separación tenants:** conocimiento metodológico global ≠ resultados de cuenta del comercio; índices, contextos, tablas, trazas y caches deben estar aislados.
- **Publicación:** nunca asumir que generar una idea autoriza a cargar material, cambiar campañas o gastar presupuesto.

En la auditoría: pedir evidencias de implementación de permisos, RLS/scope, filtros, redacción PII y políticas; si faltan, `P0_BLOQUEO` en funciones que manipulen datos reales.
