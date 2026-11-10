import { Invoice } from '@/modules/orders/entities/invoice.entity';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import { OrderType } from '@/modules/orders/enums/order.enums';

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

export const billMessage = (order: Order): string => {
  const wallet = Number(order.walletDiscount ?? 0);
  const detail =
    wallet > 0
      ? ` Subtotal: ${money(order.subtotal)}, monedero: -${money(wallet)}.`
      : '';

  return `🧾 ${who(order)} solicita su cuenta.${detail} Total: ${money(order.total)}`;
};

export const payWithWaiterMessage = (order: Order): string =>
  `💵 ${who(order)} pagará con el mesero: ${money(order.total)}`;

export const paymentMessage = (order: Order, payment: Payment): string => {
  const tip = Number(payment.tip);
  const breakdown =
    tip > 0
      ? `consumo ${money(payment.consumption)} + propina ${money(tip)} = ${money(payment.paidAmount)}`
      : money(payment.paidAmount);

  return `💳 ${who(order)} pagó con Mercado Pago: ${breakdown}. Operación ${payment.providerPaymentId}. Ya no hay que cobrarle.`;
};

const ORDER_LABEL: Record<string, string> = {
  delivery: '🛵 Pedido a domicilio',
  pickup: '🛍️ Pedido para recoger',
};

/** Fecha y hora en la zona de la sucursal: "lun 10 nov, 7:30 p.m.". */
export const formatLocal = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

/**
 * Aviso de un pedido de recoger o domicilio ya pagado: es cuando caja se
 * entera. No lleva la dirección: esa solo vive en el pedido.
 */
export const orderingPaidMessage = (
  order: Order,
  items: OrderItem[],
  payment: Payment,
  timeZone: string,
): string => {
  const fee = Number(payment.deliveryFee);
  const tip = Number(payment.tip);
  const parts = [
    `consumo ${money(payment.consumption)}`,
    fee > 0 && `envío ${money(fee)}`,
    tip > 0 && `propina ${money(tip)}`,
  ].filter(Boolean);

  return [
    `${ORDER_LABEL[order.type] ?? '🛍️ Pedido'} pagado${order.customerName ? ` de ${order.customerName}` : ''}:`,
    order.scheduledFor &&
      `⏰ Programado para ${formatLocal(order.scheduledFor, timeZone)}`,
    ...items.map(itemLine),
    `${parts.join(' + ')} = ${money(payment.paidAmount)} con Mercado Pago (operación ${payment.providerPaymentId}).`,
    order.type === OrderType.DELIVERY &&
      'La dirección está en "Para entregar".',
  ]
    .filter(Boolean)
    .join('\n');
};

/** Al cancelar un pedido pagado: caja hace el reembolso mientras el bot no lo haga solo. */
export const paidOrderCancelledMessage = (
  order: Order,
  payment: Payment | null,
): string => {
  const what =
    order.type === OrderType.DELIVERY
      ? 'pedido a domicilio'
      : 'pedido para recoger';
  const by = order.customerName ? ` de ${order.customerName}` : '';

  return payment
    ? `❌ Se canceló el ${what}${by}. Reembolsa ${money(payment.paidAmount)} en Mercado Pago (operación ${payment.providerPaymentId}).`
    : `❌ Se canceló el ${what}${by}, pero no se encontró su pago. Revísalo en Mercado Pago.`;
};

export const incompletePaymentMessage = (
  order: Order,
  payment: Payment,
): string =>
  `⚠️ Llegó un pago de ${money(payment.paidAmount)} de ${who(order)}, pero la cuenta era de ${money(payment.amount)}. Revísalo en Mercado Pago (operación ${payment.providerPaymentId}).`;

export const closedAccountPaymentMessage = (
  order: Order,
  payment: Payment,
): string =>
  `⚠️ Llegó un pago de ${money(payment.paidAmount)} de ${who(order)}, pero esa cuenta ya estaba cerrada. Revísalo en Mercado Pago (operación ${payment.providerPaymentId}).`;

export const unmatchedPaymentMessage = (payment: Payment): string =>
  `⚠️ Llegó un pago de ${money(payment.paidAmount)} sin cuenta asociada. Revísalo en Mercado Pago (operación ${payment.providerPaymentId}).`;

export const invoiceMessage = (order: Order, invoice: Invoice): string =>
  `🧾 Se emitió la factura ${invoice.folio} de ${who(order)} por ${money(invoice.total)}.`;

export const repeatedInvoiceMessage = (
  order: Order,
  invoice: Invoice,
  previous: Invoice,
): string =>
  `⚠️ Se emitió la factura ${invoice.folio} de ${who(order)}, pero esa cuenta ya tenía la factura ${previous.folio}. Revisa en FacturAPI si hay que cancelar una.`;

export const dailyCloseMessage = (orders: Order[]): string => {
  const accounts = orders.map(
    (order) => `${who(order)}: ${money(order.total)}`,
  );

  return [
    `🌙 Cierre diario: ${orders.length} cuenta(s) sin pedir la cuenta. Revísalas:`,
    ...accounts,
  ].join('\n');
};
