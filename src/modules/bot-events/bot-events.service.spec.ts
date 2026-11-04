import { createHmac } from 'crypto';
import {
  botEventsUrl,
  signBotEvent,
} from '@/modules/bot-events/bot-events.service';

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

describe('botEventsUrl', () => {
  it('appends the events path to the base', () => {
    expect(botEventsUrl('https://n8n.test/webhook/mesero-cocorit')).toBe(
      'https://n8n.test/webhook/mesero-cocorit/portal-evento',
    );
    expect(botEventsUrl('https://mesero.test/')).toBe(
      'https://mesero.test/portal-evento',
    );
  });

  it('keeps the query that picks the business', () => {
    expect(botEventsUrl('https://mesero.test/?negocio=punto-de-union')).toBe(
      'https://mesero.test/portal-evento?negocio=punto-de-union',
    );
    expect(botEventsUrl('https://mesero.test/api?negocio=a&sucursal=b')).toBe(
      'https://mesero.test/api/portal-evento?negocio=a&sucursal=b',
    );
  });
});
