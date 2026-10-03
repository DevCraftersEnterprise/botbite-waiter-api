import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  configureApp(app);

  const port = app.get(ConfigService).getOrThrow<number>('app.port');
  await app.listen(port);

  new Logger('Bootstrap').log(`Application is running on port ${port}`);
}

void bootstrap();
