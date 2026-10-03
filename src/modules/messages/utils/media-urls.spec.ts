import { isAllowedMediaUrl } from '@/modules/messages/use-cases/messages/send-message.usecase';
import { isTwilioMediaUrl } from '@/modules/messages/utils/download-twilio-media.util';

const SID = 'AC00000000000000000000000000000000';

describe('isTwilioMediaUrl', () => {
  it('accepts media URLs of our Twilio account', () => {
    expect(
      isTwilioMediaUrl(
        `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages/MM1/Media/ME1`,
        SID,
      ),
    ).toBe(true);
  });

  it.each([
    'https://attacker.example/steal',
    `http://api.twilio.com/2010-04-01/Accounts/${SID}/Messages/MM1/Media/ME1`,
    `https://api.twilio.com.attacker.example/2010-04-01/Accounts/${SID}/Messages/MM1`,
    `https://user:pass@api.twilio.com/2010-04-01/Accounts/${SID}/Messages/MM1`,
    `https://api.twilio.com:8443/2010-04-01/Accounts/${SID}/Messages/MM1`,
    'https://api.twilio.com/2010-04-01/Accounts/AC999/Messages/MM1/Media/ME1',
    'http://169.254.169.254/latest/meta-data',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isTwilioMediaUrl(url, SID)).toBe(false);
  });
});

describe('isAllowedMediaUrl', () => {
  it('accepts Cloudinary https images', () => {
    expect(
      isAllowedMediaUrl('https://res.cloudinary.com/demo/image/upload/p.jpg'),
    ).toBe(true);
  });

  it.each([
    'http://res.cloudinary.com/demo/p.jpg',
    'https://evil.example/p.jpg',
    'https://res.cloudinary.com.evil.example/p.jpg',
    'javascript:alert(1)',
  ])('rejects %s', (url) => {
    expect(isAllowedMediaUrl(url)).toBe(false);
  });
});
