import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { extractAddItemIntentUtil } from '@/modules/messages/utils/extract-add-item-intent.util';
import { removeStopwordsUtil } from '@/modules/messages/utils/detect-stopwords.util';
import {
  findMenuItemFuzzyUtil,
  scoreMenuItem,
} from '@/modules/messages/utils/find-menu-item-fuzzy.util';

export interface FoundOrderItem {
  item: MenuItem;
  quantity: number;
  notes: string | null;
}

/**
 * Extracts negative-modifier phrases ("sin X ni Y", "quitar Z") from a segment,
 * returning the cleaned product query and the formatted exclusion notes.
 * Handles 1-2 word ingredient names and "ni" / "e" connectors between exclusions.
 */
function extractNegativeNotes(segment: string): {
  productQuery: string;
  negativeNotes: string | null;
} {
  const negParts: string[] = [];
  const productQuery = segment
    .replace(
      /\b(sin|quitar|remover|without|sans)\s+([\wáéíóúüñ]+(?:\s+[\wáéíóúüñ]+)?(?:\s+(?:ni|e)\s+[\wáéíóúüñ]+(?:\s+[\wáéíóúüñ]+)?)*)/gi,
      (_match: string, _prefix: string, ingredients: string) => {
        const items = ingredients
          .split(/\s+(?:ni|e)\s+/i)
          .map((s: string) => s.trim())
          .filter(Boolean);
        negParts.push(...items.map((i: string) => `Sin ${i}`));
        return '';
      },
    )
    .trim();
  return {
    productQuery,
    negativeNotes: negParts.length > 0 ? negParts.join(', ') : null,
  };
}

/**
 * Splits a user message into segments (by newlines, commas, conjunctions) and finds
 * ALL menu items mentioned. Negative modifiers ("sin X ni Y") are extracted as notes
 * and do NOT trigger a separate product lookup.
 *
 * Returns an array of { item, quantity, notes } for each product found.
 * Returns an empty array if nothing matches.
 */
export const findAllMenuItemsInMessage = (
  message: string,
  menuItems: MenuItem[],
): FoundOrderItem[] => {
  if (!message || !menuItems?.length) return [];

  // Split on newlines first, then conjunctions / list separators within each line.
  // "y" is treated as a product separator, not as an ingredient connector inside "sin ... y ..."
  // (use "ni" / "e" to chain exclusions: "sin guacamole ni tomate").
  const segments = message
    .split(/\n+/)
    .flatMap((line) =>
      line.split(
        /\s*[,;]\s*|\s+(?:y|and|et|와|tambien|también|además|ademas|plus|aussi)\s+/i,
      ),
    )
    .map((s) => s.trim())
    .filter((s) => removeStopwordsUtil(s).length > 0);

  const results: FoundOrderItem[] = [];
  const usedItemIds = new Set<string>();

  for (const segment of segments) {
    // Extract "sin X ni Y" style notes before product matching to avoid false matches
    const { productQuery, negativeNotes } = extractNegativeNotes(segment);

    // Segment is purely a negative modifier → attach as note to the previous item
    if (removeStopwordsUtil(productQuery).length === 0) {
      if (negativeNotes && results.length > 0) {
        const last = results[results.length - 1];
        last.notes = last.notes
          ? `${last.notes}, ${negativeNotes}`
          : negativeNotes;
      }
      continue;
    }

    // Find product in the cleaned query (negative modifier words removed)
    const found = findMenuItemFuzzyUtil(productQuery, menuItems);
    if (found && !usedItemIds.has(found.id)) {
      const { quantity, notes: extraNotes } =
        extractAddItemIntentUtil(productQuery);
      const noteParts: string[] = [];
      if (negativeNotes) noteParts.push(negativeNotes);
      if (extraNotes) noteParts.push(extraNotes);
      const allNotes = noteParts.length > 0 ? noteParts.join(', ') : null;
      results.push({ item: found, quantity, notes: allNotes });
      usedItemIds.add(found.id);
    }
  }

  // If single-segment message matched nothing, try to find multiple items
  // by scoring all items and picking top distinct ones (for "hamburguesa y cerveza" typed together)
  if (results.length === 0 && segments.length === 1) {
    const cleaned = removeStopwordsUtil(message);
    const words = cleaned.split(/\s+/).filter((w) => w.length > 2);

    if (words.length >= 2) {
      for (const word of words) {
        const found = findMenuItemFuzzyUtil(word, menuItems);
        if (found && !usedItemIds.has(found.id)) {
          const s = scoreMenuItem(word, found);
          if (s >= 0.5) {
            results.push({ item: found, quantity: 1, notes: null });
            usedItemIds.add(found.id);
          }
        }
      }
    }
  }

  return results;
};
