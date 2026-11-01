// Lo mismo que acepta el bucket `avatars` (migración 20260830140000): validarlo
// aquí da un aviso en español antes de subir, en vez del error en inglés de
// Storage después.
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function avatarFileExtension(type: string) {
  return EXT_BY_TYPE[type] ?? "png";
}

/** Por qué no se puede subir este archivo, o null si vale. */
export function avatarFileProblem(file: { type: string; size: number }): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return "Ese formato no vale: sube una foto PNG, JPG, WEBP o GIF (las HEIC del iPhone, expórtalas antes a JPG).";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return `La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo son 2 MB.`;
  }
  return null;
}
