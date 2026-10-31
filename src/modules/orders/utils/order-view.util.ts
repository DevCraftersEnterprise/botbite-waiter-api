import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';

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
  paymentMethod: Order['paymentMethod'];
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
  paymentMethod: order.paymentMethod,
  ...(order.rounds && {
    rounds: [...order.rounds]
      .sort((a, b) => a.number - b.number)
      .map(toRoundView),
  }),
});
