import {
  CustomerReportRow,
  localDate,
  maskPhone,
  toCustomersCsv,
} from '@/modules/customers/utils/customer-report.util';

const row = (
  overrides: Partial<CustomerReportRow> = {},
): CustomerReportRow => ({
  id: 'rc1',
  name: 'Ana',
  phone: '+5216441234567',
  visits: 3,
  firstVisitAt: new Date('2026-10-01T18:00:00Z'),
  lastVisitAt: new Date('2026-11-09T04:30:00Z'),
  spent: 450,
  paidOrders: 3,
  avgTicket: 150,
  walletBalance: 12.5,
  cashbackEarned: 22.5,
  promos: 'accepted',
  promosAt: new Date('2026-10-01T18:05:00Z'),
  status: 'recurring',
  favorites: ['TACO AL PASTOR', 'AGUA DE JAMAICA'],
  ...overrides,
});

describe('customer report', () => {
  it('hides the middle of the phone', () => {
    expect(maskPhone('+5216441234567')).toBe('+521••••••••67');
    expect(maskPhone('+52')).toBe('•••');
  });

  it('writes dates in the time zone of the restaurant', () => {
    // 04:30 UTC del 9 de noviembre todavía es el 8 en Hermosillo.
    expect(
      localDate(new Date('2026-11-09T04:30:00Z'), 'America/Hermosillo'),
    ).toBe('2026-11-08');
    expect(localDate(null, 'America/Hermosillo')).toBe('');
  });

  it('exports the full phone only of who accepted promotions', () => {
    const csv = toCustomersCsv(
      [
        row(),
        row({ name: 'Beto', promos: 'unsubscribed', status: 'inactive' }),
        row({ name: '=HYPERLINK("x")', promos: 'pending' }),
      ],
      'America/Hermosillo',
    );
    const lines = csv.split('\r\n');

    expect(lines[1]).toBe(
      'Ana,+5216441234567,3,2026-10-01,2026-11-08,450.00,3,150.00,12.50,22.50,aceptó,2026-10-01,recurrente,TACO AL PASTOR | AGUA DE JAMAICA',
    );
    expect(lines[2]).toContain('Beto,+521••••••••67,');
    expect(lines[2]).toContain(',se dio de baja,');
    expect(lines[2]).toContain(',inactivo,');
    // Un nombre que Excel tomaría por fórmula sale como texto.
    expect(lines[3].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});
