import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import {
  BotEventsService,
  CatalogScope,
} from '@/modules/bot-events/bot-events.service';

const scopeOf = (request: Request): CatalogScope => {
  const { branchId, restaurantId, menuId, id } = request.params as Record<
    string,
    string | undefined
  >;
  const body = request.body as { restaurantId?: string } | undefined;

  return {
    branchId,
    menuId,
    restaurantId: restaurantId ?? body?.restaurantId,
    // Solo el controlador de categorías usa :id.
    categoryId: id ? Number(id) : undefined,
  };
};

/** Avisa a n8n cuando una ruta del panel cambia el catálogo. */
@Injectable()
export class CatalogChangedInterceptor implements NestInterceptor {
  constructor(private readonly botEventsService: BotEventsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === 'GET') return next.handle();

    return next
      .handle()
      .pipe(tap(() => this.botEventsService.catalogChanged(scopeOf(request))));
  }
}
