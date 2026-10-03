/**
 * Detects requests to split the bill among multiple people.
 */
export const detectSplitBillIntentUtil = (message: string): boolean => {
  const lower = message.toLowerCase();
  return /\b(divid[ie]r|separar|separado|divididas|cuentas?\s+separadas?|split\s+(?:the\s+)?bill|separate\s+(?:check|bill)|분리|나누)\b/.test(
    lower,
  );
};
