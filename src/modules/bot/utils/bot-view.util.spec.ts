import {
  toBotBranchConfig,
  toBotCatalog,
} from '@/modules/bot/utils/bot-view.util';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';

const item = (overrides: {
  id: string;
  name: string;
  category?: string;
  categorySort?: number;
  sortOrder?: number;
  isActive?: boolean;
  productActive?: boolean;
  categoryActive?: boolean;
}): MenuItem =>
  ({
    id: overrides.id,
    price: '95.50',
    isActive: overrides.isActive ?? true,
    shouldRecommend: false,
    variantGroup: null,
    sortOrder: overrides.sortOrder ?? 0,
    product: {
      name: overrides.name,
      description: null,
      imageUrl: null,
      isActive: overrides.productActive ?? true,
    },
    category: {
      name: overrides.category ?? 'BOTANAS',
      sortOrder: overrides.categorySort ?? 0,
      isActive: overrides.categoryActive ?? true,
    },
  }) as unknown as MenuItem;

describe('toBotCatalog', () => {
  it('sends the price as a number and empty texts instead of null', () => {
    expect(toBotCatalog([item({ id: '1', name: 'FALAFEL' })])).toEqual([
      {
        id: '1',
        name: 'FALAFEL',
        description: '',
        price: 95.5,
        category: 'BOTANAS',
        variantGroup: null,
        isActive: true,
        isRecommended: false,
        imageUrl: null,
      },
    ]);
  });

  it('keeps switched-off dishes, marked as inactive', () => {
    const catalog = toBotCatalog([
      item({ id: 'off-item', name: 'A', isActive: false }),
      item({ id: 'off-product', name: 'B', productActive: false }),
      item({ id: 'off-category', name: 'C', categoryActive: false }),
      item({ id: 'on', name: 'D' }),
    ]);

    expect(catalog.map(({ id, isActive }) => [id, isActive])).toEqual([
      ['off-item', false],
      ['off-product', false],
      ['off-category', false],
      ['on', true],
    ]);
  });

  it('orders by category and then by position', () => {
    const catalog = toBotCatalog([
      item({ id: 'pizza', name: 'A', category: 'PIZZAS', categorySort: 2 }),
      item({ id: 'second', name: 'B', categorySort: 1, sortOrder: 2 }),
      item({ id: 'first', name: 'Z', categorySort: 1, sortOrder: 1 }),
    ]);

    expect(catalog.map(({ id }) => id)).toEqual(['first', 'second', 'pizza']);
  });

  it('skips items whose product was deleted', () => {
    const orphan = { ...item({ id: '1', name: 'A' }), product: null };
    expect(toBotCatalog([orphan as unknown as MenuItem])).toEqual([]);
  });
});

describe('toBotBranchConfig', () => {
  it('converts Postgres numeric and time values', () => {
    const config = toBotBranchConfig({
      latitude: '27.535038',
      longitude: '-109.954031',
      dailyCloseTime: '23:30:00',
    } as unknown as Branch);

    expect(config.latitude).toBe(27.535038);
    expect(config.longitude).toBe(-109.954031);
    expect(config.dailyCloseTime).toBe('23:30');
  });

  it('keeps missing coordinates as null', () => {
    const config = toBotBranchConfig({
      latitude: null,
      longitude: null,
      dailyCloseTime: '23:30:00',
    } as unknown as Branch);

    expect(config.latitude).toBeNull();
    expect(config.longitude).toBeNull();
  });
});
