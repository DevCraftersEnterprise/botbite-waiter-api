import { errorMessage, errorStack } from '@/common/utils/error.util';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ProcessedMessage } from '@/modules/messages/entities/processed-message.entity';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';
import { ProcessIncomingMessageUseCase } from '@/modules/messages/use-cases/messages/process-incoming-message.usecase';

const MAX_PENDING_MESSAGES = 1000;
const PROCESSED_MESSAGES_RETENTION_DAYS = 7;

export type EnqueueResult =
  | 'queued'
  | 'duplicate'
  | 'rate_limited'
  | 'overloaded';

/**
 * Recibe los webhooks de Twilio y los procesa en segundo plano.
 *
 * - Responder rápido: Twilio corta a los 15 s y reintenta. En v1 el webhook
 *   esperaba a OpenAI/Twilio y los reintentos duplicaban pedidos.
 * - Idempotencia: cada MessageSid se registra en `processed_messages`; los
 *   reintentos se descartan.
 * - Orden: los mensajes de un mismo teléfono se procesan uno tras otro (la
 *   conversación es una máquina de estados).
 * - Límite por teléfono (RATE_LIMIT_MAX mensajes cada RATE_LIMIT_TTL s), que en
 *   v1 estaba desactivado.
 *
 * La cola vive en memoria: si el proceso se reinicia con mensajes pendientes,
 * esos mensajes se pierden (quedan registrados como recibidos). Con varias
 * instancias de la API habría que migrar a una cola compartida (BullMQ/Redis).
 */
@Injectable()
export class InboundMessageQueueService implements OnApplicationShutdown {
  private readonly logger = new Logger(InboundMessageQueueService.name);
  private readonly chains = new Map<string, Promise<void>>();
  private readonly rateWindows = new Map<string, number[]>();
  private readonly rateLimitMax: number;
  private readonly rateLimitTtlMs: number;
  private pending = 0;

  constructor(
    configService: ConfigService,
    @InjectRepository(ProcessedMessage)
    private readonly processedMessageRepository: Repository<ProcessedMessage>,
    private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase,
  ) {
    this.rateLimitMax = configService.get<number>('messages.rateLimitMax', 10);
    this.rateLimitTtlMs = configService.get<number>(
      'messages.rateLimitTtlMs',
      60_000,
    );
  }

  async enqueue(body: WebhookDataTwilio): Promise<EnqueueResult> {
    if (this.pending >= MAX_PENDING_MESSAGES) {
      this.logger.error(
        'Inbound queue is full; rejecting message so Twilio retries later',
      );
      return 'overloaded';
    }

    if (!(await this.markAsProcessed(body.MessageSid))) {
      this.logger.log(`Duplicate webhook ignored: ${body.MessageSid}`);
      return 'duplicate';
    }

    const key = body.From;

    if (this.isRateLimited(key)) {
      this.logger.warn(
        `Rate limit exceeded for a customer; message ${body.MessageSid} dropped`,
      );
      return 'rate_limited';
    }

    this.pending++;
    const previous = this.chains.get(key) ?? Promise.resolve();

    const next = previous
      .then(() => this.processIncomingMessageUseCase.execute(body))
      .catch((error) =>
        this.logger.error(
          `Error processing message ${body.MessageSid}: ${errorMessage(error)}`,
          errorStack(error),
        ),
      )
      .finally(() => {
        this.pending--;
        if (this.chains.get(key) === next) this.chains.delete(key);
      });

    this.chains.set(key, next);
    return 'queued';
  }

  /** Espera a que terminen los mensajes en curso antes de apagar la app. */
  async onApplicationShutdown() {
    if (this.chains.size === 0) return;
    this.logger.log(
      `Waiting for ${this.pending} inbound messages before shutdown`,
    );
    await Promise.allSettled([...this.chains.values()]);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupProcessedMessages() {
    const cutoff = new Date(
      Date.now() - PROCESSED_MESSAGES_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    try {
      const result = await this.processedMessageRepository.delete({
        createdAt: LessThan(cutoff),
      });
      this.logger.log(
        `Deleted ${result.affected ?? 0} processed message records`,
      );
    } catch (error) {
      this.logger.error('Failed to clean up processed messages', error);
    }
  }

  /** Devuelve false si el MessageSid ya se había recibido. */
  private async markAsProcessed(messageSid: string): Promise<boolean> {
    const rows: unknown[] = await this.processedMessageRepository.query(
      'INSERT INTO "processed_messages" ("messageSid") VALUES ($1) ON CONFLICT DO NOTHING RETURNING "messageSid"',
      [messageSid],
    );

    return rows.length > 0;
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitTtlMs;
    const timestamps = (this.rateWindows.get(key) ?? []).filter(
      (t) => t > windowStart,
    );

    if (timestamps.length >= this.rateLimitMax) {
      this.rateWindows.set(key, timestamps);
      return true;
    }

    timestamps.push(now);
    this.rateWindows.set(key, timestamps);

    if (this.rateWindows.size > 10_000) this.pruneRateWindows(windowStart);

    return false;
  }

  private pruneRateWindows(windowStart: number) {
    for (const [key, timestamps] of this.rateWindows) {
      if (!timestamps.some((t) => t > windowStart))
        this.rateWindows.delete(key);
    }
  }
}
