export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | null;

/** Detects payment method from user message (EFECTIVO or TARJETA) */
export const detectPaymentMethodInputUtil = (
  message: string,
): PaymentMethod => {
  const n = message.toLowerCase().trim();

  if (
    /\b(efectivo|cash|espèces|especes|현금|en\s+efectivo|pago\s+en\s+efectivo)\b/.test(
      n,
    )
  ) {
    return 'EFECTIVO';
  }
  if (
    /\b(tarjeta|card|carte|카드|débito|debito|crédito|credito|visa|mastercard|amex|debit|credit)\b/.test(
      n,
    )
  ) {
    return 'TARJETA';
  }

  return null;
};
