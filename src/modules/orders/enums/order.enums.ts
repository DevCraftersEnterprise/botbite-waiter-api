/** Estado de la cuenta de una mesa. */
export enum OrderStatus {
  /** Comiendo: puede pedir más rondas. */
  OPEN = 'open',
  /** Pidió la cuenta y está eligiendo cómo pagar. */
  BILL_REQUESTED = 'bill_requested',
  /** Se le envió el link de pago. */
  PAYMENT_LINK = 'payment_link',
  /** Le cobra el mesero. */
  WITH_WAITER = 'with_waiter',
  /** Pagó en línea. */
  PAID = 'paid',
  /** Caja la dio por cobrada. */
  SETTLED = 'settled',
  /** El cierre diario la cerró porque nadie pidió la cuenta. */
  AUTO_CLOSED = 'auto_closed',
  CANCELLED = 'cancelled',
}

/** Cuentas que siguen en curso: son las que ve caja en Órdenes. */
export const ACTIVE_ORDER_STATUSES = [
  OrderStatus.OPEN,
  OrderStatus.BILL_REQUESTED,
  OrderStatus.PAYMENT_LINK,
  OrderStatus.WITH_WAITER,
];

export enum OrderSource {
  WHATSAPP = 'whatsapp',
  /** La abrió el personal desde el panel. */
  STAFF = 'staff',
}

export enum PaymentMethod {
  MERCADO_PAGO = 'mercado_pago',
  WAITER = 'waiter',
}

/** Estado de una comanda. */
export enum RoundStatus {
  NEW = 'new',
  PREPARING = 'preparing',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}
