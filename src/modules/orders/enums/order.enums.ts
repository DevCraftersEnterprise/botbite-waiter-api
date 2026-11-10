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

/** Cómo recibe el cliente su pedido. */
export enum OrderType {
  /** En el restaurante, con el mesero. */
  DINE_IN = 'dine_in',
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
}

/** Los tipos que atiende el número de pedidos. */
export const ORDERING_TYPES = [OrderType.PICKUP, OrderType.DELIVERY] as const;

/** Entrega de un pedido de recoger o domicilio. Empieza al pagarse. */
export enum FulfillmentStatus {
  /** Pagado: caja aún no lo empieza. */
  PENDING = 'pending',
  PREPARING = 'preparing',
  /** Solo domicilio. */
  ON_THE_WAY = 'on_the_way',
  /** Solo recoger. */
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/** Los que siguen en "Para entregar". */
export const OPEN_FULFILLMENT_STATUSES = [
  FulfillmentStatus.PENDING,
  FulfillmentStatus.PREPARING,
  FulfillmentStatus.ON_THE_WAY,
  FulfillmentStatus.READY,
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

/** Qué pasó con un pago aprobado por el proveedor. */
export enum PaymentStatus {
  /** Cubrió la cuenta y la cerró. */
  APPROVED = 'approved',
  /** Llegó menos de lo que debía: la cuenta sigue abierta. */
  INCOMPLETE = 'incomplete',
  /** La cuenta no existe o ya estaba cerrada. */
  UNMATCHED = 'unmatched',
}

/** Estado de una comanda. */
export enum RoundStatus {
  NEW = 'new',
  PREPARING = 'preparing',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}
