import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { UserRoleGuard } from '@/core/auth/guards/user-role.guard';
import { JwtStrategy } from '@/core/auth/strategies/jwt.strategy';
import { User } from '@/modules/users/entities/user.entity';

/**
 * Infraestructura de autenticación compartida por todos los módulos: JWT de
 * acceso, estrategia de Passport y guards usados por el decorador @Auth.
 */
@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: configService.getOrThrow<string>(
            'jwt.accessExpiry',
          ) as StringValue,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [JwtStrategy, JwtAuthGuard, UserRoleGuard],
  exports: [PassportModule, JwtModule, JwtAuthGuard, UserRoleGuard],
})
export class AuthCoreModule {}
