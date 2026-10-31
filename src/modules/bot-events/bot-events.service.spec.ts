import { createHmac } from 'crypto';
import { signBotEvent } from '@/modules/bot-events/bot-events.service';

describe('signBotEvent', () => {
  it('signs the timestamp and the body, so neither can be altered', () => {
    const secret = 'secret';
    const expected = createHmac('sha256', secret)
      .update('1700000000000.{"type":"order.closed"}')
      .digest('hex');

    expect(
      signBotEvent(secret, '1700000000000', '{"type":"order.closed"}'),
    ).toBe(`sha256=${expected}`);
  });

  it('changes with the timestamp', () => {
    expect(signBotEvent('secret', '1', '{}')).not.toBe(
      signBotEvent('secret', '2', '{}'),
    );
  });
});
