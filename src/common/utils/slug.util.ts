const MAX_SLUG_LENGTH = 60;
// Deja lugar para el sufijo numérico de uniqueSlug.
const MAX_BASE_LENGTH = MAX_SLUG_LENGTH - 4;

/** Solo minúsculas, números y guiones entre palabras. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Convierte un nombre en slug: "Punto de Unión" → "punto-de-union". */
export const slugify = (text: string, fallback: string): string => {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/, '');

  return slug || fallback;
};

/** Agrega -2, -3... hasta encontrar un slug libre. */
export const uniqueSlug = async (
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> => {
  let candidate = base;

  for (let suffix = 2; await isTaken(candidate); suffix++) {
    candidate = `${base}-${suffix}`;
  }

  return candidate;
};

/**
 * Slug estándar de una sucursal: `<restaurante>-<sucursal>`, por ejemplo
 * "punto-de-union-cocorit". Es único por construcción, porque el del restaurante
 * ya lo es, y deja ver de qué negocio es cada QR, webhook y prefijo de Redis.
 */
export const branchSlug = (
  restaurantSlug: string,
  branchName: string,
): string =>
  slugify(`${restaurantSlug} ${branchName}`, `${restaurantSlug}-sucursal`);

/** Si un slug de sucursal sigue el estándar de su restaurante. */
export const isBranchSlugOf = (restaurantSlug: string, slug: string): boolean =>
  slug.startsWith(`${restaurantSlug}-`) &&
  slug.length > restaurantSlug.length + 1;
