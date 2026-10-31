import { SLUG_PATTERN, slugify, uniqueSlug } from '@/common/utils/slug.util';

describe('slugify', () => {
  it('removes accents and joins words with hyphens', () => {
    expect(slugify('Punto de Unión', 'x')).toBe('punto-de-union');
    expect(slugify('  PRUEBA   MARISCOS!! ', 'x')).toBe('prueba-mariscos');
  });

  it('uses the fallback when nothing is left', () => {
    expect(slugify('¡¡¡', 'sucursal')).toBe('sucursal');
  });

  it('leaves room for the numeric suffix and always matches the pattern', () => {
    const slug = slugify(`${'a'.repeat(55)} ${'b'.repeat(10)}`, 'x');
    expect(slug.length).toBeLessThanOrEqual(56);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});

describe('uniqueSlug', () => {
  it('keeps the slug when it is free', async () => {
    await expect(
      uniqueSlug('centro', () => Promise.resolve(false)),
    ).resolves.toBe('centro');
  });

  it('adds the first free suffix', async () => {
    const taken = new Set(['centro', 'centro-2']);
    await expect(
      uniqueSlug('centro', (slug) => Promise.resolve(taken.has(slug))),
    ).resolves.toBe('centro-3');
  });
});
