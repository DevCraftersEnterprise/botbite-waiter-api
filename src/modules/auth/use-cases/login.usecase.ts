import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { LoginUserDto } from '@/modules/auth/dto/login-user.dto';
import { LoginResponse } from '@/modules/auth/interfaces/auth.interfaces';
import { TokenService } from '@/modules/auth/services/token.service';
import { User } from '@/modules/users/entities/user.entity';

// Hash de una contraseña aleatoria. Se verifica contra él cuando el usuario no
// existe para que la respuesta tarde lo mismo y no revele qué emails existen.
const DUMMY_HASH_PROMISE = argon2.hash(`dummy-${Math.random()}`);

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenService: TokenService,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    loginUserDto: LoginUserDto,
    lang: string,
    ip: string,
  ): Promise<LoginResponse> {
    const email = loginUserDto.email.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        roles: true,
        isActive: true,
      },
    });

    const passwordHash = user?.password ?? (await DUMMY_HASH_PROMISE);
    const isValidPassword = await argon2
      .verify(passwordHash, loginUserDto.password)
      .catch(() => false);

    // Mismo error para usuario inexistente, inactivo o contraseña incorrecta.
    if (!user || !user.isActive || !isValidPassword) {
      this.logger.warn(`Failed login attempt from IP ${ip}`);
      // 400 (no 401) como en v1: el interceptor del frontend trata los 401 como token expirado.
      throw new BadRequestException(
        this.translationService.translate('errors.invalid_credentials', lang),
      );
    }

    const { accessToken, refreshToken } = await this.tokenService.issueTokens(
      user.id,
    );

    this.logger.log(`Successful login for user ${user.id} from IP ${ip}`);

    return {
      message: this.translationService.translate('auth.welcome', lang),
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
