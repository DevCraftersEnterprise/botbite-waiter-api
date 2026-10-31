import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import {
  billMessage,
  payWithWaiterMessage,
  roundMessage,
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

  it('announces a payment with the waiter', () => {
    expect(payWithWaiterMessage(order)).toBe(
      '💵 Sergio en la mesa A5 pagará con el mesero: $210.00',
    );
  });
});
