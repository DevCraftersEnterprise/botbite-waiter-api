import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBotKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
