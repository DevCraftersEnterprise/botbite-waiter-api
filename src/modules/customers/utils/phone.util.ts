/** Mismo formato que los teléfonos de la base: + y dígitos. */
export const normalizePhone = (phone: string): string =>
  `+${phone.replace(/\D/g, '')}`;
