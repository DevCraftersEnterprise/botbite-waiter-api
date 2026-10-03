import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { langFromHeader } from '@/common/decorators/lang.decorator';
import { TranslationService } from '@/common/services/translation.service';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
}

const MAX_TRACKED_KEYS = 10_000;

/**
 * Limita los intentos fallidos de login por IP + email.
 *
 * Contar por la combinación (y no solo por IP) evita que un atacante bloquee
 * el login de todos los usuarios detrás del mismo proxy/NAT, y aun así frena
 * la fuerza bruta contra una cuenta. Además hay un límite más laxo por IP.
 *
 * El estado vive en memoria: con varias instancias de la API cada una lleva su
 * propia cuenta. Para escalar horizontalmente habría que moverlo a Redis.
 */
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly logger = new Logger(LoginThrottleGuard.name);
  private readonly failedAttempts = new Map<string, LoginAttempt>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(
    configService: ConfigService,
    private readonly translation: TranslationService,
  ) {
    this.maxAttempts = configService.get<number>('throttle.loginLimit', 5);
    this.windowMs = Math.max(
      configService.get<number>('throttle.ttlMs', 60_000),
      60_000,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const lang = langFromHeader(request.headers['accept-language']);
    const body = request.body as { email?: unknown } | undefined;
    const now = Date.now();

    for (const [key, limit] of this.keysFor(request.ip ?? '', body?.email)) {
      const attempts = this.getActiveAttempts(key, now);

      if (attempts && attempts.count >= limit) {
        const remainingSeconds = Math.ceil(
          (this.windowMs - (now - attempts.firstAttempt)) / 1000,
        );

        this.logger.warn(
          `Login throttled for ${key.split('|')[0]} (${attempts.count} failed attempts)`,
        );

        throw new HttpException(
          this.translation.translate('errors.too_many_requests', lang, {
            seconds: remainingSeconds.toString(),
          }),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  recordFailedAttempt(ip: string, email?: string): void {
    const now = Date.now();

    for (const [key] of this.keysFor(ip, email)) {
      const attempts = this.getActiveAttempts(key, now);

      if (attempts) attempts.count++;
      else this.failedAttempts.set(key, { count: 1, firstAttempt: now });
    }

    this.prune(now);
  }

  clearFailedAttempts(ip: string, email?: string): void {
    const [userKey] = this.keysFor(ip, email);
    if (email && userKey) this.failedAttempts.delete(userKey[0]);
  }

  private keysFor(ip: string, email?: unknown): Array<[string, number]> {
    const keys: Array<[string, number]> = [];
    if (typeof email === 'string' && email) {
      keys.push([
        `ip:${ip}|email:${email.trim().toLowerCase()}`,
        this.maxAttempts,
      ]);
    }
    // Límite global por IP, más alto, para frenar el barrido de muchos emails.
    keys.push([`ip:${ip}`, this.maxAttempts * 4]);
    return keys;
  }

  private getActiveAttempts(
    key: string,
    now: number,
  ): LoginAttempt | undefined {
    const attempts = this.failedAttempts.get(key);
    if (attempts && now - attempts.firstAttempt > this.windowMs) {
      this.failedAttempts.delete(key);
      return undefined;
    }
    return attempts;
  }

  private prune(now: number) {
    if (this.failedAttempts.size < MAX_TRACKED_KEYS) return;
    for (const [key, attempts] of this.failedAttempts) {
      if (now - attempts.firstAttempt > this.windowMs)
        this.failedAttempts.delete(key);
    }
  }
}
