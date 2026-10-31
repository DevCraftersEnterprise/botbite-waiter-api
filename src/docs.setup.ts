import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { BotModule } from '@/modules/bot/bot.module';

const DOCS_PATH = 'docs';

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const basicAuth =
  (user: string, password: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
    const [givenUser, ...rest] = Buffer.from(encoded ?? '', 'base64')
      .toString()
      .split(':');

    const valid =
      scheme === 'Basic' &&
      safeEqual(givenUser, user) &&
      safeEqual(rest.join(':'), password);

    if (valid) return next();

    res.set('WWW-Authenticate', 'Basic realm="BotBite API"');
    res.status(401).send('Authentication required');
  };

/**
 * Publica la documentación de las rutas del bot en /docs. En producción exige
 * DOCS_USER y DOCS_PASSWORD; sin ellas no se publica.
 */
export const setupDocs = (app: NestExpressApplication): void => {
  const configService = app.get(ConfigService);
  const user = configService.get<string>('docs.user');
  const password = configService.get<string>('docs.password');
  const hasCredentials = Boolean(user && password);

  if (configService.get<boolean>('app.isProduction') && !hasCredentials) return;

  if (user && password) app.use(`/${DOCS_PATH}`, basicAuth(user, password));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('BotBite API · Mesero de WhatsApp')
      .setDescription('Rutas que consume el mesero de n8n.')
      .setVersion('1.0')
      .addApiKey(
        { type: 'apiKey', name: 'X-BotBite-Key', in: 'header' },
        'bot-key',
      )
      .build(),
    { include: [BotModule] },
  );

  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}/openapi.json`,
    yamlDocumentUrl: `${DOCS_PATH}/openapi.yaml`,
  });
};
