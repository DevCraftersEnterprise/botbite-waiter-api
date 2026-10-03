/** Detects when the user asks to see their current consumption/order summary */
export const detectConsumoIntentUtil = (message: string): boolean => {
  const n = message.toLowerCase().trim();
  return /\b(consumo|consumption|consommation|소비|resumen\s+de\s+pedido|ver\s+pedido|cuánto\s+(llevo|va)|mi\s+pedido|my\s+order|ma\s+commande|내\s+주문)\b/.test(
    n,
  );
};
