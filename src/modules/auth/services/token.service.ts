import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { IsNull, LessThan, Repository } from 'typeorm';
import { JwtPayload } from '@/core/auth/interfaces/jwt-payload.interface';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';

export type RefreshTokenPayload = JwtPayload & { jti: string };

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly refreshSecret: string;
  private readonly refreshExpiry: StringValue;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {
    this.refreshSecret = configService.getOrThrow<string>('jwt.refreshSecret');
    this.refreshExpiry = configService.getOrThrow<string>(
      'jwt.refreshExpiry',
    ) as StringValue;
  }

  async issueTokens(userId: string): Promise<IssuedTokens> {
    const accessToken = this.jwtService.sign({
      userId,
      type: 'access',
    } satisfies JwtPayload);

    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { userId, type: 'refresh', jti } satisfies JwtPayload,
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiry,
      },
    );

    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);

    await this.refreshTokenRepository.insert({
      id: jti,
      userId,
      expiresAt: new Date(exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Valida un refresh token y lo consume. Devuelve el payload si es válido.
   * Si se presenta un token ya rotado/revocado se asume robo y se revocan
   * todas las sesiones del usuario.
   */
  async consumeRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = this.verifyRefreshToken(token);

    const stored = await this.refreshTokenRepository.findOne({
      where: { id: payload.jti },
    });

    if (!stored || stored.userId !== payload.userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}. Revoking all sessions.`,
      );
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revocación atómica: si dos peticiones usan el mismo token a la vez solo
    // una gana.
    const result = await this.refreshTokenRepository.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    if (!result.affected)
      throw new UnauthorizedException('Invalid refresh token');

    return payload;
  }

  async linkReplacement(
    oldJti: string,
    newRefreshToken: string,
  ): Promise<void> {
    const { jti } = this.jwtService.decode<JwtPayload>(newRefreshToken);
    await this.refreshTokenRepository.update(
      { id: oldJti },
      { replacedById: jti ?? null },
    );
  }

  async revoke(token: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = this.verifyRefreshToken(token);
    } catch {
      // Cerrar sesión con un token inválido no debe dar error.
      return;
    }

    await this.refreshTokenRepository.update(
      { id: payload.jti, userId: payload.userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh' || !payload.userId || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return payload as RefreshTokenPayload;
  }
}
