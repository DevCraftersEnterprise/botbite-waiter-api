/**
 * Detects purely social / greeting / farewell messages that contain no order intent.
 * e.g. "gracias", "buenas tardes", "hasta luego", "que tengas buen día"
 */
export const detectSocialMessageUtil = (message: string): boolean => {
  const lower = message.toLowerCase().trim();

  // Must be a SHORT message (≤ 8 words) to avoid false positives on long order messages
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) return false;

  return /\b(gracias|grax|grx|thx|thanks?|merci|감사|danke|buen[ao]s?\s+d[íi]as?|buen[ao]s?\s+tardes?|buen[ao]s?\s+noches?|buen\s+provecho|hasta\s+luego|hasta\s+pronto|hasta\s+la\s+vista|bye|chao|adios|adi[oó]s|have\s+a\s+(?:good|nice|great)|que\s+(?:te|le)\s+vaya|salut|au\s+revoir|bon\s+app[eé]tit|annyeong|안녕)\b/.test(
    lower,
  );
};
