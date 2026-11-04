import {
  CFDI_USE_PATTERN,
  normalizeRfc,
  RFC_PATTERN,
  SAT_UUID_PATTERN,
} from '@/modules/customers/utils/tax.util';

describe('tax util', () => {
  it('cleans the RFC as it comes from the certificate', () => {
    expect(normalizeRfc(' xaxx-010101 000 ')).toBe('XAXX010101000');
  });

  it('accepts RFCs of people and companies', () => {
    expect(RFC_PATTERN.test('XAXX010101000')).toBe(true);
    expect(RFC_PATTERN.test('ÑAS850101AB1')).toBe(true);
    expect(RFC_PATTERN.test('AB&850101AB1')).toBe(true);
  });

  it('rejects malformed RFCs', () => {
    expect(RFC_PATTERN.test('XAXX0101010')).toBe(false);
    expect(RFC_PATTERN.test('1234010101000')).toBe(false);
    expect(RFC_PATTERN.test('xaxx010101000')).toBe(false);
  });

  it('knows the CFDI uses', () => {
    expect(
      ['G03', 'S01', 'CP01'].every((use) => CFDI_USE_PATTERN.test(use)),
    ).toBe(true);
    expect(CFDI_USE_PATTERN.test('G3')).toBe(false);
  });

  it('takes the SAT UUID in capitals', () => {
    expect(SAT_UUID_PATTERN.test('39C3F0C0-4D2D-4C9A-9B1E-0F6A2B3C4D5E')).toBe(
      true,
    );
    expect(SAT_UUID_PATTERN.test('39c3f0c0-4d2d-4c9a-9b1e-0f6a2b3c4d5e')).toBe(
      false,
    );
  });
});
