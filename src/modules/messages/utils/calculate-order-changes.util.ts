import { Logger } from '@nestjs/common';

export const calculateOrderChangesUtil = (
  lastOrder: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >,
  currentOrder: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >,
  logger?: Logger,
): Record<
  string,
  { price: number; quantity: number; menuItemId: string; notes?: string }
> => {
  const changes: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > = {};

  if (logger) {
    logger.log('\n=== CALCULATING ORDER CHANGES ===');
    logger.log(`Last order products: ${Object.keys(lastOrder).length}`);
    logger.log(`Current order products: ${Object.keys(currentOrder).length}`);
  }

  for (const [productKey, current] of Object.entries(currentOrder)) {
    const last = lastOrder[productKey];

    if (logger) {
      logger.log(`\nProduct: ${productKey}`);
      logger.log(
        `  Current: ${current.quantity} x $${current.price} (ID: ${current.menuItemId})`,
      );
      logger.log(
        `  Last: ${last ? `${last.quantity} x $${last.price} (ID: ${last.menuItemId})` : 'NOT FOUND'}`,
      );
    }

    if (!last) {
      if (logger)
        logger.log(`  ➡️ NEW PRODUCT - adding ${current.quantity} units`);
      changes[productKey] = current;
    } else if (current.quantity > last.quantity) {
      const diff = current.quantity - last.quantity;
      if (logger)
        logger.log(
          `  ➡️ QUANTITY INCREASED - adding ${diff} units (from ${last.quantity} to ${current.quantity})`,
        );
      changes[productKey] = {
        price: current.price,
        quantity: diff,
        menuItemId: current.menuItemId,
        notes: current.notes,
      };
    } else {
      if (logger) logger.log(`  ⚪ NO CHANGE (same quantity)`);
    }
  }

  if (logger) {
    logger.log(`\nTotal changes to notify: ${Object.keys(changes).length}`);
    logger.log('=== END CALCULATION ===\n');
  }

  return changes;
};
