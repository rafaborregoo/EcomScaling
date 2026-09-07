/**
 * Normalizacion del hex que sale del selector de color.
 *
 * Vive aparte del componente para poder probarse sin arrastrar React ni
 * HeroUI, y porque las dos reglas de aqui son las que rompian el selector en
 * silencio.
 */

/**
 * El HTML de email solo acepta #RRGGBB. Cuando el canal alpha baja de 1,
 * `Color.toString("hex")` devuelve #RRGGBBAA y el cliente de correo se come el
 * color entero.
 */
export function toEmailHex(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return /^#[0-9a-f]{6,8}$/.test(trimmed) ? trimmed.slice(0, 7) : "#000000";
}

/**
 * Compara dos hex ignorando mayusculas y canal alpha.
 *
 * Es la guarda que decide si el color que llega de fuera es OTRO color o el
 * mismo que acaba de emitir el selector. react-aria devuelve el hex en
 * mayusculas y la app lo guarda en minusculas: comparando en crudo, cada
 * arrastre parece un cambio externo, el selector se reinicia y el tirador
 * vuelve al sitio. Se ve exactamente como "el selector no funciona".
 */
export function sameHex(a: string, b: string): boolean {
  return toEmailHex(a) === toEmailHex(b);
}
