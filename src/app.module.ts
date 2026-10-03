import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CommonModule } from '@/common/common.module';
import configuration from '@/config/configuration';
import { EnvironmentVariables } from '@/config/env.validation';
import { AccessControlModule } from '@/core/access/access-control.module';
import { AuthCoreModule } from '@/core/auth/auth-core.module';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BranchesModule } from '@/modules/branches/branches.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { HealthModule } from '@/modules/health/health.module';
import { MenusModule } from '@/modules/menus/menus.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { OpenAIModule } from '@/modules/openai/openai.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { ProductsModule } from '@/modules/products/products.module';
import { RestaurantsModule } from '@/modules/restaurants/restaurants.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config) => {
        const validatedConfig = plainToInstance(EnvironmentVariables, config, {
          enableImplicitConversion: true,
        });

        const errors = validateSync(validatedConfig, {
          skipMissingProperties: false,
        });

        if (errors.length > 0) throw new Error(errors.toString());

        return validatedConfig;
      },
    }),
    // Límite global por IP. En v1 los @Throttle no hacían nada porque nunca se
    // registró el ThrottlerGuard.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('throttle.ttlMs', 60_000),
          limit: configService.get<number>('throttle.limit', 100),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    AuthCoreModule,
    AccessControlModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    CategoriesModule,
    ProductsModule,
    BranchesModule,
    MenusModule,
    OrdersModule,
    CustomersModule,
    OpenAIModule,
    MessagesModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Aplica @Exclude() (p. ej. el hash de la contraseña) en todas las respuestas.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
