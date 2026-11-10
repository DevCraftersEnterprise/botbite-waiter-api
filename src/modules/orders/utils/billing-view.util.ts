import { Invoice } from '@/modules/orders/entities/invoice.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
} from '@/modules/orders/enums/order.enums';

export interface PaymentView {
  id: string;
  paidAt: Date;
  status: Payment['status'];
  orderCode: string | null;
  table: string | null;
  /** Mesa, recoger o domicilio. null: el pago no tiene cuenta. */
  orderType: OrderType | null;
  /**
   * Se aprobó, pero la cuenta se canceló después (un pedido pagado que el
   * dueño canceló): ese dinero se devuelve y no cuenta como cobrado.
   */
  toRefund: boolean;
  consumption: number;
  tip: number;
  /** Lo que debía la cuenta. */
  amount: number;
  /** Lo que reportó el proveedor. */
  paidAmount: number;
  paymentType: string | null;
  cashbackEarned: number;
  providerPaymentId: string;
}

export interface InvoiceView {
  id: string;
  issuedAt: Date;
  folio: string;
  uuid: string;
  orderCode: string | null;
  table: string | null;
  orderType: OrderType | null;
  rfc: string;
  legalName: string;
  cfdiUse: string;
  paymentForm: string;
  total: number;
  emailSent: boolean;
}

const isRefundPending = (payment: Payment, order: Order | null): boolean =>
  payment.status === PaymentStatus.APPROVED &&
  order?.status === OrderStatus.CANCELLED;

/** Postgres entrega `numeric` como texto. */
export const toPaymentView = (payment: Payment): PaymentView => ({
  id: payment.id,
  paidAt: payment.paidAt,
  status: payment.status,
  orderCode: payment.order?.code ?? null,
  table: payment.order?.tableLabel ?? null,
  orderType: payment.order?.type ?? null,
  toRefund: isRefundPending(payment, payment.order ?? null),
  consumption: Number(payment.consumption),
  tip: Number(payment.tip),
  amount: Number(payment.amount),
  paidAmount: Number(payment.paidAmount),
  paymentType: payment.paymentType,
  cashbackEarned: Number(payment.cashbackEarned),
  providerPaymentId: payment.providerPaymentId,
});

export const toInvoiceView = (invoice: Invoice): InvoiceView => ({
  id: invoice.id,
  issuedAt: invoice.issuedAt,
  folio: invoice.folio,
  uuid: invoice.uuid,
  orderCode: invoice.order?.code ?? null,
  table: invoice.order?.tableLabel ?? null,
  orderType: invoice.order?.type ?? null,
  rfc: invoice.rfc,
  legalName: invoice.legalName,
  cfdiUse: invoice.cfdiUse,
  paymentForm: invoice.paymentForm,
  total: Number(invoice.total),
  emailSent: invoice.emailSent,
});
