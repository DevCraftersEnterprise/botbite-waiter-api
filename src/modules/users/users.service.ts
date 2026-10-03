import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { TranslationService } from '@/common/services/translation.service';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { TokenService } from '@/modules/auth/services/token.service';
import { FindUsersDto } from '@/modules/users/dto/find-users.dto';
import { RegisterUserDto } from '@/modules/users/dto/register-user.dto';
import { User } from '@/modules/users/entities/user.entity';
import { UserActor } from '@/modules/users/interfaces/users.interfaces';
import { changeUserStatusUseCase } from '@/modules/users/use-cases/change-user-status.use-case';
import { findAllUsersUseCase } from '@/modules/users/use-cases/find-all-users.use-case';
import { findUserUseCase } from '@/modules/users/use-cases/find-user.use-case';
import { manageUserAdminRoleUseCase } from '@/modules/users/use-cases/manage-user-admin-role.use-case';
import { registerUserUseCase } from '@/modules/users/use-cases/register-user.use-case';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly translationService: TranslationService,
    private readonly tokenService: TokenService,
  ) {}

  registerUser(registerUserDto: RegisterUserDto, lang: string) {
    return this.register(registerUserDto, lang, UserRoles.USER);
  }

  registerClient(registerUserDto: RegisterUserDto, lang: string) {
    return this.register(registerUserDto, lang, UserRoles.CLIENT);
  }

  activateUser(actor: UserActor, userId: string, lang: string) {
    return this.changeStatus(actor, userId, lang, true);
  }

  async deactivateUser(actor: UserActor, userId: string, lang: string) {
    const result = await this.changeStatus(actor, userId, lang, false);
    // Un usuario desactivado no debe poder renovar su sesión.
    await this.tokenService.revokeAllForUser(userId);
    return result;
  }

  addAdminRoleToUser(actor: UserActor, userId: string, lang: string) {
    return this.manageAdminRole(actor, userId, lang, true);
  }

  removeAdminRoleFromUser(actor: UserActor, userId: string, lang: string) {
    return this.manageAdminRole(actor, userId, lang, false);
  }

  findUserByTerm(term: string, lang = 'es') {
    return findUserUseCase({
      term,
      lang,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  findAllUsers(
    userId: string,
    paginationDto: PaginationDto,
    findUsersDto: FindUsersDto = {},
  ) {
    return findAllUsersUseCase({
      userId,
      paginationDto,
      findUsersDto,
      repository: this.userRepository,
    });
  }

  private register(dto: RegisterUserDto, lang: string, role: UserRoles) {
    return registerUserUseCase({
      dto,
      lang,
      role,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  private changeStatus(
    actor: UserActor,
    userId: string,
    lang: string,
    status: boolean,
  ) {
    return changeUserStatusUseCase({
      actor,
      userId,
      lang,
      status,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  private manageAdminRole(
    actor: UserActor,
    userId: string,
    lang: string,
    addRole: boolean,
  ) {
    return manageUserAdminRoleUseCase({
      actor,
      userId,
      lang,
      addRole,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }
}
