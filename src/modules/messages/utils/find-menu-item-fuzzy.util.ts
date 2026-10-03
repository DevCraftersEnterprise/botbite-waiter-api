import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { normalizeProductName } from '@/common/utils/normalize-product-name';
import { removeStopwordsUtil } from '@/modules/messages/utils/detect-stopwords.util';

export const FUZZY_THRESHOLD = 0.4;

/** Minimal Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

/** Returns true if two normalized words are a close enough match. */
function wordsMatch(qw: string, pw: string): boolean {
  if (pw === qw || pw.startsWith(qw) || qw.startsWith(pw)) return true;
  // Permitir 1 error para palabras ≥4, 2 para ≥7, y 3 para ≥10
  const minLen = Math.min(qw.length, pw.length);
  let maxDist = 0;
  if (minLen >= 10) maxDist = 3;
  else if (minLen >= 7) maxDist = 2;
  else if (minLen >= 4) maxDist = 1;
  return maxDist > 0 && levenshtein(qw, pw) <= maxDist;
}

/**
 * Scores how well a query matches a single MenuItem.
 * Returns a value in [0, 1]; higher is better.
 * Pass ignoreActive=true to score inactive items (for unavailability detection).
 */
export const scoreMenuItem = (
  query: string,
  item: MenuItem,
  ignoreActive = false,
): number => {
  if (!ignoreActive && (!item.isActive || !item.product)) return 0;
  if (!item.product) return 0;

  const cleaned = removeStopwordsUtil(query);
  if (!cleaned) return 0;

  const normQuery = normalizeProductName(cleaned);
  const queryWords = normQuery.split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return 0;

  // Always normalize to uppercase for consistent case-insensitive comparison.
  // The DB migration populated normalizedName with LOWER() which causes mismatch with queryWords (uppercase).
  const rawNorm = item.product.normalizedName || item.product.name;
  const productNorm = normalizeProductName(rawNorm);
  const productWords = productNorm.split(/\s+/).filter((w) => w.length > 2);
  if (productWords.length === 0) return 0;
  // Si el query coincide exactamente con el nombre de la categoría, no es un producto
  if (
    item.category &&
    query.trim().toLowerCase() === item.category.name.trim().toLowerCase()
  ) {
    return 0;
  }

  // ── Tier 1/2: Name-priority via exact word matching ──────────────────────
  // Scores above 1.0 so a direct name match always beats any fuzzy match (max 1.0).
  const exactMatchCount = queryWords.filter((qw) =>
    productWords.includes(qw),
  ).length;
  if (exactMatchCount > 0) {
    const allQueryMatched = exactMatchCount === queryWords.length;
    const allProductMatched = exactMatchCount === productWords.length;
    if (allQueryMatched && allProductMatched) return 2.0; // identical word sets
    if (allQueryMatched) return 1.5; // every query word found in product name
    if (allProductMatched) return 1.2; // every product word found in query
  }

  // ── Tier 3: Fuzzy word-level match ───────────────────────────────────────
  let matchCount = 0;
  for (const qw of queryWords) {
    if (productWords.some((pw) => wordsMatch(qw, pw))) {
      matchCount++;
    }
  }

  if (matchCount === 0) return 0;

  const productCoverage = matchCount / productWords.length;
  const queryCoverage = matchCount / queryWords.length;
  return (productCoverage + queryCoverage) / 2;
};

/**
 * Finds the best matching menu item for a given user query.
 * Pass ignoreActive=true to include inactive items (for unavailability detection).
 * Returns null when the query is ambiguous (multiple items score similarly above threshold).
 */
export const findMenuItemFuzzyUtil = (
  query: string,
  menuItems: MenuItem[],
  ignoreActive = false,
): MenuItem | null => {
  if (!query || !menuItems?.length) return null;

  let bestItem: MenuItem | null = null;
  let bestScore = 0;
  let secondBestScore = 0;

  for (const item of menuItems) {
    const score = scoreMenuItem(query, item, ignoreActive);
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestItem = item;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (bestScore < FUZZY_THRESHOLD) return null;

  // Ambiguity guard: if second item also scores above threshold and is close,
  // the query is too generic (e.g. 'pizza' matching 'pizza boneless' and 'pizza hawaiana')
  if (secondBestScore >= FUZZY_THRESHOLD && bestScore - secondBestScore < 0.15)
    return null;

  return bestItem;
};

/**
 * Returns the match type for a query against menu items:
 * - 'exact'   → one item scores ≥ 0.4 (clear match)
 * - 'partial' → query word matches a category name but no item scores ≥ 0.4
 * - 'mixed'   → multiple items score between 0.15–0.39 (confusing combination)
 * - 'none'    → no meaningful match at all
 */
export type FuzzyMatchType = 'exact' | 'partial' | 'mixed' | 'none';

export const classifyMenuMatch = (
  query: string,
  menuItems: MenuItem[],
): { type: FuzzyMatchType; item?: MenuItem } => {
  if (!query || !menuItems?.length) return { type: 'none' };

  const cleaned = removeStopwordsUtil(query);
  if (!cleaned) return { type: 'none' };

  let bestItem: MenuItem | null = null;
  let bestScore = 0;
  let secondBestScore = 0;
  let aboveFloorCount = 0;

  for (const item of menuItems) {
    const score = scoreMenuItem(query, item);
    if (score >= 0.15) aboveFloorCount++;
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestScore >= FUZZY_THRESHOLD) {
    // If two items score above threshold with similar scores, it's ambiguous → partial
    if (
      secondBestScore >= FUZZY_THRESHOLD &&
      bestScore - secondBestScore < 0.15
    ) {
      return { type: 'partial' };
    }
    return { type: 'exact', item: bestItem! };
  }

  // Check if query word appears in any category name → "partial" (e.g. "cerveza" → "CERVEZAS")
  const normCleaned = normalizeProductName(cleaned);
  const queryWords = normCleaned.split(/\s+/).filter((w) => w.length > 2);
  const categories = new Set(
    menuItems.map((i) => normalizeProductName(i.category?.name ?? '')),
  );

  for (const qw of queryWords) {
    for (const cat of categories) {
      if (cat.includes(qw) || qw.includes(cat.replace(/S$/, ''))) {
        return { type: 'partial' };
      }
    }
  }

  // Multiple items weakly match → "mixed" (combining elements from different products)
  if (aboveFloorCount >= 2 && bestScore >= 0.15) {
    return { type: 'mixed' };
  }

  return { type: 'none' };
};

/**
 * Returns all active menu items scoring ≥ minScore for the query, sorted by score descending.
 * Use this as a "worst-case" fallback to list candidates when no single item wins clearly.
 */
export const findMatchingMenuItemsUtil = (
  query: string,
  menuItems: MenuItem[],
  minScore = FUZZY_THRESHOLD,
): MenuItem[] => {
  if (!query || !menuItems?.length) return [];
  return menuItems
    .map((item) => ({ item, score: scoreMenuItem(query, item) }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};
