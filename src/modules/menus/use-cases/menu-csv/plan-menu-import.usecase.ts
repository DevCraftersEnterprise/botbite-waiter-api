import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Category } from '@/modules/categories/entities/category.entity';
import {
  MAX_CATEGORY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_FAMILY_LENGTH,
  MAX_NAME_LENGTH,
  MAX_ROWS,
  MenuCsvColumn,
  REQUIRED_COLUMNS,
  areSimilarNames,
  cleanText,
  decodeCsvBuffer,
  detectSeparator,
  matchKey,
  normalizeHeader,
  parseCsv,
  parsePhotoUrl,
  parsePrice,
  parseYesNo,
  unescapeCell,
} from '@/modules/menus/csv/menu-csv.format';
import { MenuPhotoService } from '@/modules/menus/csv/menu-photo.service';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import {
  MenuImportAction,
  MenuImportIssue,
  MenuImportPreview,
} from '@/modules/menus/interfaces/menu-csv.interfaces';
import { Product } from '@/modules/products/entities/product.entity';

/** Una fila válida del archivo, con lo que ya existe en la base. */
export interface PlannedMenuRow {
  row: number;
  key: string;
  name: string;
  /** undefined = la celda venía vacía y no se cambia. */
  description?: string;
  categoryKey: string;
  categoryName: string;
  price: number;
  family?: string;
  recommended: boolean | null;
  active: boolean | null;
  photoUrl: string | null;
  product: Product | null;
  menuItem: MenuItem | null;
  action: MenuImportAction;
}

type ParsedMenuRow = Omit<
  PlannedMenuRow,
  'product' | 'menuItem' | 'action' | 'categoryKey'
>;

export interface MenuImportPlan {
  menuId: string;
  restaurantId: string;
  rows: PlannedMenuRow[];
  /** Categorías nuevas, en el orden del archivo. */
  newCategories: { key: string; name: string }[];
  categories: Category[];
  menuItems: MenuItem[];
  errors: MenuImportIssue[];
  warnings: MenuImportIssue[];
}

const groupBy = <T>(items: T[], keyOf: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
};

/**
 * Lee el CSV y decide qué se crea y qué se actualiza, sin guardar nada. Lo usan
 * la vista previa y la importación, así que las dos ven lo mismo.
 */
@Injectable()
export class PlanMenuImportUseCase {
  constructor(
    private readonly translationService: TranslationService,
    private readonly photos: MenuPhotoService,
  ) {}

  async execute(
    manager: EntityManager,
    menuId: string,
    buffer: Buffer,
    lang: string,
  ): Promise<MenuImportPlan> {
    const menu = await manager.findOne(Menu, {
      where: { id: menuId },
      relations: { branch: true },
    });
    if (!menu) throw new NotFoundException('Menu not found');

    const restaurantId = menu.branch.restaurantId;
    const [categories, products, menuItems] = await Promise.all([
      manager.find(Category, { where: { restaurantId } }),
      manager.find(Product, { where: { restaurantId } }),
      manager.find(MenuItem, {
        where: { menuId },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
    ]);

    const plan: MenuImportPlan = {
      menuId,
      restaurantId,
      rows: [],
      newCategories: [],
      categories,
      menuItems,
      errors: [],
      warnings: [],
    };

    const parsed = this.parse(buffer, plan, lang);
    if (plan.errors.length) return plan;

    this.resolve(parsed, plan, products, lang);
    return plan;
  }

  toPreview(plan: MenuImportPlan): MenuImportPreview {
    const count = (action: MenuImportAction) =>
      plan.rows.filter((row) => row.action === action).length;

    const rows = plan.rows.map((row) => ({
      row: row.row,
      name: row.name.toUpperCase(),
      category: row.categoryName.toUpperCase(),
      price: row.price,
      action: row.action,
      photo: this.photoAction(row.photoUrl),
    }));

    return {
      summary: {
        rows: plan.rows.length,
        categoriesToCreate: plan.newCategories.length,
        productsToCreate: count('create'),
        productsToAdd: count('add'),
        productsToUpdate: count('update'),
        photosToCopy: rows.filter((row) => row.photo === 'copy').length,
      },
      categoriesToCreate: plan.newCategories.map((category) => category.name),
      rows,
      errors: plan.errors,
      warnings: plan.warnings,
    };
  }

  photoAction(url: string | null): 'copy' | 'keep' | null {
    if (!url) return null;
    return this.photos.isOwnUrl(url) ? 'keep' : 'copy';
  }

  private parse(
    buffer: Buffer,
    plan: MenuImportPlan,
    lang: string,
  ): ParsedMenuRow[] {
    const t = (key: string, vars?: Record<string, string>) =>
      this.translationService.translate(`menu_csv.${key}`, lang, vars);
    const issue = (
      row: number | null,
      column: MenuCsvColumn | null,
      key: string,
      vars?: Record<string, string>,
    ): MenuImportIssue => ({ row, column, message: t(key, vars) });

    const text = decodeCsvBuffer(buffer);
    const [header = [], ...body] = parseCsv(text, detectSeparator(text));
    const records = body
      .map((cells, i) => ({ row: i + 2, cells }))
      .filter(({ cells }) => cells.some((cell) => cell.trim()));

    if (!header.some((cell) => cell.trim()) || !records.length) {
      plan.errors.push(issue(null, null, 'empty_file'));
      return [];
    }
    if (records.length > MAX_ROWS) {
      plan.errors.push(
        issue(null, null, 'too_many_rows', {
          count: String(records.length),
          max: MAX_ROWS.toLocaleString('en-US'),
        }),
      );
      return [];
    }

    const index = new Map<MenuCsvColumn, number>();
    header.forEach((cell, i) => {
      const column = normalizeHeader(cell);
      if (!column) {
        if (cell.trim()) {
          plan.warnings.push(
            issue(1, null, 'unknown_column', { column: cell.trim() }),
          );
        }
      } else if (index.has(column)) {
        plan.errors.push(issue(1, column, 'duplicate_column', { column }));
      } else {
        index.set(column, i);
      }
    });
    for (const column of REQUIRED_COLUMNS) {
      if (!index.has(column)) {
        plan.errors.push(issue(1, column, 'missing_column', { column }));
      }
    }
    if (plan.errors.length) return [];

    const firstRowOf = new Map<string, number>();
    const parsed: ParsedMenuRow[] = [];

    for (const { row, cells } of records) {
      const get = (column: MenuCsvColumn) => {
        const i = index.get(column);
        return i === undefined ? '' : unescapeCell(cells[i] ?? '');
      };
      const errors: MenuImportIssue[] = [];
      const fail = (
        column: MenuCsvColumn,
        key: string,
        vars?: Record<string, string>,
      ) => errors.push(issue(row, column, key, vars));
      const checkLength = (
        column: MenuCsvColumn,
        value: string,
        max: number,
      ) => {
        if (value.length > max) fail(column, 'too_long', { max: String(max) });
      };

      const name = cleanText(get('nombre'));
      if (!name) fail('nombre', 'required');
      checkLength('nombre', name, MAX_NAME_LENGTH);

      const categoryName = cleanText(get('categoria'));
      if (!categoryName) fail('categoria', 'required');
      checkLength('categoria', categoryName, MAX_CATEGORY_LENGTH);

      const price = parsePrice(get('precio'));
      if ('error' in price) {
        fail(
          'precio',
          price.error === 'required' ? 'required' : `price_${price.error}`,
        );
      }

      const description = get('descripcion').trim();
      checkLength('descripcion', description, MAX_DESCRIPTION_LENGTH);

      const family = cleanText(get('familia')).toUpperCase();
      checkLength('familia', family, MAX_FAMILY_LENGTH);

      const recommended = parseYesNo(get('recomendado'));
      if ('error' in recommended) fail('recomendado', 'yes_no_invalid');

      const active = parseYesNo(get('activo'));
      if ('error' in active) fail('activo', 'yes_no_invalid');

      const photo = parsePhotoUrl(get('foto_url'));
      if ('error' in photo) fail('foto_url', `photo_${photo.error}`);

      const key = matchKey(name);
      if (name) {
        const first = firstRowOf.get(key);
        if (first) fail('nombre', 'duplicate_name', { row: String(first) });
        else firstRowOf.set(key, row);
      }

      if (
        errors.length ||
        'error' in price ||
        'error' in recommended ||
        'error' in active ||
        'error' in photo
      ) {
        plan.errors.push(...errors);
        continue;
      }

      parsed.push({
        row,
        key,
        name,
        description: description || undefined,
        categoryName,
        price: price.value,
        family: family || undefined,
        recommended: recommended.value,
        active: active.value,
        photoUrl: photo.value,
      });
    }

    return parsed;
  }

  private resolve(
    parsed: ParsedMenuRow[],
    plan: MenuImportPlan,
    products: Product[],
    lang: string,
  ) {
    const t = (key: string, vars?: Record<string, string>) =>
      this.translationService.translate(`menu_csv.${key}`, lang, vars);

    const categoriesByKey = new Map(
      plan.categories.map((category) => [matchKey(category.name), category]),
    );
    const productsByKey = groupBy(products, (product) =>
      matchKey(product.name),
    );
    const itemsByProduct = groupBy(plan.menuItems, (item) => item.productId);
    const productsById = new Map(products.map((p) => [p.id, p]));
    const warnedCategories = new Set<string>();

    for (const row of parsed) {
      const categoryKey = matchKey(row.categoryName);
      const category = categoriesByKey.get(categoryKey);

      if (!category) {
        if (!plan.newCategories.some((c) => c.key === categoryKey)) {
          plan.newCategories.push({
            key: categoryKey,
            name: row.categoryName.toUpperCase(),
          });
        }
      } else if (!category.isActive && !warnedCategories.has(categoryKey)) {
        warnedCategories.add(categoryKey);
        plan.warnings.push({
          row: row.row,
          column: 'categoria',
          message: t('inactive_category'),
        });
      }

      // Si hay nombres repetidos en el restaurante, gana el que ya está en este menú.
      const candidates = productsByKey.get(row.key) ?? [];
      const product =
        candidates.find((p) => itemsByProduct.has(p.id)) ??
        candidates.find((p) => p.isActive) ??
        candidates[0] ??
        null;
      const items = product ? (itemsByProduct.get(product.id) ?? []) : [];
      const menuItem = items[0] ?? null;

      if (items.length > 1) {
        plan.warnings.push({
          row: row.row,
          column: 'nombre',
          message: t('repeated_in_menu', { count: String(items.length) }),
        });
      }
      if (product && !product.isActive) {
        plan.warnings.push({
          row: row.row,
          column: 'nombre',
          message: t('inactive_product'),
        });
      }

      plan.rows.push({
        ...row,
        categoryKey,
        product,
        menuItem,
        action: !product ? 'create' : menuItem ? 'update' : 'add',
      });
    }

    // Un producto del menú que no viene en el archivo y otro nuevo muy parecido
    // suelen ser el mismo con el nombre cambiado: se avisa para no duplicarlo.
    const inFile = new Set(
      plan.rows.flatMap((row) => (row.product ? [row.product.id] : [])),
    );
    const missing = [
      ...new Set(
        plan.menuItems
          .map((item) => item.productId)
          .filter((id) => !inFile.has(id)),
      ),
    ]
      .map((id) => productsById.get(id))
      .filter((product): product is Product => !!product);

    for (const row of plan.rows) {
      if (row.action !== 'create') continue;
      const similar = missing.find((product) =>
        areSimilarNames(row.key, matchKey(product.name)),
      );
      if (similar) {
        plan.warnings.push({
          row: row.row,
          column: 'nombre',
          message: t('similar_name', { name: similar.name }),
        });
      }
    }
  }
}
