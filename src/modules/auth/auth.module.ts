import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { LoginThrottleGuard } from '@/core/auth/guards/login-throttle.guard';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';
import { TokenService } from '@/modules/auth/services/token.service';
import { LoginUseCase } from '@/modules/auth/use-cases/login.usecase';
import { RefreshTokenUseCase } from '@/modules/auth/use-cases/refresh-token.usecase';
import { User } from '@/modules/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken]), CommonModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LoginThrottleGuard,
    LoginUseCase,
    RefreshTokenUseCase,
  ],
  exports: [TokenService],
})
export class AuthModule {}
