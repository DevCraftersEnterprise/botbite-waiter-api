export enum NotificationType {
  /** Comanda nueva. */
  ORDER = 'order',
  /** El comensal pidió la cuenta. */
  BILL = 'bill',
  /** Pagará con el mesero. */
  PAY_WITH_WAITER = 'pay_with_waiter',
  /** Pago en línea recibido. */
  PAYMENT = 'payment',
  /** Algo requiere atención de caja. */
  ALERT = 'alert',
  /** Factura emitida o con error. */
  INVOICE = 'invoice',
}
