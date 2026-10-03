import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ProcessedMessage } from '@/modules/messages/entities/processed-message.entity';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';
import { InboundMessageQueueService } from '@/modules/messages/services/inbound-message-queue.service';
import { ProcessIncomingMessageUseCase } from '@/modules/messages/use-cases/messages/process-incoming-message.usecase';

const message = (sid: string, from = 'whatsapp:+5215500000001') =>
  ({
    MessageSid: sid,
    From: from,
    To: 'whatsapp:+5215500000002',
    Body: sid,
  }) as WebhookDataTwilio;

const setup = (rateLimitMax = 10) => {
  const seen = new Set<string>();
  const repository = {
    // Simula INSERT ... ON CONFLICT DO NOTHING RETURNING.
    query: jest.fn((_sql: string, [sid]: [string]) =>
      Promise.resolve(
        seen.has(sid) ? [] : (seen.add(sid), [{ messageSid: sid }]),
      ),
    ),
  } as unknown as Repository<ProcessedMessage>;

  const processed: string[] = [];
  const useCase = {
    execute: jest.fn(async (body: WebhookDataTwilio) => {
      // El primer mensaje tarda más: si no se serializaran, se procesaría al final.
      await new Promise((resolve) =>
        setTimeout(resolve, body.MessageSid === 'SM1' ? 30 : 1),
      );
      processed.push(body.MessageSid);
    }),
  } as unknown as ProcessIncomingMessageUseCase;

  const config = {
    get: (key: string, fallback: unknown) =>
      key === 'messages.rateLimitMax' ? rateLimitMax : fallback,
  } as unknown as ConfigService;

  const service = new InboundMessageQueueService(config, repository, useCase);
  return { service, processed, useCase };
};

describe('InboundMessageQueueService', () => {
  it('ignores Twilio retries of the same MessageSid', async () => {
    const { service, useCase } = setup();

    await expect(service.enqueue(message('SM1'))).resolves.toBe('queued');
    await expect(service.enqueue(message('SM1'))).resolves.toBe('duplicate');
    await service.onApplicationShutdown();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('processes messages from the same customer in arrival order', async () => {
    const { service, processed } = setup();

    await service.enqueue(message('SM1'));
    await service.enqueue(message('SM2'));
    await service.enqueue(message('SM3'));
    await service.onApplicationShutdown();

    expect(processed).toEqual(['SM1', 'SM2', 'SM3']);
  });

  it('rate limits a single customer without affecting others', async () => {
    const { service } = setup(2);

    await expect(service.enqueue(message('A1'))).resolves.toBe('queued');
    await expect(service.enqueue(message('A2'))).resolves.toBe('queued');
    await expect(service.enqueue(message('A3'))).resolves.toBe('rate_limited');
    await expect(
      service.enqueue(message('B1', 'whatsapp:+5215500000009')),
    ).resolves.toBe('queued');
    await service.onApplicationShutdown();
  });

  it('keeps processing after a message fails', async () => {
    const { service, useCase, processed } = setup();
    (useCase.execute as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await service.enqueue(message('SM1'));
    await service.enqueue(message('SM2'));
    await service.onApplicationShutdown();

    expect(processed).toEqual(['SM2']);
  });
});
