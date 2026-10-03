export interface AmenityDetectionResult {
  isAmenity: boolean;
  amenities: Record<string, number>;
}

const AMENITY_KEYWORDS: Record<string, string[]> = {
  tenedores: [
    'tenedor',
    'tenedores',
    'fork',
    'forks',
    'fourchette',
    'fourchettes',
  ],
  cuchillos: [
    'cuchillo',
    'cuchillos',
    'knife',
    'knives',
    'couteau',
    'couteaux',
  ],
  cucharas: [
    'cuchara',
    'cucharas',
    'spoon',
    'spoons',
    'cuillère',
    'cuillere',
    'cuillères',
  ],
  cubiertos: [
    'cubierto',
    'cubiertos',
    'utensil',
    'utensils',
    'cutlery',
    'couverts',
    'couvert',
  ],
  servilletas: [
    'servilleta',
    'servilletas',
    'napkin',
    'napkins',
    'serviette',
    'serviettes',
  ],
  popotes: [
    'popote',
    'popotes',
    'pajita',
    'pajitas',
    'straw',
    'straws',
    'paille',
    'pailles',
  ],
  vasos: ['vaso', 'vasos', 'glass', 'glasses', 'verre', 'verres'],
  sal: ['sal', 'salt', 'sel'],
  pimienta: ['pimienta', 'pepper', 'poivre'],
  limones: [
    'limon',
    'limón',
    'limones',
    'lime',
    'limes',
    'lemon',
    'lemons',
    'citron',
    'citrons',
  ],
  salsas: ['salsa', 'salsas', 'sauce', 'sauces'],
};

const extractQuantity = (message: string): number => {
  const numMatch = message.match(/\b(\d+)\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    return n > 0 && n <= 20 ? n : 1;
  }
  const words: Record<string, number> = {
    una: 1,
    uno: 1,
    one: 1,
    un: 1,
    une: 1,
    dos: 2,
    two: 2,
    deux: 2,
    tres: 3,
    three: 3,
    trois: 3,
    cuatro: 4,
    four: 4,
    quatre: 4,
    cinco: 5,
    five: 5,
    cinq: 5,
  };
  const lower = message.toLowerCase();
  for (const [word, num] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return num;
  }
  return 1;
};

/** Detects amenity requests in user messages (forks, napkins, spoons, etc.) */
export const detectAmenityIntentUtil = (
  message: string,
): AmenityDetectionResult => {
  // Split into individual words (strip punctuation) so "salchicha" does NOT match "sal".
  const words = new Set(
    message
      .toLowerCase()
      .replace(/[^a-záéíóúüñ0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
  const amenities: Record<string, number> = {};

  for (const [key, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    if (keywords.some((kw) => words.has(kw))) {
      amenities[key] = extractQuantity(message);
    }
  }

  return { isAmenity: Object.keys(amenities).length > 0, amenities };
};
