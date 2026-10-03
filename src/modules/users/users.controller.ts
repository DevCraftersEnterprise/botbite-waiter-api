import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Lang } from '@/common/decorators/lang.decorator';
import { Auth } from '@/core/auth/decorators/auth.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { FindUsersDto } from '@/modules/users/dto/find-users.dto';
import { RegisterUserDto } from '@/modules/users/dto/register-user.dto';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register-user')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  registerUser(@Body() registerUserDto: RegisterUserDto, @Lang() lang: string) {
    return this.usersService.registerUser(registerUserDto, lang);
  }

  @Post('register-client')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  registerClient(
    @Body() registerUserDto: RegisterUserDto,
    @Lang() lang: string,
  ) {
    return this.usersService.registerClient(registerUserDto, lang);
  }

  @Delete('deactivate-user/:id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    return this.usersService.deactivateUser(user, userId, lang);
  }

  @Patch('activate-user/:id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    return this.usersService.activateUser(user, userId, lang);
  }

  @Patch('add-admin-role/:id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  addAdminRole(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    return this.usersService.addAdminRoleToUser(user, userId, lang);
  }

  @Delete('remove-admin-role/:id')
  @Auth([UserRoles.SUPER])
  removeAdminRole(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    return this.usersService.removeAdminRoleFromUser(user, userId, lang);
  }

  @Get('find-user/:term')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  async findUserByTerm(@Param('term') term: string, @Lang() lang: string) {
    const { user } = await this.usersService.findUserByTerm(term, lang);
    return user;
  }

  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  findAllUsers(@CurrentUser() user: User, @Query() findUserDto: FindUsersDto) {
    const { limit, offset, ...filters } = findUserDto;

    return this.usersService.findAllUsers(user.id, { limit, offset }, filters);
  }
}
