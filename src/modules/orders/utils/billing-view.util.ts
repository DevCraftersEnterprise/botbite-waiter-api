import { Invoice } from '@/modules/orders/entities/invoice.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';

export interface PaymentView {
  id: string;
  paidAt: Date;
  status: Payment['status'];
  orderCode: string | null;
  table: string | null;
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
  rfc: string;
  legalName: string;
  cfdiUse: string;
  paymentForm: string;
  total: number;
  emailSent: boolean;
}

/** Postgres entrega `numeric` como texto. */
export const toPaymentView = (payment: Payment): PaymentView => ({
  id: payment.id,
  paidAt: payment.paidAt,
  status: payment.status,
  orderCode: payment.order?.code ?? null,
  table: payment.order?.tableLabel ?? null,
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
  rfc: invoice.rfc,
  legalName: invoice.legalName,
  cfdiUse: invoice.cfdiUse,
  paymentForm: invoice.paymentForm,
  total: Number(invoice.total),
  emailSent: invoice.emailSent,
});
