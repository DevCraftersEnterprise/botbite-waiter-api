import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { errorMessage } from '@/common/utils/error.util';

/** Días que se guarda la dirección de un pedido después de su último cambio. */
export const DELIVERY_DATA_DAYS = 30;

/**
 * La dirección y la ubicación de un pedido a domicilio solo sirven para
 * entregarlo: se borran 30 días después de su último cambio (entregado,
 * cancelado o, si se quedó a medias, el último movimiento).
 */
@Injectable()
export class OrderingPrivacyService {
  private readonly logger = new Logger(OrderingPrivacyService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOnSchedule(): Promise<void> {
    try {
      const purged = await this.purgeDeliveryData();
      if (purged > 0) this.logger.log(`Delivery data purged: ${purged}`);
    } catch (error) {
      this.logger.error(`Delivery data purge failed: ${errorMessage(error)}`);
    }
  }

  /** Devuelve cuántos pedidos limpió. */
  async purgeDeliveryData(): Promise<number> {
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `
      UPDATE "orders"
      SET "deliveryAddress" = NULL,
          "deliveryReferences" = NULL,
          "deliveryLatitude" = NULL,
          "deliveryLongitude" = NULL
      WHERE "type" = 'delivery'
        AND ("deliveryAddress" IS NOT NULL OR "deliveryLatitude" IS NOT NULL)
        AND GREATEST("openedAt", "closedAt", "fulfillmentUpdatedAt")
            < now() - make_interval(days => $1)
      `,
      [DELIVERY_DATA_DAYS],
    );

    return affected;
  }
}
