import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoginUserDto } from '@/modules/auth/dto/login-user.dto';
import {
  LoginResponse,
  RefreshTokenResponse,
} from '@/modules/auth/interfaces/auth.interfaces';
import { TokenService } from '@/modules/auth/services/token.service';
import { LoginUseCase } from '@/modules/auth/use-cases/login.usecase';
import { RefreshTokenUseCase } from '@/modules/auth/use-cases/refresh-token.usecase';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly tokenService: TokenService,
  ) {}

  login(
    loginUserDto: LoginUserDto,
    lang: string,
    ip: string,
  ): Promise<LoginResponse> {
    return this.loginUseCase.execute(loginUserDto, lang, ip);
  }

  refreshToken(
    refreshToken: string,
    lang: string,
  ): Promise<RefreshTokenResponse> {
    return this.refreshTokenUseCase.execute(refreshToken, lang);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokenService.revoke(refreshToken);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupExpiredTokens() {
    try {
      const deleted = await this.tokenService.deleteExpired();
      this.logger.log(`Deleted ${deleted} expired refresh tokens`);
    } catch (error) {
      this.logger.error('Failed to clean up expired refresh tokens', error);
    }
  }
}
