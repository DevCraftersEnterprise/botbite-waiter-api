import { Logger } from '@nestjs/common';

/**
 * Detecta respuestas inválidas o inapropiadas relacionadas con mesas/ubicaciones
 * Incluye bromas, respuestas sin sentido, evasivas y spam cuando se menciona "mesa" o ubicación
 */
export const detectInvalidTableResponseUtil = (message: string): boolean => {
  const logger = new Logger('DetectInvalidTableResponse');
  const lowerMessage = message.toLowerCase().trim();

  const invalidTableResponses = [
    // Patrones de prueba básicos con "mesa"
    /mesa\s+(hola|mundo|test|prueba|abc|xyz)/,
    /en\s+la\s+mesa\s+(hola|mundo|test|prueba)/,

    // Bromas y respuestas jocosas que incluyen "mesa"
    /mesa\s+(tumbaste|tumba|mentira|mentiras|chiste|jaja|jeje|jiji|jojo|ja|je)/,
    /mesa\s+(tu\s+mam[aá]|tu\s+vieja|la\s+tuya|gracioso|broma)/,

    // Patrones específicos de respuestas vagas/evasivas que incluyen "mesa"
    /mesa\s+(ah[ií]|donde\s+sea|cualquiera|no\s+s[eé]|ni\s+idea|olvid[eé])/,
    /mesa\s+(no\s+me\s+acuerdo|creo\s+que|tal\s+vez)/,

    // Respuestas sin sentido con "mesa"
    /mesa\s+(asdf|qwerty|blabla|lalala|nanana|zzz)/,

    // Respuestas a question de ubicación sin "mesa" pero claramente inapropiadas
    // Solo cuando contiene palabras clave de ubicación cerca de términos inapropiados
    /(ubicaci[oó]n|location|table|terraza|barra|patio).{0,20}(tumbaste|tumba|mentira|chiste|jaja)/,
    /(tumbaste|tumba|mentira|chiste|jaja).{0,20}(ubicaci[oó]n|location|table|terraza|barra|patio)/,

    // Spam de caracteres repetidos (más de 4 repeticiones)
    /mesa.{0,5}(.)\1{4,}/, // Mesa aaaaaa, Mesa !!!!!, etc.

    // Insultos y vulgaridades que incluyen mesa o términos de ubicación
    /mesa\s+(idiota|est[uú]pid|tonto|pend\w+|cab\w+n|mier\w+|chin\w+)/,

    // Respuestas obviamente falsas o imposibles relacionadas con mesas
    /mesa\s+(mil|999|infinit|cero|negativ|inexistent)/,

    // Números claramente fuera de rango razonable para mesas (4+ dígitos)
    /mesa\s+([1-9]\d{3,}|\d{4,})/, // Mesa 1000, mesa 9999, etc.

    // Números con decimales o puntos (Mesa 3.24, Mesa 5.67, etc.)
    /mesa\s+\d+[.,]\d+/, // Mesa 3.24, Mesa 5,67, etc.
    /table\s+\d+[.,]\d+/, // Table 3.24, Table 5,67 (inglés)

    // Números decimales solos sin contexto (3.24, 5.67, etc.)
    // Solo cuando es el mensaje completo o casi (para evitar falsos positivos)
    /^\d+[.,]\d+$/, // 3.24, 5.67, etc. como mensaje completo

    // Spam de emojis (3+ emojis) cuando se menciona mesa o ubicación
    /mesa.{0,30}(😂|😭|🤣|😅|🙄|🤦|🤷|💀|🔥|👍|👎|❤️|💩){3,}/,
  ];

  const hasInvalidTableResponse = invalidTableResponses.some((pattern) =>
    pattern.test(lowerMessage),
  );

  // Log para debugging
  const isShortNumericMessage =
    /^\d+[.,]?\d*$/.test(lowerMessage) && lowerMessage.length <= 10;
  if (
    lowerMessage.includes('mesa') ||
    lowerMessage.includes('table') ||
    isShortNumericMessage
  ) {
    logger.debug(`Checking message: "${message}" -> "${lowerMessage}"`);
    logger.debug(`Invalid table response detected: ${hasInvalidTableResponse}`);

    if (hasInvalidTableResponse) {
      // Encontrar qué patrón coincidió
      const matchedPattern = invalidTableResponses.find((p) =>
        p.test(lowerMessage),
      );
      logger.warn(
        `Invalid table response: "${message}" matched pattern: ${matchedPattern}`,
      );
    }
  }

  return hasInvalidTableResponse;
};
