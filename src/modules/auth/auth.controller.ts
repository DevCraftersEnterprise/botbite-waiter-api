import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Lang } from '@/common/decorators/lang.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { LoginThrottleGuard } from '@/core/auth/guards/login-throttle.guard';
import { AuthService } from '@/modules/auth/auth.service';
import { LoginUserDto } from '@/modules/auth/dto/login-user.dto';
import { RefreshTokenDto } from '@/modules/auth/dto/refresh-token.dto';
import { User } from '@/modules/users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottleGuard: LoginThrottleGuard,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(LoginThrottleGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(
    @Ip() ip: string,
    @Lang() lang: string,
    @Body() loginUserDto: LoginUserDto,
  ) {
    try {
      const result = await this.authService.login(loginUserDto, lang, ip);
      this.loginThrottleGuard.clearFailedAttempts(ip, loginUserDto.email);
      return result;
    } catch (error) {
      this.loginThrottleGuard.recordFailedAttempt(ip, loginUserDto.email);
      throw error;
    }
  }

  @Get('validate-token')
  @UseGuards(JwtAuthGuard)
  validateToken(@CurrentUser() user: User) {
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  // El refresh token del body es la credencial: no se exige el access token
  // (normalmente ya expiró cuando el frontend llama aquí).
  @Post('refresh-token')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  refreshToken(@Body() dto: RefreshTokenDto, @Lang() lang: string) {
    return this.authService.refreshToken(dto.refreshToken, lang);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }
}
