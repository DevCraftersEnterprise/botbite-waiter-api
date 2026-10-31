import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { IsNull, Not, Repository } from 'typeorm';
import { errorMessage } from '@/common/utils/error.util';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Category } from '@/modules/categories/entities/category.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';

export const EVENTS_PATH = 'portal-evento';
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [1_000, 3_000];
// Una edición del menú suele ser varios cambios seguidos: se avisa una vez.
const CATALOG_DEBOUNCE_MS = 2_000;

export type BotEventType =
  | 'catalog.changed'
  | 'round.status_changed'
  | 'order.closed';

export interface CatalogScope {
  branchId?: string;
  restaurantId?: string;
  menuId?: string;
  categoryId?: number;
}

/** Firma que n8n debe recalcular: HMAC-SHA256 de `<timestamp>.<cuerpo>`. */
export const signBotEvent = (
  secret: string,
  timestamp: string,
  body: string,
): string =>
  `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

/**
 * Avisa a n8n de lo que pasa en el portal. Es de mejor esfuerzo: si n8n no
 * responde se reintenta y se registra, sin afectar la operación del panel.
 */
@Injectable()
export class BotEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(BotEventsService.name);
  private readonly secret: string | undefined;
  private readonly pendingCatalog = new Map<string, NodeJS.Timeout>();

  constructor(
    configService: ConfigService,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {
    this.secret = configService.get<string>('bot.webhookSecret');
  }

  onModuleDestroy(): void {
    this.pendingCatalog.forEach((timer) => clearTimeout(timer));
    this.pendingCatalog.clear();
  }

  /** No espera a n8n: el panel responde aunque n8n esté caído. */
  emit(branchId: string, type: BotEventType, data: object = {}): void {
    this.deliver(branchId, type, data).catch((error) =>
      this.logger.warn(`Event ${type} not sent: ${errorMessage(error)}`),
    );
  }

  catalogChanged(scope: CatalogScope): void {
    this.branchesInScope(scope)
      .then((branchIds) => branchIds.forEach((id) => this.scheduleCatalog(id)))
      .catch((error) =>
        this.logger.warn(`catalog.changed skipped: ${errorMessage(error)}`),
      );
  }

  private scheduleCatalog(branchId: string): void {
    clearTimeout(this.pendingCatalog.get(branchId));

    const timer = setTimeout(() => {
      this.pendingCatalog.delete(branchId);
      this.emit(branchId, 'catalog.changed');
    }, CATALOG_DEBOUNCE_MS);
    timer.unref();

    this.pendingCatalog.set(branchId, timer);
  }

  private async branchesInScope(scope: CatalogScope): Promise<string[]> {
    if (scope.branchId) return [scope.branchId];

    if (scope.menuId) {
      const menu = await this.menuRepository.findOne({
        where: { id: scope.menuId },
        select: { branchId: true },
      });
      return menu ? [menu.branchId] : [];
    }

    let restaurantId = scope.restaurantId;

    if (scope.categoryId !== undefined) {
      const category = await this.categoryRepository.findOne({
        where: { id: scope.categoryId },
        select: { restaurantId: true },
      });
      restaurantId = category?.restaurantId;
    }

    if (!restaurantId) return [];

    const branches = await this.branchRepository.find({
      where: { restaurantId, botBaseUrl: Not(IsNull()) },
      select: { id: true },
    });

    return branches.map((branch) => branch.id);
  }

  private async deliver(
    branchId: string,
    type: BotEventType,
    data: object,
  ): Promise<void> {
    if (!this.secret) return;

    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
      select: { id: true, botBaseUrl: true },
    });

    if (!branch?.botBaseUrl) return;

    const url = `${branch.botBaseUrl}/${EVENTS_PATH}`;
    const body = JSON.stringify({
      type,
      branchId,
      occurredAt: new Date().toISOString(),
      data,
    });

    for (let attempt = 0; ; attempt++) {
      try {
        await this.post(url, body);
        return;
      } catch (error) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay).unref());
      }
    }
  }

  private async post(url: string, body: string): Promise<void> {
    const timestamp = Date.now().toString();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BotBite-Timestamp': timestamp,
        'X-BotBite-Signature': signBotEvent(this.secret!, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`n8n answered ${response.status}`);
  }
}
