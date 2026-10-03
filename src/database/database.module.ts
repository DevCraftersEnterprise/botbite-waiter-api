import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  buildDataSourceOptions,
  DatabaseSettings,
} from '@/database/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...buildDataSourceOptions(
          configService.getOrThrow<DatabaseSettings>('database'),
        ),
        autoLoadEntities: true,
        migrationsRun: configService.get<boolean>('app.isProduction'),
      }),
    }),
  ],
})
export class DatabaseModule {}
