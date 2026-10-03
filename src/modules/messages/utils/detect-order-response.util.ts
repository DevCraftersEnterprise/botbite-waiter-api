export type OrderResponse = 'confirm' | 'continue' | 'cancel' | null;

/**
 * Detects customer's response to the order confirmation prompt.
 * - confirm: sí/yes/oui/네
 * - continue: no/non/아니요 (continue adding)
 * - cancel: cancelar/cancel/annuler/취소 (restart order)
 */
export const detectOrderResponseUtil = (message: string): OrderResponse => {
  const n = message.toLowerCase().trim();

  // Confirm signals
  if (
    /^(s[ií!]|yes|oui|네|dale|listo|claro|confirmo|confirmar|andale|adelante|acepto|por\s+favor|perfecto|ok|okay)[\s.,!]*$/.test(
      n,
    ) ||
    /^s[ií]\s*,/.test(n) ||
    /\bconfirm[ao]?\b/.test(n)
  ) {
    return 'confirm';
  }

  // Cancel signals
  if (
    /\b(cancelar|cancel|annuler|취소|reiniciar|restart|empezar\s+de\s+nuevo|de\s+nuevo)\b/.test(
      n,
    )
  ) {
    return 'cancel';
  }

  // Continue signals (no)
  if (/^(no|non|nope|아니요|아니오)[\s.,!]*$/.test(n) || /^no\s*,/.test(n)) {
    return 'continue';
  }

  return null;
};
