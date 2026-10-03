import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { RefreshTokenResponse } from '@/modules/auth/interfaces/auth.interfaces';
import {
  RefreshTokenPayload,
  TokenService,
} from '@/modules/auth/services/token.service';
import { User } from '@/modules/users/entities/user.entity';
import { sanitizeUserResponse } from '@/modules/users/utils/sanitized-user.util';

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenService: TokenService,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    refreshToken: string,
    lang: string,
  ): Promise<RefreshTokenResponse> {
    const invalid = () =>
      new UnauthorizedException(
        this.translationService.translate('errors.invalid_refresh_token', lang),
      );

    let payload: RefreshTokenPayload;
    try {
      payload = await this.tokenService.consumeRefreshToken(refreshToken);
    } catch {
      throw invalid();
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      this.logger.warn(
        `Refresh rejected for missing or inactive user ${payload.userId}`,
      );
      await this.tokenService.revokeAllForUser(payload.userId);
      throw invalid();
    }

    const tokens = await this.tokenService.issueTokens(user.id);
    await this.tokenService.linkReplacement(payload.jti, tokens.refreshToken);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      // El frontend actual lee `accessToken`/`refreshToken` en esta respuesta.
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: sanitizeUserResponse(user),
    };
  }
}
