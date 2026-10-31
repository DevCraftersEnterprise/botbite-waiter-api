import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import {
  billMessage,
  closedAccountPaymentMessage,
  dailyCloseMessage,
  incompletePaymentMessage,
  paymentMessage,
  payWithWaiterMessage,
  roundMessage,
  unmatchedPaymentMessage,
} from '@/modules/orders/utils/order-messages.util';

const order = {
  tableLabel: 'A5',
  customerName: 'Sergio',
  total: '210.00',
} as unknown as Order;

const items = [
  { productName: 'CHIPS DE CAMOTE', quantity: 2, price: '95.00' },
  { productName: 'FALAFEL', quantity: 1, price: '115.00', notes: 'sin salsa' },
] as unknown as OrderItem[];

describe('roundMessage', () => {
  it('lists the items and the round total', () => {
    expect(roundMessage(order, items)).toBe(
      [
        '🛎️ Sergio en la mesa A5 ha pedido:',
        '2x CHIPS DE CAMOTE',
        '1x FALAFEL (sin salsa)',
        'Total: $305.00',
      ].join('\n'),
    );
  });

  it('warns when the location was not verified', () => {
    expect(roundMessage(order, items, { locationUnverified: true })).toContain(
      'POR CONFIRMAR CON EL MESERO',
    );
  });

  it('warns about a new account after a previous bill', () => {
    expect(roundMessage(order, items, { afterPreviousBill: true })).toContain(
      'Cuenta nueva',
    );
  });

  it('works without a customer name', () => {
    const anonymous = { ...order, customerName: null } as Order;
    expect(roundMessage(anonymous, items)).toContain(
      '🛎️ la mesa A5 ha pedido:',
    );
  });
});

describe('account messages', () => {
  it('announces the bill request', () => {
    expect(billMessage(order)).toBe(
      '🧾 Sergio en la mesa A5 solicita su cuenta. Total: $210.00',
    );
  });

  it('shows the wallet discount on the bill', () => {
    const discounted = {
      ...order,
      subtotal: '250.00',
      walletDiscount: '40.00',
    } as unknown as Order;

    expect(billMessage(discounted)).toBe(
      '🧾 Sergio en la mesa A5 solicita su cuenta. Subtotal: $250.00, monedero: -$40.00. Total: $210.00',
    );
  });

  it('announces a payment with the waiter', () => {
    expect(payWithWaiterMessage(order)).toBe(
      '💵 Sergio en la mesa A5 pagará con el mesero: $210.00',
    );
  });
});

describe('payment messages', () => {
  const payment = {
    providerPaymentId: '123',
    consumption: '210.00',
    tip: '21.00',
    amount: '231.00',
    paidAmount: '231.00',
  } as unknown as Payment;

  it('breaks down the tip', () => {
    expect(paymentMessage(order, payment)).toBe(
      '💳 Sergio en la mesa A5 pagó con Mercado Pago: consumo $210.00 + propina $21.00 = $231.00. Operación 123. Ya no hay que cobrarle.',
    );
  });

  it('skips the breakdown without a tip', () => {
    const noTip = { ...payment, tip: '0.00', paidAmount: '210.00' } as Payment;

    expect(paymentMessage(order, noTip)).toContain(
      'pagó con Mercado Pago: $210.00.',
    );
  });

  it('warns about money that does not match', () => {
    const short = { ...payment, paidAmount: '100.00' } as Payment;

    expect(incompletePaymentMessage(order, short)).toContain(
      'pago de $100.00 de Sergio en la mesa A5, pero la cuenta era de $231.00',
    );
    expect(closedAccountPaymentMessage(order, payment)).toContain(
      'ya estaba cerrada',
    );
    expect(unmatchedPaymentMessage(payment)).toBe(
      '⚠️ Llegó un pago de $231.00 sin cuenta asociada. Revísalo en Mercado Pago (operación 123).',
    );
  });
});

describe('dailyCloseMessage', () => {
  it('lists each account', () => {
    const other = {
      tableLabel: '7',
      customerName: null,
      total: '95.00',
    } as unknown as Order;

    expect(dailyCloseMessage([order, other])).toBe(
      [
        '🌙 Cierre diario: 2 cuenta(s) sin pedir la cuenta. Revísalas:',
        'Sergio en la mesa A5: $210.00',
        'la mesa 7: $95.00',
      ].join('\n'),
    );
  });
});
