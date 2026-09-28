export type OverlayReviewBlock = {
  text: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  fontSize: number;
  lineHeight: number;
  bgColor: string | null;
};

export type OverlayReviewInput = {
  blocks: OverlayReviewBlock[];
  format: "single" | "carousel" | "story";
  ratio: "1:1" | "4:5" | "9:16";
  sourceHasOcr: boolean;
};

export type OverlayReviewWarning = {
  code:
    | "empty"
    | "unsafe_position"
    | "possible_overlap"
    | "contrast_unknown"
    | "small_mobile_text"
    | "long_copy"
    | "source_ocr"
    | "manual_visual_check";
  message: string;
};

function approximateHeightPct(block: OverlayReviewBlock, ratio: OverlayReviewInput["ratio"]) {
  const height = ratio === "1:1" ? 1080 : ratio === "4:5" ? 1350 : 1920;
  const widthPx = (1080 * block.widthPct) / 100;
  const charPerLine = Math.max(1, widthPx / Math.max(1, block.fontSize * 0.52));
  const lineCount = Math.max(1, Math.ceil(block.text.length / charPerLine));
  return Math.min(100, (block.fontSize * block.lineHeight * lineCount * 1.25 * 100) / height);
}

export function getOverlayReviewWarnings(input: OverlayReviewInput): OverlayReviewWarning[] {
  const warnings: OverlayReviewWarning[] = [];
  const { blocks, format, ratio, sourceHasOcr } = input;
  if (blocks.length === 0) {
    return [{ code: "empty", message: "Añade texto para revisar la composición." }];
  }

  const safe = format === "story"
    ? { left: 5, right: 95, top: 16, bottom: 72 }
    : { left: 5, right: 95, top: 5, bottom: 95 };
  const boxes = blocks.map((block) => ({
    left: block.xPct,
    right: block.xPct + block.widthPct,
    top: block.yPct,
    bottom: block.yPct + approximateHeightPct(block, ratio),
  }));

  if (boxes.some((box) => box.left < safe.left || box.right > safe.right || box.top < safe.top || box.bottom > safe.bottom)) {
    warnings.push({
      code: "unsafe_position",
      message: format === "story"
        ? "Hay texto cerca de los controles de Stories; muévelo dentro del área central segura."
        : "Hay texto cerca del borde y podría recortarse en algunas vistas; mantén un margen interior.",
    });
  }

  if (boxes.some((box, index) => boxes.slice(index + 1).some((other) =>
    box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top,
  ))) {
    warnings.push({ code: "possible_overlap", message: "Dos bloques pueden solaparse; comprueba el lienzo y la descarga antes de publicar." });
  }
  if (blocks.some((block) => block.text.length > 120)) {
    warnings.push({ code: "long_copy", message: "Hay texto largo; comprueba que se lea bien en móvil y no compita con la imagen." });
  }
  if (blocks.some((block) => block.fontSize < 36)) {
    warnings.push({ code: "small_mobile_text", message: "Algún texto puede quedar pequeño en móvil; revisa la previsualización reducida." });
  }
  if (blocks.some((block) => !block.bgColor)) {
    warnings.push({ code: "contrast_unknown", message: "El contraste sobre la fotografía no se puede medir con fiabilidad aquí; revisa cada zona o añade fondo al texto." });
  }
  if (sourceHasOcr) {
    warnings.push({ code: "source_ocr", message: "La imagen ya contiene texto detectado; evita duplicarlo o taparlo con el overlay." });
  }
  warnings.push({
    code: "manual_visual_check",
    message: "La detección no conoce con precisión la posición de sujetos y logotipos: verifica manualmente que el texto no los tape.",
  });
  return warnings;
}
