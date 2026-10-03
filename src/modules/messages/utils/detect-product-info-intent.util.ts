/** Detects when the user asks for information about a specific product */
export const detectProductInfoIntentUtil = (message: string): boolean => {
  const n = message.toLowerCase();
  return /qu[eé]\s+(es|tiene|lleva|contiene|trae|incluye)|informaci[oó]n\b|\binfo\b|\bdetalles?\b|cu[eé]ntame\s+(de|sobre)|descr[ií]b[ei]|what\s+(is|are|does)\s+|tell\s+me\s+about|what'?s\s+in|qu'?est.ce|décri[vt]|정보|설명|어떤/.test(
    n,
  );
};
