import fs from "node:fs";
import path from "node:path";

// Calendario de vídeos de Instagram (platform_admin). Los datos y los MP4 viven en
// `video/contenido/` del repositorio y solo existen en local: en un despliegue sin esa
// carpeta la respuesta es `available: false`, no un error.

const ASSET_TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png" };

function contentDir(): string | null {
  for (const base of [process.cwd(), path.join(process.cwd(), ".."), path.join(process.cwd(), "..", "..")]) {
    const dir = path.join(base, "video", "contenido");
    if (fs.existsSync(path.join(dir, "calendario.json"))) return dir;
  }
  return null;
}

function readJson(dir: string, file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch {
    return null;
  }
}

export function loadVideoCalendar() {
  const dir = contentDir();
  if (!dir) return { available: false as const };
  return {
    available: true as const,
    calendario: readJson(dir, "calendario.json"),
    catalogo: readJson(dir, "catalogo.json"),
    ideas: readJson(dir, "ideas.json"),
    plan: readJson(dir, "semana1.json"),
  };
}

/** Ruta absoluta de un MP4 o PNG de `videos/` o `portadas/`; null si no es válida. */
export function resolveVideoAsset(relative: string): { file: string; contentType: string } | null {
  const dir = contentDir();
  if (!dir) return null;
  const clean = relative.replace(/\\/g, "/");
  if (clean.includes("..") || !/^(videos|portadas)\//.test(clean)) return null;
  const contentType = ASSET_TYPES[path.extname(clean).toLowerCase()];
  if (!contentType) return null;
  const file = path.join(dir, clean);
  if (!file.startsWith(dir) || !fs.existsSync(file)) return null;
  return { file, contentType };
}
