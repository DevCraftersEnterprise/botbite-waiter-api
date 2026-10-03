import { IsEmail, MaxLength } from 'class-validator';

export class AssignStaffDto {
  /** Email de una cuenta existente con rol USER (cajero o mesero). */
  @IsEmail()
  @MaxLength(255)
  email: string;
}
