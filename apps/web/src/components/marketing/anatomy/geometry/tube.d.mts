export interface TubePiece {
  body: string;
  shine: string;
  shade: string;
  edges: string;
  wide: boolean;
  rings: Array<{ d: string; alpha: number }>;
}

export function tubePieces(
  points: Array<[number, number, number]>,
  radius: number,
  projection: { origin: [number, number]; scale: number },
  options?: { spacing?: number; rings?: { pitch?: number; tone?: string } },
): TubePiece[];
