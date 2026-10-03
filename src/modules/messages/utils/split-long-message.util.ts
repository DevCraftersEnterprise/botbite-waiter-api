const MAX_WHATSAPP_LENGTH = 1600;

/**
 * Splits a long message into chunks that fit within WhatsApp's character limit
 * while preserving formatting and readability.
 *
 * @param message - The message to split
 * @param maxLength - Maximum length per chunk (default: 1600 for WhatsApp)
 * @returns Array of message chunks
 */
export const splitLongMessageUtil = (
  message: string,
  maxLength: number = MAX_WHATSAPP_LENGTH,
): string[] => {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  const lines = message.split('\n');
  let currentChunk = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const potentialChunk = currentChunk ? `${currentChunk}\n${line}` : line;

    // If adding this line would exceed the limit
    if (potentialChunk.length > maxLength) {
      // If current chunk is not empty, save it
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        // If single line is too long, split it by words
        const words = line.split(' ');
        let wordChunk = '';

        for (const word of words) {
          const potentialWordChunk = wordChunk ? `${wordChunk} ${word}` : word;

          if (potentialWordChunk.length > maxLength) {
            if (wordChunk) {
              chunks.push(wordChunk);
              wordChunk = word;
            } else {
              // Single word is too long, force split
              chunks.push(word.substring(0, maxLength));
              wordChunk = word.substring(maxLength);
            }
          } else {
            wordChunk = potentialWordChunk;
          }
        }

        if (wordChunk) {
          currentChunk = wordChunk;
        }
      }
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Add "continúa..." indicator to all chunks except the last
  return chunks.map((chunk, index) => {
    if (index < chunks.length - 1) {
      return `${chunk}\n\n📝 (continúa...)`;
    }
    return chunk;
  });
};
