import { botKeyOf, botKeyTracker } from '@/modules/bot/utils/bot-throttle.util';

describe('botKeyOf', () => {
  it('reads the bot key header', () => {
    expect(botKeyOf({ headers: { 'x-botbite-key': 'bbk_1' } })).toBe('bbk_1');
  });

  it('ignores requests without a key', () => {
    expect(botKeyOf({ headers: {} })).toBeNull();
    expect(botKeyOf({ headers: { 'x-botbite-key': '' } })).toBeNull();
    expect(botKeyOf({})).toBeNull();
  });
});

describe('botKeyTracker', () => {
  it('gives each key its own bucket', () => {
    expect(botKeyTracker('bbk_a')).toBe(botKeyTracker('bbk_a'));
    expect(botKeyTracker('bbk_a')).not.toBe(botKeyTracker('bbk_b'));
  });

  it('does not keep the key itself', () => {
    expect(botKeyTracker('bbk_secret')).not.toContain('bbk_secret');
  });
});
