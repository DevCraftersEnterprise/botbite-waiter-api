/**
 * Los importes se operan en centavos: `numeric` llega de Postgres como texto y
 * sumar pesos en flotante deja residuos.
 */
export const toCents = (amount: number | string): number =>
  Math.round(Number(amount) * 100);

export const fromCents = (cents: number): number => cents / 100;
