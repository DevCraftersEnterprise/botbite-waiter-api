import { fromCents, toCents } from '@/common/utils/money.util';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrderType } from '@/modules/orders/enums/order.enums';

export interface RoundItemView {
  id: string;
  menuItemId: string;
  name: string | null;
  category: string | null;
  quantity: number;
  /** Precio unitario. */
  price: number;
  note: string | null;
}

export interface RoundView {
  id: string;
  number: number;
  status: OrderRound['status'];
  sentAt: Date;
  acknowledgedAt: Date | null;
  deliveredAt: Date | null;
  items: RoundItemView[];
}

/** Dónde entregar un pedido a domicilio. Se borra 30 días después. */
export interface DeliveryView {
  address: string | null;
  references: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface OrderView {
  id: string;
  code: string | null;
  source: Order['source'];
  status: Order['status'];
  table: string | null;
  customerName: string | null;
  language: string;
  locationVerified: boolean;
  openedAt: Date;
  billRequestedAt: Date | null;
  closedAt: Date | null;
  subtotal: number;
  walletDiscount: number;
  total: number;
  tip: number;
  /** Total, propina y envío: lo que se le cobra al comensal. */
  amountDue: number;
  paymentMethod: Order['paymentMethod'];
  type: Order['type'];
  fulfillmentStatus: Order['fulfillmentStatus'];
  fulfillmentUpdatedAt: Date | null;
  scheduledFor: Date | null;
  deliveryFee: number;
  commissionPct: number | null;
  delivery: DeliveryView | null;
  rounds?: RoundView[];
}

const toItemView = (item: OrderItem): RoundItemView => ({
  id: item.id,
  menuItemId: item.menuItemId,
  name: item.productName,
  category: item.categoryName,
  quantity: item.quantity,
  price: Number(item.price),
  note: item.notes ?? null,
});

export const toRoundView = (round: OrderRound): RoundView => ({
  id: round.id,
  number: round.number,
  status: round.status,
  sentAt: round.sentAt,
  acknowledgedAt: round.acknowledgedAt,
  deliveredAt: round.deliveredAt,
  items: (round.items ?? []).map(toItemView),
});

const toNumberOrNull = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

const toDeliveryView = (order: Order): DeliveryView | null =>
  order.type === OrderType.DELIVERY
    ? {
        address: order.deliveryAddress,
        references: order.deliveryReferences,
        latitude: toNumberOrNull(order.deliveryLatitude),
        longitude: toNumberOrNull(order.deliveryLongitude),
      }
    : null;

/** Postgres entrega `numeric` como texto. */
export const toOrderView = (order: Order): OrderView => ({
  id: order.id,
  code: order.code,
  source: order.source,
  status: order.status,
  table: order.tableLabel,
  customerName: order.customerName,
  language: order.language,
  locationVerified: order.locationVerified,
  openedAt: order.openedAt,
  billRequestedAt: order.billRequestedAt,
  closedAt: order.closedAt,
  subtotal: Number(order.subtotal),
  walletDiscount: Number(order.walletDiscount),
  total: Number(order.total),
  tip: Number(order.tip),
  amountDue: fromCents(
    toCents(order.total) + toCents(order.tip) + toCents(order.deliveryFee),
  ),
  paymentMethod: order.paymentMethod,
  type: order.type,
  fulfillmentStatus: order.fulfillmentStatus,
  fulfillmentUpdatedAt: order.fulfillmentUpdatedAt,
  scheduledFor: order.scheduledFor,
  deliveryFee: Number(order.deliveryFee),
  commissionPct: toNumberOrNull(order.commissionPct),
  delivery: toDeliveryView(order),
  ...(order.rounds && {
    rounds: [...order.rounds]
      .sort((a, b) => a.number - b.number)
      .map(toRoundView),
  }),
});
