/** Detects when the user asks for the bill/check */
export const detectCuentaIntentUtil = (message: string): boolean => {
  const n = message.toLowerCase().trim();
  return /\b(cuenta|bill|check\s*please|check$|l'addition|addition|계산|cobrar|pagar|cerrar\s+(la\s+)?cuenta|close\s+tab|i'?m\s+done|we'?re\s+done|nous\s+avons\s+fini)\b/.test(
    n,
  );
};
