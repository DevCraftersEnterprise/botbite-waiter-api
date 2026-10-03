import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks';
import { TwilioSignatureGuard } from '@/modules/messages/guards/twilio-signature.guard';

const AUTH_TOKEN = 'test-auth-token';
const ACCOUNT_SID = 'AC00000000000000000000000000000000';
const BASE_URL = 'https://api.botbite.test';
const PATH = '/v1/messages/webhook';

const buildGuard = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    'twilio.authToken': AUTH_TOKEN,
    'twilio.accountSid': ACCOUNT_SID,
    'twilio.validateSignature': true,
    'twilio.webhookBaseUrl': BASE_URL,
    ...overrides,
  };
  const config = {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
  return new TwilioSignatureGuard(config);
};

const contextFor = (body: Record<string, string>, signature?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        originalUrl: PATH,
        ip: '127.0.0.1',
        protocol: 'https',
        get: () => 'api.botbite.test',
        header: (name: string) =>
          name.toLowerCase() === 'x-twilio-signature' ? signature : undefined,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('TwilioSignatureGuard', () => {
  const body = {
    AccountSid: ACCOUNT_SID,
    From: 'whatsapp:+5215500000001',
    To: 'whatsapp:+5215500000002',
    Body: 'hola',
    MessageSid: 'SM1',
  };

  it('accepts a request signed by Twilio', () => {
    const signature = getExpectedTwilioSignature(
      AUTH_TOKEN,
      `${BASE_URL}${PATH}`,
      body,
    );
    expect(buildGuard().canActivate(contextFor(body, signature))).toBe(true);
  });

  it('rejects a request without signature', () => {
    expect(() => buildGuard().canActivate(contextFor(body))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a tampered body', () => {
    const signature = getExpectedTwilioSignature(
      AUTH_TOKEN,
      `${BASE_URL}${PATH}`,
      body,
    );
    const tampered = { ...body, From: 'whatsapp:+5215599999999' };
    expect(() =>
      buildGuard().canActivate(contextFor(tampered, signature)),
    ).toThrow(ForbiddenException);
  });

  it('rejects a signature made with another auth token', () => {
    const signature = getExpectedTwilioSignature(
      'other-token',
      `${BASE_URL}${PATH}`,
      body,
    );
    expect(() => buildGuard().canActivate(contextFor(body, signature))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a valid signature from another Twilio account', () => {
    const foreign = {
      ...body,
      AccountSid: 'AC11111111111111111111111111111111',
    };
    const signature = getExpectedTwilioSignature(
      AUTH_TOKEN,
      `${BASE_URL}${PATH}`,
      foreign,
    );
    expect(() =>
      buildGuard().canActivate(contextFor(foreign, signature)),
    ).toThrow(ForbiddenException);
  });

  it('can be disabled explicitly for local development', () => {
    const guard = buildGuard({ 'twilio.validateSignature': false });
    expect(guard.canActivate(contextFor(body))).toBe(true);
  });
});
