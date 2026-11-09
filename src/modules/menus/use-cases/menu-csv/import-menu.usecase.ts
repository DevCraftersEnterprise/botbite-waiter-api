import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { errorMessage } from '@/common/utils/error.util';
import { BotEventsService } from '@/modules/bot-events/bot-events.service';
import { Category } from '@/modules/categories/entities/category.entity';
import { matchKey } from '@/modules/menus/csv/menu-csv.format';
import { MenuPhotoService } from '@/modules/menus/csv/menu-photo.service';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import {
  MenuImportIssue,
  MenuImportResult,
} from '@/modules/menus/interfaces/menu-csv.interfaces';
import {
  MenuImportPlan,
  PlanMenuImportUseCase,
} from '@/modules/menus/use-cases/menu-csv/plan-menu-import.usecase';
import { Product } from '@/modules/products/entities/product.entity';

/** Fotos que se suben a la vez: Cloudinary limita las cargas simultáneas. */
const PHOTO_CONCURRENCY = 4;

interface PhotoCopy {
  row: number;
  url: string;
  productId: string;
}

/**
 * Guarda el menú del CSV en una sola transacción: si una fila tiene error, no
 * se guarda nada. Las fotos se copian después, y una que falla no deshace lo
 * demás.
 */
@Injectable()
export class ImportMenuUseCase {
  private readonly logger = new Logger(ImportMenuUseCase.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly planMenuImport: PlanMenuImportUseCase,
    private readonly photos: MenuPhotoService,
    private readonly botEvents: BotEventsService,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    menuId: string,
    buffer: Buffer,
    lang: string,
  ): Promise<MenuImportResult> {
    const t = (key: string, vars?: Record<string, string>) =>
      this.translationService.translate(`menu_csv.${key}`, lang, vars);

    const { plan, copies } = await this.dataSource.transaction(
      async (manager) => {
        // Dos importaciones del mismo menú a la vez se esperan una a otra.
        await manager.findOne(Menu, {
          where: { id: menuId },
          lock: { mode: 'pessimistic_write' },
        });

        const plan = await this.planMenuImport.execute(
          manager,
          menuId,
          buffer,
          lang,
        );

        if (plan.errors.length) {
          throw new BadRequestException({
            message: t('has_errors'),
            errors: plan.errors,
            warnings: plan.warnings,
          });
        }

        return { plan, copies: await this.save(manager, plan) };
      },
    );

    const photoErrors = await this.copyPhotos(plan.restaurantId, copies, t);
    this.botEvents.catalogChanged({ menuId });

    const { summary } = this.planMenuImport.toPreview(plan);
    this.logger.log(
      `Menu ${menuId} imported: ${summary.productsToCreate} created, ` +
        `${summary.productsToAdd} added, ${summary.productsToUpdate} updated, ` +
        `${copies.length - photoErrors.length}/${copies.length} photos`,
    );

    return {
      message: t('imported', {
        created: String(summary.productsToCreate),
        added: String(summary.productsToAdd),
        updated: String(summary.productsToUpdate),
      }),
      summary,
      warnings: plan.warnings,
      photoErrors,
    };
  }

  private async save(
    manager: EntityManager,
    plan: MenuImportPlan,
  ): Promise<PhotoCopy[]> {
    const categoryIdOf = await this.saveCategories(manager, plan);
    const copies: PhotoCopy[] = [];
    const touchedProducts: Product[] = [];

    for (const row of plan.rows) {
      const product =
        row.product ??
        manager.create(Product, {
          name: row.name,
          restaurantId: plan.restaurantId,
        });

      if (row.description !== undefined) product.description = row.description;
      if (row.photoUrl && this.photos.isOwnUrl(row.photoUrl)) {
        product.imageUrl = row.photoUrl;
      }

      row.product = product;
      touchedProducts.push(product);
    }

    await manager.save(Product, touchedProducts, { chunk: 100 });

    const items: MenuItem[] = [];
    for (const row of plan.rows) {
      const product = row.product!;
      const item =
        row.menuItem ??
        manager.create(MenuItem, {
          menuId: plan.menuId,
          productId: product.id,
          shouldRecommend: false,
          isActive: true,
          variantGroup: null,
        });

      item.categoryId = categoryIdOf.get(row.categoryKey)!;
      item.price = row.price;
      if (row.recommended !== null) item.shouldRecommend = row.recommended;
      if (row.active !== null) item.isActive = row.active;
      if (row.family !== undefined) item.variantGroup = row.family;

      row.menuItem = item;
      items.push(item);

      if (row.photoUrl && !this.photos.isOwnUrl(row.photoUrl)) {
        copies.push({ row: row.row, url: row.photoUrl, productId: product.id });
      }
    }

    await manager.save(MenuItem, this.reorder(plan, items), { chunk: 100 });
    return copies;
  }

  /** Crea las categorías nuevas al final, en el orden del archivo. */
  private async saveCategories(manager: EntityManager, plan: MenuImportPlan) {
    const categoryIdOf = new Map<string, number>();

    for (const category of plan.categories) {
      categoryIdOf.set(matchKey(category.name), category.id);
    }

    const lastOrder = Math.max(
      -1,
      ...plan.categories.map((category) => category.sortOrder),
    );
    const created = await manager.save(
      Category,
      plan.newCategories.map((category, i) =>
        manager.create(Category, {
          name: category.name,
          restaurantId: plan.restaurantId,
          sortOrder: lastOrder + 1 + i,
        }),
      ),
    );

    plan.newCategories.forEach((category, i) =>
      categoryIdOf.set(category.key, created[i].id),
    );
    return categoryIdOf;
  }

  /**
   * En cada categoría del archivo, sus productos quedan en el orden del
   * archivo y los que no vienen quedan después, en el orden que tenían.
   */
  private reorder(plan: MenuImportPlan, fileItems: MenuItem[]): MenuItem[] {
    const inFile = new Set(fileItems);
    const categories = new Set(fileItems.map((item) => item.categoryId));
    const changed = new Set(fileItems);

    for (const categoryId of categories) {
      const ordered = [
        ...fileItems.filter((item) => item.categoryId === categoryId),
        ...plan.menuItems.filter(
          (item) => item.categoryId === categoryId && !inFile.has(item),
        ),
      ];

      ordered.forEach((item, sortOrder) => {
        if (item.sortOrder !== sortOrder) {
          item.sortOrder = sortOrder;
          changed.add(item);
        }
      });
    }

    return [...changed];
  }

  private async copyPhotos(
    restaurantId: string,
    copies: PhotoCopy[],
    t: (key: string) => string,
  ): Promise<MenuImportIssue[]> {
    const errors: MenuImportIssue[] = [];
    const queue = [...copies];
    const products = this.dataSource.getRepository(Product);

    const worker = async () => {
      for (let copy = queue.shift(); copy; copy = queue.shift()) {
        try {
          const imageUrl = await this.photos.copy(
            copy.url,
            restaurantId,
            copy.productId,
          );
          await products.update(copy.productId, { imageUrl });
        } catch (error) {
          this.logger.warn(
            `Photo not copied for product ${copy.productId}: ${errorMessage(error)}`,
          );
          errors.push({
            row: copy.row,
            column: 'foto_url',
            message: t('photo_failed'),
          });
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(PHOTO_CONCURRENCY, copies.length) },
        worker,
      ),
    );

    return errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  }
}
