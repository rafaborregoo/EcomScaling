/** Límites reales de marketing_content_drafts. El output completo se conserva aparte. */
export function marketingDraftStorageFields(input: {
  preheader: string;
  purpose: string;
  tone: string;
}) {
  const limits = { preheader: 255, purpose: 500, tone: 120 } as const;
  const fields = { ...input };
  const overflow: Partial<typeof input> = {};
  const warnings: string[] = [];
  for (const key of ["preheader", "purpose", "tone"] as const) {
    if (fields[key].length > limits[key]) {
      overflow[key] = fields[key];
      fields[key] = fields[key].slice(0, limits[key]);
      warnings.push(
        `El campo ${key} se ha abreviado a ${limits[key]} caracteres para guardar el borrador. El original se conserva en los metadatos de generación.`,
      );
    }
  }
  return { ...fields, overflow, warnings };
}
