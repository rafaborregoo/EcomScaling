import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // SQO-01: esta regla (nueva en eslint-plugin-react-hooks, parte de la
      // preparacion para React Compiler) marca como error el patron estandar
      // "cargar datos al montar" (setIsLoading(true) al principio de una
      // funcion async invocada desde useEffect) -- exactamente lo que usan
      // todas las paginas de este repo para fetch-on-mount, sin bug real
      // detras. La alternativa "correcta" (useEffectEvent) no es estable
      // todavia. Downgrade a warning para poder anadir `npm run lint` a CI
      // sin reescribir 9 archivos con un patron que no tiene reemplazo
      // estable hoy; los warnings quedan visibles, no bloquean CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
