Estamos reorganizando la base de conocimiento de **EcomScaling IA**.

Voy a proporcionarte uno o varios documentos `.md` que hasta ahora considerábamos «RAG». NO debes asumir que todo su contenido pertenece al RAG de producción.

Tu trabajo es actuar como **arquitecto de conocimiento e infraestructura de IA** y transformar cada documento en los artefactos correctos, sin perder información útil y sin inventar contenido que el documento no soporte.

## Estructura destino

Cada fase utiliza:

```text
fase-XX/
├── 00-corpus-maestro/
├── 01-rag-produccion/
├── 02-contratos-IA/
├── 03-runtime/
├── 04-policies-guardrails/
├── 05-experience-learning/
├── 06-tenant-context/
└── 99-auditoria/
```

### `00-corpus-maestro`
Es la fuente original. No la reescribas ni la consideres directamente RAG de producción.

### `01-rag-produccion`
Incluye EXCLUSIVAMENTE conocimiento estable que la IA debe poder recuperar para razonar correctamente:

- definiciones;
- principios;
- frameworks;
- criterios de decisión;
- conocimiento experto ecommerce;
- relaciones causales conceptuales;
- anti-patterns;
- reglas de interpretación;
- condiciones de aplicabilidad;
- ejemplos únicamente cuando aporten capacidad real de razonamiento.

Debe quedar limpio, autosuficiente, preciso y preparado para embeddings.

NO incluir aquí schemas, campos de contratos, estados técnicos, APIs, persistencia, permisos, implementación ni datos de clientes concretos.

### `02-contratos-IA`
Extrae requisitos que definan qué información deben intercambiar los componentes/agentes.

No inventes schemas si el documento no los define. Separa requisitos conceptuales de contratos ya implementados.

### `03-runtime`
Extrae comportamiento operacional:

- flujos;
- secuencias;
- estados;
- decisiones del sistema;
- lógica de orquestación;
- condiciones de ejecución;
- cuándo ocurre cada proceso.

### `04-policies-guardrails`
Extrae:

- límites;
- permisos;
- restricciones;
- gobernanza;
- controles;
- supervisión humana;
- autonomía;
- reglas que no deben depender únicamente del RAG.

### `05-experience-learning`
Extrae conceptos relacionados con:

- experiencias;
- outcomes;
- evidencia;
- aprendizajes;
- confidence;
- generalización;
- historial operacional;
- feedback loops;
- knowledge promotion/decay.

No confundas conocimiento experto estático con aprendizaje dinámico producido por cada ecommerce.

### `06-tenant-context`
Extrae únicamente conceptos que representen información configurable o específica de una tienda/cliente:

- objetivos;
- márgenes;
- mercados;
- canales;
- restricciones;
- madurez;
- configuración;
- contexto comercial.

No inventes datos concretos del tenant.

### `99-auditoria`
Genera un manifest indicando:

- documento fuente;
- archivos generados;
- destino de cada archivo;
- qué conceptos fueron clasificados en más de una capa;
- qué contenido era repetitivo;
- qué contenido se excluyó del RAG y por qué;
- posibles solapamientos con otros documentos;
- ninguna pérdida relevante detectada.

## Regla importante sobre duplicación

Un mismo concepto puede servir a varias capas.

Ejemplo:

```text
«Una recomendación debe indicar su expected outcome.»
```

Puede generar:

- conocimiento en `01-rag-produccion`;
- un requisito contractual en `02-contratos-IA`.

En estos casos no copies párrafos completos ciegamente. Adapta cada versión a la responsabilidad de su capa.

## Nomenclatura

Utiliza nombres en kebab-case y conserva siempre fase y bloque cuando existan.

Ejemplo:

```text
fase-09/
01-rag-produccion/
9.05-causalidad-y-atribucion.md

02-contratos-IA/
9.05-requisitos-contrato-atribucion.md

03-runtime/
9.05-flujo-evaluacion-causal.md

99-auditoria/
9.05-manifest-clasificacion.md
```

Si una categoría no tiene contenido real en el documento fuente, NO generes un `.md` vacío.

## Resultado que quiero

Cuando te entregue un `.md`:

1. Analízalo completo.
2. Dime brevemente en qué capas tiene contenido.
3. Devuélveme **varios `.md` separados**, uno por cada artefacto necesario.
4. Indica encima de cada archivo su ruta destino exacta.
5. Conserva toda la inteligencia útil del original.
6. Elimina redundancia del RAG de producción.
7. No conviertas requisitos técnicos en conocimiento RAG.
8. No conviertas conocimiento conceptual en código.
9. No inventes información ausente.
10. Genera siempre el `99-auditoria/...manifest-clasificacion.md`.

## Objetivo final

Estamos transformando:

```text
DOCUMENTOS MAESTROS MUY EXTENSOS
```

en:

```text
CORPUS MAESTRO
        ↓
RAG DE PRODUCCIÓN LIMPIO
+
CONTRATOS
+
RUNTIME
+
POLICIES
+
EXPERIENCE/LEARNING
+
TENANT CONTEXT
```

El objetivo no es hacer el RAG más pequeño por hacer.

El objetivo es que **solo se embeba aquello que realmente debe ser recuperado como conocimiento experto**, dejando las demás responsabilidades en la arquitectura correcta.

Cuando te pase el primer archivo, empieza directamente a clasificarlo y generar los `.md`. No vuelvas a explicarme esta metodología salvo que detectes un problema arquitectónico importante.