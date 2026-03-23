import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '@/config/configuration';
import { plainToInstance } from 'class-transformer';
import { EnvironmentVariables } from '@/config/env.validation';
import { validateSync } from 'class-validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config) => {
        const validatedConfig = plainToInstance(
          EnvironmentVariables,
          config,
          { enableImplicitConversion: true }
        );

        const errors = validateSync(validatedConfig, {
          skipMissingProperties: false
        });

        if (errors.length > 0) throw new Error(errors.toString());

        return validatedConfig;
      }
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
