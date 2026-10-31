import { generateBotKey, hashBotKey } from '@/modules/bot/utils/bot-key.util';

describe('generateBotKey', () => {
  it('starts with a visible prefix and stores only the hash', () => {
    const { secret, keyPrefix, keyHash } = generateBotKey();

    expect(keyPrefix).toMatch(/^bbk_[a-f0-9]{8}$/);
    expect(secret.startsWith(`${keyPrefix}_`)).toBe(true);
    expect(keyHash).toBe(hashBotKey(secret));
    expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(keyHash).not.toContain(secret);
  });

  it('carries 256 random bits and never repeats', () => {
    const keys = Array.from({ length: 200 }, generateBotKey);

    expect(new Set(keys.map((key) => key.secret)).size).toBe(200);
    // 32 bytes en base64url son 43 caracteres.
    expect(keys[0].secret.slice(keys[0].keyPrefix.length + 1)).toHaveLength(43);
  });
});
