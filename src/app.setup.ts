import { ConfiguredIoAdapter } from '@/common/adapters/configured-io.adapter';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * Configuración HTTP/WebSocket de la app. Compartida por main.ts y las
 * pruebas e2e para que se prueba exactamente lo que corre en producción.
 */
export const configureApp = (app: NestExpressApplication): void => {
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const isProduction = configService.get<boolean>('app.isProduction', false);

  // Detrás de un proxy, sin esto req.ip es la IP del proxy (el rate limit
  // bloquearía a todos a la vez) y req.protocol no coincide con la URL que
  // firma Twilio.
  app.set('trust proxy', configService.get<number>('app.trustProxy', 1));

  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });

  app.setGlobalPrefix('v1');

  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  if (isProduction && corsOrigins.length === 0) {
    logger.warn(
      'CORS_ORIGINS is empty: browser requests from any origin will be rejected',
    );
  }
  // En desarrollo, sin CORS_ORIGINS se permite cualquier origen.
  const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : !isProduction;

  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, allowedOrigins));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();
};
