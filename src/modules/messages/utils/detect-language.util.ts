/**
 * Detecta el idioma preferido del cliente basado en su mensaje
 */
export const detectLanguageUtil = (message: string): string | null => {
  const lowerMessage = message.toLowerCase().trim();

  // Detectar por emojis de bandera
  if (lowerMessage.includes('🇲🇽') || lowerMessage.includes('español')) {
    return 'es';
  }
  if (lowerMessage.includes('🇺🇸') || lowerMessage.includes('english')) {
    return 'en';
  }
  if (lowerMessage.includes('🇫🇷') || lowerMessage.includes('français')) {
    return 'fr';
  }
  if (
    lowerMessage.includes('🇰🇷') ||
    lowerMessage.includes('한국어') ||
    lowerMessage.includes('korean')
  ) {
    return 'ko';
  }
  if (
    lowerMessage.includes('🇩🇪') ||
    lowerMessage.includes('deutsch') ||
    lowerMessage.includes('german')
  ) {
    return 'de';
  }
  if (
    lowerMessage.includes('🇮🇹') ||
    lowerMessage.includes('italiano') ||
    lowerMessage.includes('italian')
  ) {
    return 'it';
  }
  if (
    lowerMessage.includes('🇵🇹') ||
    lowerMessage.includes('🇧🇷') ||
    lowerMessage.includes('português') ||
    lowerMessage.includes('portuguese')
  ) {
    return 'pt';
  }

  return null;
};
