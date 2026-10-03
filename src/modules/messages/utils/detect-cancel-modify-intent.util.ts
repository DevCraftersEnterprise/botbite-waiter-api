/**
 * Detects when the user explicitly uses "cancelar" or "modificar" keywords,
 * which—for confirmed orders—should trigger a polite refusal.
 */
export const detectCancelKeywordUtil = (message: string): boolean => {
  const lower = message.toLowerCase();
  return /\b(cancel[ae]r?|cancela|cancelar|cancelo|annuler|취소)\b/.test(lower);
};

export const detectModifyKeywordUtil = (message: string): boolean => {
  const lower = message.toLowerCase();
  return /\b(modific[ae]r?|modifica|cambiar|cambio|cambia|changer|수정|변경)\b/.test(
    lower,
  );
};
