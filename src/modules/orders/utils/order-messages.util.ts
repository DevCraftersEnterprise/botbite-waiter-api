import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { Order } from '@/modules/orders/entities/order.entity';

const money = (value: number | string): string =>
  `$${Number(value).toFixed(2)}`;

const who = (order: Order): string => {
  const table = order.tableLabel ? `la mesa ${order.tableLabel}` : 'sin mesa';
  return order.customerName ? `${order.customerName} en ${table}` : table;
};

const itemLine = (item: OrderItem): string =>
  `${item.quantity}x ${item.productName}` +
  (item.notes ? ` (${item.notes})` : '');

export interface RoundMessageOptions {
  /** Primera ronda de un comensal cuya ubicación no se verificó. */
  locationUnverified?: boolean;
  /** Esta mesa ya había pedido una cuenta: va en una cuenta aparte. */
  afterPreviousBill?: boolean;
}

/** Textos de los avisos a caja. Son los que hoy llegan por WhatsApp. */
export const roundMessage = (
  order: Order,
  items: OrderItem[],
  options: RoundMessageOptions = {},
): string => {
  const total = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  return [
    options.locationUnverified &&
      '⚠️ POR CONFIRMAR CON EL MESERO: no se verificó la ubicación del cliente.',
    options.afterPreviousBill &&
      '🆕 Cuenta nueva: esta mesa ya había pedido una cuenta.',
    `🛎️ ${who(order)} ha pedido:`,
    ...items.map(itemLine),
    `Total: ${money(total)}`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const billMessage = (order: Order): string =>
  `🧾 ${who(order)} solicita su cuenta. Total: ${money(order.total)}`;

export const payWithWaiterMessage = (order: Order): string =>
  `💵 ${who(order)} pagará con el mesero: ${money(order.total)}`;
