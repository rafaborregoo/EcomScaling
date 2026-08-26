// El narrowing implicito de TypeScript sobre `if (!x.ok)` en un union
// discriminado `{ ok: boolean }` no es fiable entre entornos: el mismo
// commit y la misma version de TS (5.9.3) compilan limpio en Windows pero
// fallan con TS2322/TS2339 en el build de Vercel (Linux). Confirmado
// repetidas veces en apps/api durante el diagnostico de un fallo de deploy
// (2026-08-26). Usa este type guard en lugar de `!result.ok` en cualquier
// sitio donde se lea la forma narroweada despues del guard.
export function isErr<T extends { ok: boolean }>(
  result: T,
): result is Extract<T, { ok: false }> {
  return result.ok === false;
}
