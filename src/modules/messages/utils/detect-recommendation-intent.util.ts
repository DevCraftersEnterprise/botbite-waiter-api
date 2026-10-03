/** Detects when the user asks for recommendations */
export const detectRecommendationIntentUtil = (message: string): boolean => {
  const n = message.toLowerCase();
  return /recomiend|recomendaci[oó]n|qu[eé]\s+me\s+recomiendan|qu[eé]\s+recomiendas|suggest|recommend(ation)?|conseill|recommand|추천|que\s+es\s+bueno|qu[eé]\s+hay\s+de\s+bueno/.test(
    n,
  );
};
