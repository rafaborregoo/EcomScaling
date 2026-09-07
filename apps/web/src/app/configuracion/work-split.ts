/**
 * El reparto se guarda como peso relativo, no como porcentaje: dos consultores
 * a 100 son 50/50, y 100/0 es todo para el primero. Eso es comodo para el motor
 * -- normaliza solo -- y confuso en pantalla, donde "100 y 100" se lee como
 * 200%. Aqui se traduce a lo que va a pasar de verdad.
 */
export function toPercentages(weights: number[]): number[] {
  const positive = weights.map((weight) => Math.max(0, weight));
  const total = positive.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) return positive.map(() => 0);

  const raw = positive.map((weight) => (weight / total) * 100);
  const rounded = raw.map((value) => Math.round(value));

  // Tres al 33 suman 99: la diferencia va al que mas parte lleva, que es donde
  // menos se nota. Sin esto la pantalla dice que falta trabajo por repartir.
  const drift = 100 - rounded.reduce((sum, value) => sum + value, 0);
  if (drift !== 0) {
    let largest = 0;
    for (let index = 1; index < raw.length; index += 1) {
      if ((raw[index] ?? 0) > (raw[largest] ?? 0)) largest = index;
    }
    rounded[largest] = (rounded[largest] ?? 0) + drift;
  }

  return rounded;
}
