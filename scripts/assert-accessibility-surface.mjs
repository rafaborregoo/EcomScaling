import { readFile } from "node:fs/promises";
import process from "node:process";

const files = {
  globals: "apps/web/src/app/globals.css",
  shell: "apps/web/src/components/portal-shell.tsx",
  loading: "apps/web/src/components/ui/loading-block.tsx",
  error: "apps/web/src/components/ui/error-block.tsx",
  breadcrumbs: "apps/web/src/components/ui/breadcrumbs.tsx",
};
const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(file, "utf8")]),
  ),
);
const requirements = [
  ["globals", /:focus-visible\s*\{/, "visible keyboard focus"],
  ["globals", /\.skip-link/, "skip link styles"],
  ["globals", /prefers-reduced-motion/, "reduced motion support"],
  ["shell", /className=\"skip-link\"/, "skip link markup"],
  ["shell", /id=\"portal-content\"/, "main content target"],
  ["loading", /role=\"status\"/, "loading status landmark"],
  ["loading", /aria-live=\"polite\"/, "polite loading announcement"],
  ["error", /ErrorBlock/, "shared error component"],
  ["breadcrumbs", /item\.href\s*\?/, "breadcrumbs without empty href links"],
];
const violations = requirements
  .filter(([key, pattern]) => !pattern.test(sources[key]))
  .map(([key, , description]) => `${files[key]}: missing ${description}`);

if (violations.length > 0) {
  console.error("ACCESSIBILITY_SURFACE_VIOLATION");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("ACCESSIBILITY_SURFACE_OK: focus, skip link, reduced motion and live states are present");
