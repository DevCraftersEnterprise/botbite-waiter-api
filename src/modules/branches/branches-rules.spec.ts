import { buildFindOneBranchWhere } from '@/modules/branches/use-cases/find-one-branch.usecase';
import { generateQrToken } from '@/modules/branches/utils/generate-qr-token.util';
import { validateQrScanUtil } from '@/modules/messages/utils/validate-qr-scan.util';

const BRANCH_ID = '6f1c1a5e-3b2a-4a7e-9a55-3c1f6e1d9b10';
const RESTAURANT_ID = '0b8f2c3e-1d4a-4f6b-8e9c-7a6b5c4d3e2f';

describe('buildFindOneBranchWhere', () => {
  it('combines id AND restaurant (v1 used OR, so the restaurant filter did nothing)', () => {
    expect(buildFindOneBranchWhere(BRANCH_ID, RESTAURANT_ID)).toEqual({
      id: BRANCH_ID,
      restaurantId: RESTAURANT_ID,
    });
  });

  it('searches by assistant phone when the term is not a UUID', () => {
    expect(buildFindOneBranchWhere('+5215512345678')).toEqual({
      phoneNumberAssistant: '+5215512345678',
    });
  });
});

describe('QR tokens', () => {
  it('generates 128-bit random tokens that the bot recognizes', () => {
    const token = generateQrToken();
    expect(token).toMatch(/^QR-\d+-[a-f0-9]{32}$/);
    expect(validateQrScanUtil(`🛡️ INICIO ${token}`)).toEqual({
      isValidQrScan: true,
      token,
    });
  });

  it('never repeats tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateQrToken));
    expect(tokens.size).toBe(1000);
  });
});
