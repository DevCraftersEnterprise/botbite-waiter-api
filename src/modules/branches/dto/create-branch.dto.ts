import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Formato E.164 (+5215512345678).
export const E164_PHONE = /^\+[1-9]\d{7,14}$/;

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(E164_PHONE, {
    message:
      'phoneNumberAssistant must be in E.164 format (e.g. +5215512345678)',
  })
  phoneNumberAssistant?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(E164_PHONE, {
    message:
      'phoneNumberReception must be in E.164 format (e.g. +5215512345678)',
  })
  phoneNumberReception?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(500)
  surveyUrl?: string | null;
}
